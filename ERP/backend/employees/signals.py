from django.conf import settings
from django.db.models.signals import post_save
from django.dispatch import receiver


@receiver(post_save, sender=settings.AUTH_USER_MODEL)
def create_employee_profile(sender, instance, created, **kwargs):
    """Auto-create Employee profile when a User is created."""
    from employees.models import Employee

    if created:
        Employee.objects.get_or_create(user=instance)
