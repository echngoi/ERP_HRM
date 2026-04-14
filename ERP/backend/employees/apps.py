from django.apps import AppConfig


class EmployeesConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'employees'
    verbose_name = 'Quản lý nhân viên'

    def ready(self):
        import employees.signals  # noqa: F401
