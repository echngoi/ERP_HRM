"""
Backfill missing Employee profiles for all existing Users.

Usage:
    python manage.py backfill_employees
"""
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

from employees.models import Employee

User = get_user_model()


class Command(BaseCommand):
    help = "Create missing Employee profiles for Users that don't have one."

    def handle(self, *args, **options):
        users_without_profile = User.objects.filter(employee_profile__isnull=True)
        count = users_without_profile.count()

        if count == 0:
            self.stdout.write(self.style.SUCCESS("All users already have Employee profiles."))
            return

        self.stdout.write(f"Found {count} users without Employee profiles. Creating...")

        created = 0
        for user in users_without_profile.iterator():
            Employee.objects.get_or_create(user=user)
            created += 1

        self.stdout.write(self.style.SUCCESS(f"Done. Created {created} Employee profiles."))
