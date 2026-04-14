from django.contrib import admin

from employees.models import Employee, EmployeeConfig, EmployeeUpdateRequest, Reward


@admin.register(Employee)
class EmployeeAdmin(admin.ModelAdmin):
    list_display = ["user", "phone", "work_status", "contract_status", "date_joined_company"]
    list_filter = ["work_status", "contract_status"]
    search_fields = ["user__username", "user__full_name", "phone", "id_card_number"]
    raw_id_fields = ["user"]


@admin.register(EmployeeUpdateRequest)
class EmployeeUpdateRequestAdmin(admin.ModelAdmin):
    list_display = ["id", "employee", "requested_by", "status", "reviewed_by", "created_at"]
    list_filter = ["status"]
    raw_id_fields = ["employee", "requested_by", "reviewed_by"]


@admin.register(EmployeeConfig)
class EmployeeConfigAdmin(admin.ModelAdmin):
    list_display = ["__str__"]
    filter_horizontal = ["editor_users", "approver_users", "reward_manager_users"]

    def has_add_permission(self, request):
        return not EmployeeConfig.objects.exists()

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(Reward)
class RewardAdmin(admin.ModelAdmin):
    list_display = ["employee", "reason", "reward_type", "reward_date", "created_by", "created_at"]
    list_filter = ["reward_type", "reward_date"]
    search_fields = ["employee__user__full_name", "employee__user__username", "reason"]
    raw_id_fields = ["employee", "created_by"]
