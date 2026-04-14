from django.conf import settings
from django.db import models


class WorkShift(models.Model):
    """Ca làm việc."""
    SHIFT_TYPES = [
        ('hc', 'Ca hành chính (2 lần chấm)'),
        ('3punch', 'Ca 3 lần chấm'),
        ('4punch', 'Ca 4 lần chấm'),
    ]
    name = models.CharField(max_length=100, unique=True, help_text='Tên ca')
    shift_type = models.CharField(max_length=10, choices=SHIFT_TYPES, default='hc')

    # HC: start + end
    start_time = models.TimeField(help_text='Giờ bắt đầu ca')
    end_time = models.TimeField(help_text='Giờ kết thúc ca')

    # 3-punch: start + mid + end  (mid_time used)
    mid_time = models.TimeField(null=True, blank=True, help_text='Giờ giữa ca (ca 3 lần)')

    # 4-punch: in1, out1, in2, out2  (start=in1, end=out2, mid_time=out1, mid_time2=in2)
    mid_time2 = models.TimeField(null=True, blank=True, help_text='Giờ vào ca 2 (ca 4 lần)')

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']
        verbose_name = 'Ca làm việc'
        verbose_name_plural = 'Ca làm việc'

    def __str__(self):
        return self.name

    @property
    def time_slots(self):
        """Return ordered list of (label, time) for this shift."""
        if self.shift_type == 'hc':
            return [('Vào', self.start_time), ('Ra', self.end_time)]
        elif self.shift_type == '3punch':
            return [('Vào', self.start_time), ('Giữa ca', self.mid_time), ('Ra', self.end_time)]
        else:  # 4punch
            return [
                ('Vào ca 1', self.start_time),
                ('Ra ca 1', self.mid_time),
                ('Vào ca 2', self.mid_time2),
                ('Ra ca 2', self.end_time),
            ]


class Employee(models.Model):
    """Cached employee data from device."""
    uid = models.IntegerField(unique=True, help_text='Internal device UID')
    user_id = models.CharField(max_length=50, unique=True, help_text='User ID on device')
    name = models.CharField(max_length=200)
    privilege = models.IntegerField(default=0)
    group_id = models.CharField(max_length=50, blank=True)
    employee_code = models.CharField(max_length=50, blank=True, null=True, help_text='Mã nhân viên')
    card = models.BigIntegerField(default=0)
    department = models.CharField(max_length=200, blank=True)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=20, blank=True)
    is_active = models.BooleanField(default=True, help_text='Hiển thị trên bảng chấm công')
    shift = models.ForeignKey(
        WorkShift, null=True, blank=True,
        on_delete=models.SET_NULL, related_name='employees',
        help_text='Ca làm việc',
    )
    synced_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']
        verbose_name = 'Nhân viên'
        verbose_name_plural = 'Nhân viên'

    @property
    def display_name(self):
        """Prefer linked user's full_name, fall back to device name."""
        linked = getattr(self, 'linked_user', None)
        if linked and linked.full_name:
            return linked.full_name
        return self.name

    def __str__(self):
        return f"{self.user_id} - {self.name}"


class AttendanceLog(models.Model):
    """Local cache of attendance records pulled from device."""
    PUNCH_CHOICES = [
        (0, 'Vào ca'),
        (1, 'Ra ca'),
        (2, 'Nghỉ giải lao'),
        (3, 'Trở lại'),
        (4, 'Tăng ca vào'),
        (5, 'Tăng ca ra'),
    ]

    user_id = models.CharField(max_length=50, db_index=True)
    employee = models.ForeignKey(
        Employee, null=True, blank=True,
        on_delete=models.SET_NULL, related_name='logs'
    )
    timestamp = models.DateTimeField(db_index=True)
    status = models.IntegerField(default=0)
    punch = models.IntegerField(default=0, choices=PUNCH_CHOICES)
    synced_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-timestamp']
        unique_together = ['user_id', 'timestamp']
        verbose_name = 'Bản ghi chấm công'
        verbose_name_plural = 'Bản ghi chấm công'

    def __str__(self):
        return f"{self.user_id} - {self.timestamp}"


class SyncLog(models.Model):
    """Log of sync operations."""
    STATUS_CHOICES = [
        ('success', 'Thành công'),
        ('failed', 'Thất bại'),
        ('partial', 'Một phần'),
    ]
    started_at = models.DateTimeField(auto_now_add=True)
    finished_at = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES)
    records_synced = models.IntegerField(default=0)
    error_message = models.TextField(blank=True)

    class Meta:
        ordering = ['-started_at']
        verbose_name = 'Lịch sử đồng bộ'
        verbose_name_plural = 'Lịch sử đồng bộ'


class AttendancePermission(models.Model):
    """
    Grant specific attendance page access to a user or an entire department.
    If department is set (user is null), all members of that department get access.
    """
    PAGE_CHOICES = [
        ('dashboard', 'Tổng quan chấm công'),
        ('live', 'Giám sát trực tiếp'),
        ('logs', 'Lịch sử chấm công'),
        ('monthly', 'Bảng chấm công tháng'),
        ('employees', 'Nhân viên chấm công'),
        ('report', 'Báo cáo chấm công'),
        ('device', 'Thiết bị & Cài đặt'),
        ('permissions', 'Phân quyền chấm công'),
        ('shifts', 'Quản lý ca'),
    ]
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True, blank=True,
        on_delete=models.CASCADE,
        related_name='attendance_permissions',
    )
    department = models.ForeignKey(
        'departments.Department',
        null=True, blank=True,
        on_delete=models.CASCADE,
        related_name='attendance_permissions',
    )
    page = models.CharField(max_length=20, choices=PAGE_CHOICES)
    can_view_all = models.BooleanField(
        default=False,
        help_text='Cho phép xem dữ liệu chấm công của tất cả nhân viên',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Phân quyền chấm công'
        verbose_name_plural = 'Phân quyền chấm công'
        constraints = [
            models.CheckConstraint(
                condition=~models.Q(user__isnull=True, department__isnull=True),
                name='attendance_perm_user_or_dept',
            ),
            models.UniqueConstraint(
                fields=('user', 'page'),
                condition=models.Q(user__isnull=False),
                name='attendance_perm_user_page_uniq',
            ),
            models.UniqueConstraint(
                fields=('department', 'page'),
                condition=models.Q(department__isnull=False),
                name='attendance_perm_dept_page_uniq',
            ),
        ]

    def __str__(self):
        target = self.user or self.department
        return f"{target} → {self.get_page_display()}"


class LateEarlyRule(models.Model):
    """Quy tắc đi muộn / về sớm theo từng ca."""
    RULE_TYPE_CHOICES = [
        ('late', 'Đi muộn'),
        ('early', 'Về sớm'),
    ]
    shift = models.ForeignKey(
        WorkShift, on_delete=models.CASCADE,
        related_name='late_early_rules',
    )
    rule_type = models.CharField(max_length=5, choices=RULE_TYPE_CHOICES)
    from_minutes = models.PositiveIntegerField(help_text='Từ (phút)')
    to_minutes = models.PositiveIntegerField(null=True, blank=True, help_text='Đến (phút), null = không giới hạn')
    label = models.CharField(max_length=100, blank=True, help_text='Tên mốc, VD: Muộn 15-30p')

    class Meta:
        ordering = ['shift', 'rule_type', 'from_minutes']
        verbose_name = 'Quy tắc đi muộn / về sớm'
        verbose_name_plural = 'Quy tắc đi muộn / về sớm'

    def __str__(self):
        bound = f'{self.from_minutes}–{self.to_minutes or "∞"}p'
        return f"{self.shift.name} | {self.get_rule_type_display()} {bound}"


class PenaltyConfig(models.Model):
    """Cấu hình tiền phạt theo số lần vi phạm trong tháng."""
    shift = models.ForeignKey(
        WorkShift, on_delete=models.CASCADE,
        related_name='penalty_configs',
    )
    rule_type = models.CharField(max_length=5, choices=LateEarlyRule.RULE_TYPE_CHOICES)
    from_count = models.PositiveIntegerField(help_text='Từ lần thứ')
    to_count = models.PositiveIntegerField(null=True, blank=True, help_text='Đến lần thứ, null = trở lên')
    penalty_amount = models.PositiveIntegerField(default=0, help_text='Số tiền phạt (VNĐ)')

    class Meta:
        ordering = ['shift', 'rule_type', 'from_count']
        verbose_name = 'Cấu hình phạt đi muộn / về sớm'
        verbose_name_plural = 'Cấu hình phạt đi muộn / về sớm'

    def __str__(self):
        bound = f'lần {self.from_count}–{self.to_count or "∞"}'
        return f"{self.shift.name} | {self.get_rule_type_display()} {bound}: {self.penalty_amount:,}đ"


# ── Leave Management ──────────────────────────────────────


class LeaveConfig(models.Model):
    """Singleton – cấu hình cách tính nghỉ phép."""
    CONTRACT_STATUS_CHOICES = [
        ("PROBATION", "Thử việc"),
        ("FIXED_TERM", "HĐ xác định thời hạn"),
        ("INDEFINITE", "HĐ không xác định thời hạn"),
    ]

    start_contract_status = models.CharField(
        "Trạng thái HĐ bắt đầu tính phép",
        max_length=20,
        choices=CONTRACT_STATUS_CHOICES,
        default="FIXED_TERM",
    )
    annual_leave_days = models.PositiveIntegerField(
        "Số ngày phép tối đa/năm", default=12,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Cấu hình nghỉ phép"
        verbose_name_plural = "Cấu hình nghỉ phép"

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)

    @classmethod
    def get_config(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj

    def __str__(self):
        return "Cấu hình nghỉ phép"


class LeaveBalance(models.Model):
    """Per-employee per-year leave balance."""
    employee = models.ForeignKey(
        "employees.Employee",
        on_delete=models.CASCADE,
        related_name="leave_balances",
    )
    year = models.PositiveIntegerField("Năm")
    carried_over_days = models.DecimalField(
        "Ngày phép bảo lưu", max_digits=5, decimal_places=1, default=0,
    )
    used_days = models.DecimalField(
        "Ngày phép đã dùng", max_digits=5, decimal_places=1, default=0,
    )
    note = models.TextField("Ghi chú", blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ["employee", "year"]
        ordering = ["-year"]
        verbose_name = "Số phép nhân viên"
        verbose_name_plural = "Số phép nhân viên"

    def __str__(self):
        return f"{self.employee} – {self.year}"


class LeaveRequestRecord(models.Model):
    """Tracks individual leave request linked to an approval request."""

    class LeaveType(models.TextChoices):
        FULL_DAY = "FULL_DAY", "Nghỉ cả ngày"
        MORNING = "MORNING", "Nghỉ sáng"
        AFTERNOON = "AFTERNOON", "Nghỉ chiều"

    class PaidType(models.TextChoices):
        PAID = "PAID", "Nghỉ có lương"
        UNPAID = "UNPAID", "Nghỉ không lương"

    class Status(models.TextChoices):
        PENDING = "PENDING", "Chờ duyệt"
        APPROVED = "APPROVED", "Đã duyệt"
        REJECTED = "REJECTED", "Từ chối"
        CANCELLED = "CANCELLED", "Đã hủy"

    employee = models.ForeignKey(
        "employees.Employee",
        on_delete=models.CASCADE,
        related_name="leave_requests",
    )
    approval_request = models.ForeignKey(
        "requestsystem.Request",
        on_delete=models.CASCADE,
        related_name="leave_records",
        null=True, blank=True,
    )
    leave_date = models.DateField("Ngày nghỉ")
    leave_type = models.CharField(
        "Loại nghỉ", max_length=20, choices=LeaveType.choices, default=LeaveType.FULL_DAY,
    )
    paid_type = models.CharField(
        "Nghỉ lương/không lương", max_length=10, choices=PaidType.choices, default=PaidType.PAID,
    )
    deducted_days = models.DecimalField(
        "Số ngày trừ phép", max_digits=3, decimal_places=1, default=1,
    )
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.PENDING,
    )
    reason = models.TextField("Lý do", blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-leave_date"]
        verbose_name = "Bản ghi nghỉ phép"
        verbose_name_plural = "Bản ghi nghỉ phép"

    def __str__(self):
        return f"{self.employee} – {self.leave_date} ({self.get_leave_type_display()})"


class OvertimeRecord(models.Model):
    """Tracks individual overtime request linked to an approval request."""

    class Status(models.TextChoices):
        PENDING = "PENDING", "Chờ duyệt"
        APPROVED = "APPROVED", "Đã duyệt"
        REJECTED = "REJECTED", "Từ chối"
        CANCELLED = "CANCELLED", "Đã hủy"

    employee = models.ForeignKey(
        "employees.Employee",
        on_delete=models.CASCADE,
        related_name="overtime_records",
    )
    approval_request = models.ForeignKey(
        "requestsystem.Request",
        on_delete=models.CASCADE,
        related_name="overtime_records",
        null=True, blank=True,
    )
    ot_date = models.DateField("Ngày làm thêm")
    start_time = models.TimeField("Giờ bắt đầu")
    end_time = models.TimeField("Giờ kết thúc")
    ot_hours = models.DecimalField(
        "Số giờ làm thêm", max_digits=4, decimal_places=1, default=0,
    )
    reason = models.TextField("Lý do làm thêm", blank=True)
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.PENDING,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-ot_date"]
        verbose_name = "Bản ghi làm thêm"
        verbose_name_plural = "Bản ghi làm thêm"

    def __str__(self):
        return f"{self.employee} – {self.ot_date} ({self.start_time}~{self.end_time})"


class OffsiteWorkRecord(models.Model):
    """Tracks individual offsite work request linked to an approval request."""

    class WorkType(models.TextChoices):
        FULL_DAY = "FULL_DAY", "Cả ngày"
        MORNING = "MORNING", "Buổi sáng"
        AFTERNOON = "AFTERNOON", "Buổi chiều"

    class Status(models.TextChoices):
        PENDING = "PENDING", "Chờ duyệt"
        APPROVED = "APPROVED", "Đã duyệt"
        REJECTED = "REJECTED", "Từ chối"
        CANCELLED = "CANCELLED", "Đã hủy"

    employee = models.ForeignKey(
        "employees.Employee",
        on_delete=models.CASCADE,
        related_name="offsite_records",
    )
    approval_request = models.ForeignKey(
        "requestsystem.Request",
        on_delete=models.CASCADE,
        related_name="offsite_records",
        null=True, blank=True,
    )
    work_date = models.DateField("Ngày làm việc ngoại viện")
    work_type = models.CharField(
        "Loại", max_length=20, choices=WorkType.choices, default=WorkType.FULL_DAY,
    )
    location = models.CharField("Địa điểm", max_length=255, blank=True)
    reason = models.TextField("Lý do", blank=True)
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.PENDING,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-work_date"]
        verbose_name = "Bản ghi ngoại viện"
        verbose_name_plural = "Bản ghi ngoại viện"

    def __str__(self):
        return f"{self.employee} – {self.work_date} ({self.get_work_type_display()})"
