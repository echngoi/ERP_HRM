from django.conf import settings
from django.core.validators import RegexValidator
from django.db import models
from django.db.models import Q
from django.utils import timezone


class MessageQuerySet(models.QuerySet):
	def inbox_for_user(self, user):
		return self.filter(Q(recipients__user=user) | Q(sender=user)).distinct()

	def sent_by_user(self, user):
		return self.filter(sender=user)

	def important(self):
		return self.filter(is_important=True)

	def thread_only(self):
		return self.filter(parent__isnull=False)

	def root_only(self):
		return self.filter(parent__isnull=True)

	def for_related_request(self, request_id):
		return self.filter(related_request_id=request_id)

	def search_keyword(self, keyword):
		return self.filter(Q(subject__icontains=keyword) | Q(content__icontains=keyword))


class MessageRecipientQuerySet(models.QuerySet):
	def for_user(self, user):
		return self.filter(user=user)

	def unread(self):
		return self.filter(is_read=False)

	def read(self):
		return self.filter(is_read=True)

	def important(self):
		return self.filter(is_important=True)

	def for_message(self, message):
		return self.filter(message=message)

	def mark_all_as_read(self):
		now = timezone.now()
		return self.filter(is_read=False).update(is_read=True, read_at=now, updated_at=now)


class Message(models.Model):
	objects = MessageQuerySet.as_manager()

	subject = models.CharField(max_length=255)
	content = models.TextField()
	sender = models.ForeignKey(
		settings.AUTH_USER_MODEL,
		on_delete=models.PROTECT,
		related_name="sent_messages",
	)
	is_important = models.BooleanField(default=False)
	related_request = models.ForeignKey(
		"requestsystem.Request",
		null=True,
		blank=True,
		on_delete=models.SET_NULL,
		related_name="messages",
	)
	parent = models.ForeignKey(
		"self",
		null=True,
		blank=True,
		on_delete=models.CASCADE,
		related_name="replies",
	)
	created_at = models.DateTimeField(auto_now_add=True)
	updated_at = models.DateTimeField(auto_now=True)

	class Meta:
		db_table = "messages"
		indexes = [
			models.Index(fields=["sender", "created_at"]),
			models.Index(fields=["related_request"]),
			models.Index(fields=["parent"]),
			models.Index(fields=["is_important"]),
		]

	def __str__(self) -> str:
		return self.subject

	def is_reply(self) -> bool:
		return self.parent_id is not None

	def get_thread_root(self):
		message = self
		while message.parent_id:
			message = message.parent
		return message

	def add_recipient(self, user, recipient_type=None):
		if recipient_type is None:
			recipient_type = MessageRecipient.RecipientType.TO

		recipient, _ = MessageRecipient.objects.get_or_create(
			message=self,
			user=user,
			defaults={"type": recipient_type},
		)
		return recipient

	def mark_read_for(self, user):
		recipient = self.recipients.filter(user=user).first()
		if not recipient:
			return False

		recipient.mark_as_read()
		return True

	def unread_count(self) -> int:
		return self.recipients.filter(is_read=False).count()

	def read_count(self) -> int:
		return self.recipients.filter(is_read=True).count()


class MessageRecipient(models.Model):
	objects = MessageRecipientQuerySet.as_manager()

	class RecipientType(models.TextChoices):
		TO = "TO", "To"
		CC = "CC", "Cc"
		BCC = "BCC", "Bcc"

	message = models.ForeignKey(
		Message,
		on_delete=models.CASCADE,
		related_name="recipients",
	)
	user = models.ForeignKey(
		settings.AUTH_USER_MODEL,
		on_delete=models.CASCADE,
		related_name="message_recipients",
	)
	type = models.CharField(max_length=10, choices=RecipientType.choices, default=RecipientType.TO)
	is_read = models.BooleanField(default=False)
	is_important = models.BooleanField(default=False)
	read_at = models.DateTimeField(null=True, blank=True)
	created_at = models.DateTimeField(auto_now_add=True)
	updated_at = models.DateTimeField(auto_now=True)

	class Meta:
		db_table = "message_recipients"
		constraints = [
			models.UniqueConstraint(fields=["message", "user"], name="uniq_message_user_recipient"),
		]
		indexes = [
			models.Index(fields=["message", "type"]),
			models.Index(fields=["user", "is_read"]),
			models.Index(fields=["user", "is_important"]),
			models.Index(fields=["read_at"]),
		]

	def __str__(self) -> str:
		return f"{self.message_id} -> {self.user_id} ({self.type})"

	def mark_as_read(self, save=True):
		if self.is_read:
			return self

		self.is_read = True
		self.read_at = timezone.now()
		if save:
			self.save(update_fields=["is_read", "read_at", "updated_at"])
		return self

	def mark_as_unread(self, save=True):
		if not self.is_read and self.read_at is None:
			return self

		self.is_read = False
		self.read_at = None
		if save:
			self.save(update_fields=["is_read", "read_at", "updated_at"])
		return self


class MessageTarget(models.Model):
	class TargetType(models.TextChoices):
		USER = "USER", "User"
		DEPARTMENT = "DEPARTMENT", "Department"
		GROUP = "GROUP", "Group"

	message = models.ForeignKey(
		Message,
		on_delete=models.CASCADE,
		related_name="targets",
	)
	target_type = models.CharField(max_length=20, choices=TargetType.choices)
	target_id = models.PositiveBigIntegerField()
	created_at = models.DateTimeField(auto_now_add=True)
	updated_at = models.DateTimeField(auto_now=True)

	class Meta:
		db_table = "message_targets"
		indexes = [
			models.Index(fields=["message"]),
			models.Index(fields=["target_type", "target_id"]),
		]

	def __str__(self) -> str:
		return f"{self.message_id} -> {self.target_type}:{self.target_id}"


class CustomGroup(models.Model):
	name = models.CharField(max_length=255)
	created_by = models.ForeignKey(
		settings.AUTH_USER_MODEL,
		on_delete=models.PROTECT,
		related_name="custom_groups",
	)
	created_at = models.DateTimeField(auto_now_add=True)
	updated_at = models.DateTimeField(auto_now=True)

	class Meta:
		db_table = "custom_groups"
		indexes = [
			models.Index(fields=["created_by"]),
			models.Index(fields=["name"]),
		]

	def __str__(self) -> str:
		return self.name


class CustomGroupMember(models.Model):
	group = models.ForeignKey(
		CustomGroup,
		on_delete=models.CASCADE,
		related_name="members",
	)
	user = models.ForeignKey(
		settings.AUTH_USER_MODEL,
		on_delete=models.CASCADE,
		related_name="custom_group_memberships",
	)
	created_at = models.DateTimeField(auto_now_add=True)
	updated_at = models.DateTimeField(auto_now=True)

	class Meta:
		db_table = "custom_group_members"
		constraints = [
			models.UniqueConstraint(fields=["group", "user"], name="uniq_custom_group_member"),
		]
		indexes = [
			models.Index(fields=["group"]),
			models.Index(fields=["user"]),
		]

	def __str__(self) -> str:
		return f"{self.group_id} -> {self.user_id}"


class MessageAttachment(models.Model):
	message = models.ForeignKey(
		Message,
		on_delete=models.CASCADE,
		related_name="attachments",
	)
	file_url = models.URLField(max_length=2048)
	file_name = models.CharField(max_length=255, blank=True, default="")
	file_size = models.PositiveBigIntegerField(null=True, blank=True)
	mime_type = models.CharField(max_length=100, blank=True, default="")
	created_at = models.DateTimeField(auto_now_add=True)
	updated_at = models.DateTimeField(auto_now=True)

	class Meta:
		db_table = "message_attachments"
		indexes = [models.Index(fields=["message"])]

	def __str__(self) -> str:
		return self.file_name or self.file_url


hex_color_validator = RegexValidator(
	regex=r'^#[0-9a-fA-F]{6}$',
	message='Mã màu phải có dạng #RRGGBB',
)


class Announcement(models.Model):
	content = models.TextField("Nội dung")
	is_active = models.BooleanField("Đang hiển thị", default=True)
	start_date = models.DateTimeField("Bắt đầu hiển thị", null=True, blank=True)
	end_date = models.DateTimeField("Kết thúc hiển thị", null=True, blank=True)
	font_family = models.CharField("Font chữ", max_length=100, default="inherit")
	font_size = models.PositiveSmallIntegerField("Cỡ chữ (px)", default=14)
	text_color = models.CharField("Màu chữ", max_length=7, default="#ffffff", validators=[hex_color_validator])
	bg_color = models.CharField("Màu nền", max_length=7, default="#1677ff", validators=[hex_color_validator])
	speed = models.PositiveSmallIntegerField("Tốc độ (giây)", default=20, help_text="Thời gian chạy hết 1 vòng")
	priority = models.PositiveSmallIntegerField("Thứ tự ưu tiên", default=0)
	created_by = models.ForeignKey(
		settings.AUTH_USER_MODEL,
		on_delete=models.SET_NULL,
		null=True,
		blank=True,
		related_name="announcements",
	)
	created_at = models.DateTimeField(auto_now_add=True)
	updated_at = models.DateTimeField(auto_now=True)

	class Meta:
		db_table = "announcements"
		ordering = ["-priority", "-created_at"]

	def __str__(self):
		return self.content[:80]


class FooterItem(models.Model):
	class Section(models.TextChoices):
		CONTACT = "CONTACT", "Thông tin liên hệ"
		COPYRIGHT = "COPYRIGHT", "Bản quyền"
		SOCIAL = "SOCIAL", "Mạng xã hội"
		PARTNER = "PARTNER", "Đối tác"
		CERTIFICATION = "CERTIFICATION", "Chứng nhận"

	section = models.CharField("Phân loại", max_length=20, choices=Section.choices)
	label = models.CharField("Nhãn", max_length=200)
	value = models.TextField("Giá trị (URL/text)", blank=True, default="")
	icon = models.CharField("Icon (tên Ant icon)", max_length=100, blank=True, default="")
	image_url = models.URLField("Ảnh/Logo URL", max_length=500, blank=True, default="")
	is_active = models.BooleanField("Hiển thị", default=True)
	sort_order = models.PositiveSmallIntegerField("Thứ tự", default=0)
	created_at = models.DateTimeField(auto_now_add=True)
	updated_at = models.DateTimeField(auto_now=True)

	class Meta:
		db_table = "footer_items"
		ordering = ["section", "sort_order", "id"]

	def __str__(self):
		return f"[{self.section}] {self.label}"
