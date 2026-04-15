from django.db.models import Q
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from employees.models import Employee, EmployeeConfig, EmployeeUpdateRequest, Reward
from employees.serializers import (
    BirthdayEmployeeSerializer,
    EmployeeConfigSerializer,
    EmployeeSerializer,
    EmployeeUpdateRequestSerializer,
    EmployeeUpdateSerializer,
    RewardSerializer,
)
from notifications.services import create_notifications
from users.permissions import IsAdmin


# Fields a normal user can self-update (pending approval)
SELF_EDITABLE_FIELDS = [
    "avatar",
    "phone",
    "address_village",
    "address_commune",
    "address_district",
    "address_province",
    "email",
    "date_of_birth",
    "id_card_number",
    "bank_account_number",
    "bank_account_name",
    "bank_name",
]


class EmployeeViewSet(viewsets.ModelViewSet):
    """CRUD for employee profiles."""

    serializer_class = EmployeeSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        user = self.request.user
        # Non-editors only see their own profile
        if not self._is_editor(user):
            Employee.objects.get_or_create(user=user)
            return Employee.objects.select_related("user", "user__department").filter(user=user)

        qs = (
            Employee.objects.select_related("user", "user__department")
            .all()
        )
        search = self.request.query_params.get("q", "").strip()
        if search:
            qs = qs.filter(
                Q(user__username__icontains=search)
                | Q(user__full_name__icontains=search)
                | Q(phone__icontains=search)
                | Q(id_card_number__icontains=search)
            )
        work_status = self.request.query_params.get("work_status")
        if work_status:
            qs = qs.filter(work_status=work_status)
        contract_status = self.request.query_params.get("contract_status")
        if contract_status:
            qs = qs.filter(contract_status=contract_status)
        department = self.request.query_params.get("department")
        if department:
            qs = qs.filter(user__department_id=department)
        return qs

    def _is_editor(self, user):
        """Check if user is admin or one of the configured editors."""
        if user.is_superuser:
            return True
        if any(
            r.role.name.lower() == "admin"
            for r in user.user_roles.select_related("role").all()
        ):
            return True
        config = EmployeeConfig.load()
        return config.editor_users.filter(id=user.id).exists()

    def update(self, request, *args, **kwargs):
        if not self._is_editor(request.user):
            return Response(
                {"detail": "Bạn không có quyền chỉnh sửa thông tin nhân viên."},
                status=status.HTTP_403_FORBIDDEN,
            )
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        serializer = EmployeeUpdateSerializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(EmployeeSerializer(instance, context={"request": request}).data)

    def partial_update(self, request, *args, **kwargs):
        kwargs["partial"] = True
        return self.update(request, *args, **kwargs)

    def create(self, request, *args, **kwargs):
        return Response(
            {"detail": "Hồ sơ nhân viên được tạo tự động khi tạo tài khoản."},
            status=status.HTTP_405_METHOD_NOT_ALLOWED,
        )

    def destroy(self, request, *args, **kwargs):
        return Response(
            {"detail": "Không thể xóa hồ sơ nhân viên."},
            status=status.HTTP_405_METHOD_NOT_ALLOWED,
        )

    # --- My profile ---
    @action(detail=False, methods=["get"], url_path="me")
    def my_profile(self, request):
        """GET /employees/me/ — current user's employee profile."""
        employee, created = Employee.objects.get_or_create(user=request.user)
        serializer = EmployeeSerializer(employee, context={"request": request})
        data = serializer.data
        data["can_edit_all"] = self._is_editor(request.user)
        config = EmployeeConfig.load()
        data["is_approver"] = config.approver_users.filter(id=request.user.id).exists() or self._is_editor(request.user)
        # Check pending update request
        pending = EmployeeUpdateRequest.objects.filter(
            employee=employee, status=EmployeeUpdateRequest.Status.PENDING
        ).first()
        data["has_pending_update"] = pending is not None
        data["pending_update_id"] = pending.id if pending else None
        return Response(data)

    @action(detail=False, methods=["get"], url_path="profile-check")
    def profile_check(self, request):
        """GET /employees/profile-check/ — check if user must update empty required fields.

        Returns:
          - allowed: bool — whether user can access the system
          - reason: str — 'ok' | 'must_update' | 'pending_approval'
          - missing_fields: list — empty required fields the user must fill
          - required_fields: list — all configured required fields
          - force_profile_update: bool — feature toggle
        """
        user = request.user
        # Admins are always allowed
        if user.is_superuser or any(
            r.role.name.lower() == "admin"
            for r in user.user_roles.select_related("role").all()
        ):
            return Response({"allowed": True, "reason": "ok", "missing_fields": [], "required_fields": [], "force_profile_update": False})

        config = EmployeeConfig.load()
        if not config.force_profile_update or not config.required_fields:
            return Response({"allowed": True, "reason": "ok", "missing_fields": [], "required_fields": config.required_fields or [], "force_profile_update": config.force_profile_update})

        employee, _ = Employee.objects.get_or_create(user=user)

        # Determine which required fields are empty
        missing = []
        for field_name in config.required_fields:
            if not hasattr(employee, field_name):
                continue
            val = getattr(employee, field_name)
            if val is None or val == "" or (hasattr(val, "name") and not val.name):
                missing.append(field_name)

        if not missing:
            return Response({"allowed": True, "reason": "ok", "missing_fields": [], "required_fields": config.required_fields, "force_profile_update": True})

        # Check if there's a pending update request already
        has_pending = EmployeeUpdateRequest.objects.filter(
            employee=employee, status=EmployeeUpdateRequest.Status.PENDING
        ).exists()

        if has_pending:
            return Response({"allowed": False, "reason": "pending_approval", "missing_fields": missing, "required_fields": config.required_fields, "force_profile_update": True, "reject_reason": None})

        # Check for latest rejected request to show reason
        last_rejected = EmployeeUpdateRequest.objects.filter(
            employee=employee, status=EmployeeUpdateRequest.Status.REJECTED
        ).order_by("-updated_at").first()
        reject_reason = last_rejected.review_note if last_rejected else None
        # Clean up old rejected requests after reading
        if last_rejected:
            EmployeeUpdateRequest.objects.filter(
                employee=employee, status=EmployeeUpdateRequest.Status.REJECTED
            ).delete()

        return Response({"allowed": False, "reason": "must_update", "missing_fields": missing, "required_fields": config.required_fields, "force_profile_update": True, "reject_reason": reject_reason})

    @action(detail=False, methods=["patch"], url_path="me/update", parser_classes=[MultiPartParser, FormParser, JSONParser])
    def request_update(self, request):
        """PATCH /employees/me/update/ — submit self-update for approval."""
        employee, _ = Employee.objects.get_or_create(user=request.user)
        config = EmployeeConfig.load()

        approver_ids = list(config.approver_users.values_list("id", flat=True))
        if not approver_ids:
            return Response(
                {"detail": "Chưa cấu hình người duyệt. Vui lòng liên hệ quản trị viên."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Block if pending request already exists
        if EmployeeUpdateRequest.objects.filter(
            employee=employee, status=EmployeeUpdateRequest.Status.PENDING
        ).exists():
            return Response(
                {"detail": "Bạn đang có một yêu cầu cập nhật chờ phê duyệt. Vui lòng chờ kết quả trước khi gửi yêu cầu mới."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Filter only self-editable fields
        changes = {}
        avatar_file = None
        for field in SELF_EDITABLE_FIELDS:
            if field in request.data:
                value = request.data[field]
                if field == "avatar" and hasattr(value, "read"):
                    avatar_file = value
                    changes["avatar"] = True  # marker
                else:
                    changes[field] = value

        if not changes:
            return Response(
                {"detail": "Không có trường nào được cập nhật."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        update_req = EmployeeUpdateRequest.objects.create(
            employee=employee,
            requested_by=request.user,
            changes=changes,
        )

        # Save avatar to temp field on the request (not on employee)
        if avatar_file:
            update_req.avatar_upload.save(avatar_file.name, avatar_file, save=True)

        # Notify approvers
        create_notifications(
            user_ids=approver_ids,
            content=f"{request.user.full_name or request.user.username} đã gửi yêu cầu cập nhật thông tin nhân viên.",
            notification_type="APPROVAL",
        )

        approver_names = ", ".join(
            n for n in config.approver_users.values_list("full_name", flat=True) if n
        ) or ", ".join(
            config.approver_users.values_list("username", flat=True)
        )
        return Response(
            {
                "detail": f"Thông tin của bạn đã được gửi tới \"{approver_names}\" để phê duyệt.",
                "request_id": update_req.id,
            },
            status=status.HTTP_201_CREATED,
        )

    # --- Config ---
    @action(detail=False, methods=["get", "put"], url_path="config", permission_classes=[IsAdmin])
    def config(self, request):
        """GET/PUT /employees/config/ — admin-only config for editor/approver."""
        config_obj = EmployeeConfig.load()
        if request.method == "GET":
            return Response(EmployeeConfigSerializer(config_obj).data)
        serializer = EmployeeConfigSerializer(config_obj, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    # --- Birthdays ---
    @action(detail=False, methods=["get"], url_path="birthdays")
    def birthdays(self, request):
        """GET /employees/birthdays/ — employees with birthdays in current month."""
        now = timezone.now()
        month = int(request.query_params.get("month", now.month))
        qs = (
            Employee.objects
            .select_related("user", "user__department")
            .filter(
                work_status=Employee.WorkStatus.ACTIVE,
                date_of_birth__month=month,
            )
            .order_by("date_of_birth__day")
        )
        serializer = BirthdayEmployeeSerializer(qs, many=True, context={"request": request})
        return Response(serializer.data)


class EmployeeUpdateRequestViewSet(viewsets.ReadOnlyModelViewSet):
    """View and approve/reject employee update requests."""

    serializer_class = EmployeeUpdateRequestSerializer
    permission_classes = [IsAuthenticated]

    def _is_approver(self, user):
        """Check if user is admin or one of the configured approvers."""
        if user.is_superuser:
            return True
        if any(
            r.role.name.lower() == "admin"
            for r in user.user_roles.select_related("role").all()
        ):
            return True
        config = EmployeeConfig.load()
        return config.approver_users.filter(id=user.id).exists()

    def get_queryset(self):
        user = self.request.user
        # Show all if user is approver or admin
        if self._is_approver(user):
            qs = EmployeeUpdateRequest.objects.select_related(
                "employee__user", "requested_by__employee_profile", "reviewed_by"
            ).all()
        else:
            # Only own requests
            qs = EmployeeUpdateRequest.objects.select_related(
                "employee__user", "requested_by__employee_profile", "reviewed_by"
            ).filter(requested_by=user)

        status_filter = self.request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter)
        return qs

    @action(detail=True, methods=["post"], url_path="approve")
    def approve(self, request, pk=None):
        update_req = self.get_object()
        if update_req.status != EmployeeUpdateRequest.Status.PENDING:
            return Response(
                {"detail": "Yêu cầu đã được xử lý."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        config = EmployeeConfig.load()
        user = request.user
        if not self._is_approver(user):
            return Response(
                {"detail": "Bạn không có quyền duyệt."},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Apply changes to employee
        employee = update_req.employee
        changes = update_req.changes or {}
        for field, value in changes.items():
            if field == "avatar":
                # Copy temp avatar to employee
                if update_req.avatar_upload:
                    employee.avatar.save(
                        update_req.avatar_upload.name.split("/")[-1],
                        update_req.avatar_upload.file,
                        save=False,
                    )
                continue
            if hasattr(employee, field):
                setattr(employee, field, value)
        employee.save()

        update_req.status = EmployeeUpdateRequest.Status.APPROVED
        update_req.reviewed_by = user
        update_req.review_note = request.data.get("note", "")
        update_req.save()

        # Notify requester
        create_notifications(
            user_ids=[update_req.requested_by_id],
            content=f"Yêu cầu cập nhật thông tin nhân viên của bạn đã được duyệt bởi {user.full_name or user.username}.",
            notification_type="APPROVAL",
        )

        return Response({"detail": "Đã duyệt cập nhật."})

    @action(detail=True, methods=["post"], url_path="reject")
    def reject(self, request, pk=None):
        update_req = self.get_object()
        if update_req.status != EmployeeUpdateRequest.Status.PENDING:
            return Response(
                {"detail": "Yêu cầu đã được xử lý."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        config = EmployeeConfig.load()
        user = request.user
        if not self._is_approver(user):
            return Response(
                {"detail": "Bạn không có quyền từ chối."},
                status=status.HTTP_403_FORBIDDEN,
            )

        note = request.data.get("note", "")
        if not note:
            return Response(
                {"detail": "Vui lòng nhập lý do từ chối."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        requester_id = update_req.requested_by_id
        requester_name = update_req.requested_by.full_name or update_req.requested_by.username

        # Delete temp avatar file if exists
        if update_req.avatar_upload:
            update_req.avatar_upload.delete(save=False)

        # Keep request with REJECTED status so user can see the reason
        update_req.status = EmployeeUpdateRequest.Status.REJECTED
        update_req.reviewed_by = user
        update_req.review_note = note
        update_req.save()

        # Notify requester
        create_notifications(
            user_ids=[requester_id],
            content=f"Yêu cầu cập nhật thông tin nhân viên của bạn đã bị từ chối bởi {user.full_name or user.username}. Lý do: {note}",
            notification_type="APPROVAL",
        )

        return Response({"detail": "Đã từ chối yêu cầu cập nhật."})


class RewardViewSet(viewsets.ModelViewSet):
    """CRUD for employee rewards."""

    serializer_class = RewardSerializer
    permission_classes = [IsAuthenticated]

    def _is_reward_manager(self, user):
        if user.is_superuser:
            return True
        if any(
            r.role.name.lower() == "admin"
            for r in user.user_roles.select_related("role").all()
        ):
            return True
        config = EmployeeConfig.load()
        return config.reward_manager_users.filter(id=user.id).exists()

    def get_queryset(self):
        user = self.request.user
        qs = Reward.objects.select_related(
            "employee__user", "employee__user__department", "department", "created_by"
        )
        # Reward managers see all, normal users see only their own
        if not self._is_reward_manager(user):
            qs = qs.filter(employee__user=user)

        # --- Filters ---
        employee_id = self.request.query_params.get("employee")
        if employee_id:
            qs = qs.filter(employee_id=employee_id)

        # Search by employee name or department name
        search = self.request.query_params.get("search")
        if search:
            qs = qs.filter(
                Q(employee__user__full_name__icontains=search)
                | Q(employee__user__username__icontains=search)
                | Q(reason__icontains=search)
                | Q(department__name__icontains=search)
            )

        # Filter by reward_type
        reward_type = self.request.query_params.get("reward_type")
        if reward_type:
            qs = qs.filter(reward_type=reward_type)

        # Filter by department
        department_id = self.request.query_params.get("department")
        if department_id:
            qs = qs.filter(
                Q(department_id=department_id)
                | Q(employee__user__department_id=department_id)
            )

        # Filter by date range
        date_from = self.request.query_params.get("date_from")
        date_to = self.request.query_params.get("date_to")
        if date_from:
            qs = qs.filter(reward_date__gte=date_from)
        if date_to:
            qs = qs.filter(reward_date__lte=date_to)

        # Filter by visibility
        visible = self.request.query_params.get("visible_on_dashboard")
        if visible is not None and visible != "":
            qs = qs.filter(visible_on_dashboard=visible.lower() in ("true", "1"))

        return qs

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def create(self, request, *args, **kwargs):
        if not self._is_reward_manager(request.user):
            return Response(
                {"detail": "Bạn không có quyền tạo khen thưởng."},
                status=status.HTTP_403_FORBIDDEN,
            )

        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        if not self._is_reward_manager(request.user):
            return Response(
                {"detail": "Bạn không có quyền chỉnh sửa khen thưởng."},
                status=status.HTTP_403_FORBIDDEN,
            )
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        if not self._is_reward_manager(request.user):
            return Response(
                {"detail": "Bạn không có quyền xóa khen thưởng."},
                status=status.HTTP_403_FORBIDDEN,
            )
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=["post"], url_path="toggle-visibility")
    def toggle_visibility(self, request, pk=None):
        """POST /rewards/{id}/toggle-visibility/ — toggle visible_on_dashboard."""
        if not self._is_reward_manager(request.user):
            return Response(
                {"detail": "Bạn không có quyền thực hiện thao tác này."},
                status=status.HTTP_403_FORBIDDEN,
            )
        reward = self.get_object()
        reward.visible_on_dashboard = not reward.visible_on_dashboard
        reward.save(update_fields=["visible_on_dashboard"])
        return Response({
            "id": reward.id,
            "visible_on_dashboard": reward.visible_on_dashboard,
        })

    @action(detail=False, methods=["get"], url_path="recent")
    def recent(self, request):
        """GET /rewards/recent/ — recent rewards for dashboard display."""
        limit = int(request.query_params.get("limit", 20))
        qs = Reward.objects.select_related(
            "employee__user", "employee__user__department", "department"
        ).filter(visible_on_dashboard=True).order_by("-reward_date", "-created_at")[:limit]
        serializer = RewardSerializer(qs, many=True, context={"request": request})
        return Response(serializer.data)

    @action(detail=False, methods=["get"], url_path="check-permission")
    def check_permission(self, request):
        """GET /rewards/check-permission/ — check if current user is reward manager."""
        return Response({"is_reward_manager": self._is_reward_manager(request.user)})
