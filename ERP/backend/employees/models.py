from django.conf import settings
from django.db import models


class Employee(models.Model):
    """Employee profile linked 1:1 with User. Auto-created when admin creates a user."""

    class ContractStatus(models.TextChoices):
        PROBATION = "PROBATION", "Thử việc"
        FIXED_TERM = "FIXED_TERM", "HĐ xác định thời hạn"
        INDEFINITE = "INDEFINITE", "HĐ không xác định thời hạn"

    class WorkStatus(models.TextChoices):
        ACTIVE = "ACTIVE", "Đang làm việc"
        ON_LEAVE = "ON_LEAVE", "Tạm nghỉ"
        RESIGNED = "RESIGNED", "Đã nghỉ"

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="employee_profile",
    )

    # Basic info
    avatar = models.ImageField(upload_to="employee_avatars/", blank=True, null=True)
    phone = models.CharField("Số điện thoại", max_length=20, blank=True)
    id_card_number = models.CharField("Số căn cước", max_length=30, blank=True)
    date_of_birth = models.DateField("Ngày sinh", null=True, blank=True)
    email = models.EmailField("Email", blank=True)

    # Address
    address_village = models.CharField("Thôn/Xóm", max_length=255, blank=True)
    address_commune = models.CharField("Xã/Phường", max_length=255, blank=True)
    address_district = models.CharField("Quận/Huyện", max_length=255, blank=True)
    address_province = models.CharField("Tỉnh/Thành phố", max_length=255, blank=True)

    # Bank
    bank_account_number = models.CharField("Số tài khoản", max_length=50, blank=True)
    bank_account_name = models.CharField("Tên chủ TK", max_length=255, blank=True)
    bank_name = models.CharField("Tên ngân hàng", max_length=255, blank=True)

    # Employment
    date_joined_company = models.DateField("Ngày vào làm", null=True, blank=True)
    date_contract_signed = models.DateField("Ngày ký HĐ chính thức", null=True, blank=True)
    contract_start = models.DateField("Ngày bắt đầu HĐ", null=True, blank=True)
    contract_end = models.DateField("Ngày kết thúc HĐ", null=True, blank=True)
    contract_status = models.CharField(
        "Trạng thái hợp đồng",
        max_length=20,
        choices=ContractStatus.choices,
        default=ContractStatus.PROBATION,
        blank=True,
    )
    work_status = models.CharField(
        "Trạng thái làm việc",
        max_length=20,
        choices=WorkStatus.choices,
        default=WorkStatus.ACTIVE,
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "employees"
        ordering = ["user__username"]
        indexes = [
            models.Index(fields=["work_status"]),
            models.Index(fields=["contract_status"]),
        ]

    def __str__(self):
        return f"{self.user.full_name or self.user.username}"


class EmployeeUpdateRequest(models.Model):
    """Stores pending update requests from users for their own employee profile."""

    class Status(models.TextChoices):
        PENDING = "PENDING", "Chờ duyệt"
        APPROVED = "APPROVED", "Đã duyệt"
        REJECTED = "REJECTED", "Từ chối"

    employee = models.ForeignKey(
        Employee,
        on_delete=models.CASCADE,
        related_name="update_requests",
    )
    requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="employee_update_requests",
    )
    changes = models.JSONField(
        "Dữ liệu thay đổi",
        help_text="JSON dict of field_name: new_value",
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
    )
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="reviewed_employee_updates",
    )
    review_note = models.TextField("Ghi chú duyệt", blank=True)
    avatar_upload = models.ImageField(
        "Ảnh đại diện tạm",
        upload_to="employee_update_avatars/",
        blank=True,
        null=True,
        help_text="Ảnh đại diện chờ duyệt (tạm thời)",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "employee_update_requests"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status"]),
            models.Index(fields=["employee", "status"]),
        ]

    def __str__(self):
        return f"Update request #{self.pk} by {self.requested_by} – {self.status}"


class EmployeeConfig(models.Model):
    """Singleton config: who can edit all employees, who approves profile updates."""

    editor_users = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        blank=True,
        related_name="employee_editor_configs",
        help_text="Users được phép chỉnh sửa thông tin tất cả nhân viên",
    )
    approver_users = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        blank=True,
        related_name="employee_approver_configs",
        help_text="Users duyệt yêu cầu cập nhật thông tin nhân viên",
    )
    reward_manager_users = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        blank=True,
        related_name="employee_reward_manager_configs",
        help_text="Users được phép quản lý khen thưởng nhân viên",
    )

    # ── Forced profile update ──
    force_profile_update = models.BooleanField(
        "Bắt buộc cập nhật thông tin",
        default=False,
        help_text="Nếu bật, người dùng phải cập nhật các trường trống được chỉ định trước khi truy cập hệ thống.",
    )
    required_fields = models.JSONField(
        "Trường bắt buộc",
        default=list,
        blank=True,
        help_text="Danh sách field_name bắt buộc phải có dữ liệu. Ví dụ: ['phone','date_of_birth','avatar']",
    )

    class Meta:
        db_table = "employee_config"
        verbose_name = "Cấu hình quản lý nhân viên"
        verbose_name_plural = "Cấu hình quản lý nhân viên"

    def __str__(self):
        return "Employee Config"

    def save(self, *args, **kwargs):
        # Singleton: always use pk=1
        self.pk = 1
        super().save(*args, **kwargs)

    @classmethod
    def load(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj


class Reward(models.Model):
    """Khen thưởng nhân viên."""

    class RewardType(models.TextChoices):
        CASH = "CASH", "Tiền mặt"
        GIFT = "GIFT", "Hiện vật"

    employee = models.ForeignKey(
        Employee,
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="rewards",
        verbose_name="Nhân viên",
    )
    department = models.ForeignKey(
        "departments.Department",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="rewards",
        verbose_name="Phòng khen thưởng",
    )
    reason = models.TextField("Lý do khen thưởng")
    reward_type = models.CharField(
        "Hình thức thưởng",
        max_length=10,
        choices=RewardType.choices,
        default=RewardType.CASH,
    )
    reward_detail = models.TextField("Chi tiết thưởng", blank=True)
    reward_date = models.DateField("Thời gian khen thưởng")
    visible_on_dashboard = models.BooleanField(
        "Hiển thị trên Dashboard",
        default=True,
        help_text="Nếu tắt, khen thưởng này sẽ không hiển thị ở mục Khen thưởng gần đây trên Dashboard.",
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="created_rewards",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "employee_rewards"
        ordering = ["-reward_date", "-created_at"]
        indexes = [
            models.Index(fields=["reward_date"]),
            models.Index(fields=["employee"]),
        ]

    def __str__(self):
        if self.employee:
            return f"Khen thưởng {self.employee} - {self.reward_date}"
        return f"Khen thưởng phòng {self.department} - {self.reward_date}"
