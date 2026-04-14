# Generated — removes employee_code field that was added in 0006 but removed from the model.

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0006_user_employee_code'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='user',
            name='employee_code',
        ),
    ]
