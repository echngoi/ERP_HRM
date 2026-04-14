from rest_framework import serializers

from employees.models import Employee, EmployeeConfig, EmployeeUpdateRequest, Reward
from users.models import User


class EmployeeSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True)
    full_name = serializers.CharField(source="user.full_name", read_only=True)
    position = serializers.CharField(source="user.position", read_only=True)
    department_name = serializers.SerializerMethodField()
    avatar_url = serializers.SerializerMethodField()

    class Meta:
        model = Employee
        fields = [
            "id",
            "user_id",
            "username",
            "full_name",
            "position",
            "department_name",
            "avatar",
            "avatar_url",
            "phone",
            "id_card_number",
            "date_of_birth",
            "email",
            "address_village",
            "address_commune",
            "address_district",
            "address_province",
            "bank_account_number",
            "bank_account_name",
            "bank_name",
            "date_joined_company",
            "date_contract_signed",
            "contract_start",
            "contract_end",
            "contract_status",
            "work_status",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "user_id", "created_at", "updated_at"]

    def get_department_name(self, obj):
        dept = obj.user.department
        return dept.name if dept else ""

    def get_avatar_url(self, obj):
        if obj.avatar:
            request = self.context.get("request")
            if request:
                return request.build_absolute_uri(obj.avatar.url)
            return obj.avatar.url
        return None


class EmployeeUpdateSerializer(serializers.ModelSerializer):
    """For editor/admin full update of employee fields."""

    class Meta:
        model = Employee
        fields = [
            "phone",
            "id_card_number",
            "date_of_birth",
            "email",
            "address_village",
            "address_commune",
            "address_district",
            "address_province",
            "bank_account_number",
            "bank_account_name",
            "bank_name",
            "date_joined_company",
            "date_contract_signed",
            "contract_start",
            "contract_end",
            "contract_status",
            "work_status",
            "avatar",
        ]


class EmployeeUpdateRequestSerializer(serializers.ModelSerializer):
    requested_by_name = serializers.CharField(source="requested_by.full_name", read_only=True)
    requested_by_username = serializers.CharField(source="requested_by.username", read_only=True)
    requested_by_avatar_url = serializers.SerializerMethodField()
    employee_name = serializers.SerializerMethodField()
    reviewed_by_name = serializers.SerializerMethodField()
    avatar_upload_url = serializers.SerializerMethodField()

    class Meta:
        model = EmployeeUpdateRequest
        fields = [
            "id",
            "employee",
            "employee_name",
            "requested_by",
            "requested_by_name",
            "requested_by_username",
            "requested_by_avatar_url",
            "changes",
            "status",
            "reviewed_by",
            "reviewed_by_name",
            "review_note",
            "avatar_upload_url",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "requested_by",
            "status",
            "reviewed_by",
            "review_note",
            "created_at",
            "updated_at",
        ]

    def get_employee_name(self, obj):
        return obj.employee.user.full_name or obj.employee.user.username

    def get_requested_by_avatar_url(self, obj):
        profile = getattr(obj.requested_by, "employee_profile", None)
        if profile and profile.avatar:
            request = self.context.get("request")
            if request:
                return request.build_absolute_uri(profile.avatar.url)
            return profile.avatar.url
        return None

    def get_reviewed_by_name(self, obj):
        if obj.reviewed_by:
            return obj.reviewed_by.full_name or obj.reviewed_by.username
        return None

    def get_avatar_upload_url(self, obj):
        if obj.avatar_upload:
            request = self.context.get("request")
            if request:
                return request.build_absolute_uri(obj.avatar_upload.url)
            return obj.avatar_upload.url
        return None


class EmployeeConfigSerializer(serializers.ModelSerializer):
    editor_users = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.filter(is_active=True), many=True, required=False
    )
    approver_users = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.filter(is_active=True), many=True, required=False
    )
    reward_manager_users = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.filter(is_active=True), many=True, required=False
    )
    editor_users_detail = serializers.SerializerMethodField()
    approver_users_detail = serializers.SerializerMethodField()
    reward_manager_users_detail = serializers.SerializerMethodField()

    class Meta:
        model = EmployeeConfig
        fields = [
            "editor_users",
            "editor_users_detail",
            "approver_users",
            "approver_users_detail",
            "reward_manager_users",
            "reward_manager_users_detail",
            "force_profile_update",
            "required_fields",
        ]

    def get_editor_users_detail(self, obj):
        return [
            {"id": u.id, "username": u.username, "full_name": u.full_name or u.username}
            for u in obj.editor_users.all()
        ]

    def get_approver_users_detail(self, obj):
        return [
            {"id": u.id, "username": u.username, "full_name": u.full_name or u.username}
            for u in obj.approver_users.all()
        ]

    def get_reward_manager_users_detail(self, obj):
        return [
            {"id": u.id, "username": u.username, "full_name": u.full_name or u.username}
            for u in obj.reward_manager_users.all()
        ]


class RewardSerializer(serializers.ModelSerializer):
    employee_name = serializers.SerializerMethodField()
    employee_avatar_url = serializers.SerializerMethodField()
    department_name = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()
    reward_type_display = serializers.CharField(source="get_reward_type_display", read_only=True)
    is_department_reward = serializers.SerializerMethodField()

    class Meta:
        model = Reward
        fields = [
            "id",
            "employee",
            "employee_name",
            "employee_avatar_url",
            "department",
            "department_name",
            "is_department_reward",
            "reason",
            "reward_type",
            "reward_type_display",
            "reward_detail",
            "reward_date",
            "visible_on_dashboard",
            "created_by",
            "created_by_name",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_by", "created_at", "updated_at"]

    def get_employee_name(self, obj):
        if obj.employee:
            return obj.employee.user.full_name or obj.employee.user.username
        return None

    def get_employee_avatar_url(self, obj):
        if obj.employee and obj.employee.avatar:
            request = self.context.get("request")
            if request:
                return request.build_absolute_uri(obj.employee.avatar.url)
            return obj.employee.avatar.url
        return None

    def get_department_name(self, obj):
        if obj.department:
            return obj.department.name
        if obj.employee:
            dept = obj.employee.user.department
            return dept.name if dept else ""
        return ""

    def get_is_department_reward(self, obj):
        return obj.employee is None and obj.department is not None

    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.full_name or obj.created_by.username
        return None


class BirthdayEmployeeSerializer(serializers.ModelSerializer):
    """Lightweight serializer for birthday display on dashboard."""
    full_name = serializers.CharField(source="user.full_name", read_only=True)
    username = serializers.CharField(source="user.username", read_only=True)
    department_name = serializers.SerializerMethodField()
    avatar_url = serializers.SerializerMethodField()

    class Meta:
        model = Employee
        fields = [
            "id",
            "full_name",
            "username",
            "department_name",
            "avatar_url",
            "date_of_birth",
        ]

    def get_department_name(self, obj):
        dept = obj.user.department
        return dept.name if dept else ""

    def get_avatar_url(self, obj):
        if obj.avatar:
            request = self.context.get("request")
            if request:
                return request.build_absolute_uri(obj.avatar.url)
            return obj.avatar.url
        return None
