# Generated manually for extended page keys + dedupe + partial unique constraints

from collections import defaultdict

from django.db import migrations, models


def dedupe_attendance_permissions(apps, schema_editor):
    AttendancePermission = apps.get_model('attendance', 'AttendancePermission')
    groups = defaultdict(list)
    for p in AttendancePermission.objects.all().order_by('id'):
        key = (p.user_id, p.department_id, p.page)
        groups[key].append(p.pk)
    for _key, pks in groups.items():
        for pk in pks[1:]:
            AttendancePermission.objects.filter(pk=pk).delete()


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('attendance', '0006_late_early_rules_and_penalties'),
    ]

    operations = [
        migrations.RunPython(dedupe_attendance_permissions, noop_reverse),
        migrations.AlterField(
            model_name='attendancepermission',
            name='page',
            field=models.CharField(
                choices=[
                    ('dashboard', 'Tổng quan chấm công'),
                    ('live', 'Giám sát trực tiếp'),
                    ('logs', 'Lịch sử chấm công'),
                    ('monthly', 'Bảng chấm công tháng'),
                    ('employees', 'Nhân viên chấm công'),
                    ('report', 'Báo cáo chấm công'),
                    ('device', 'Thiết bị & Cài đặt'),
                    ('permissions', 'Phân quyền chấm công'),
                    ('shifts', 'Quản lý ca'),
                ],
                max_length=20,
            ),
        ),
        migrations.AddConstraint(
            model_name='attendancepermission',
            constraint=models.UniqueConstraint(
                condition=models.Q(user__isnull=False),
                fields=('user', 'page'),
                name='attendance_perm_user_page_uniq',
            ),
        ),
        migrations.AddConstraint(
            model_name='attendancepermission',
            constraint=models.UniqueConstraint(
                condition=models.Q(department__isnull=False),
                fields=('department', 'page'),
                name='attendance_perm_dept_page_uniq',
            ),
        ),
    ]
