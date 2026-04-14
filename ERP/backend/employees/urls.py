from django.urls import include, path
from rest_framework.routers import DefaultRouter

from employees.views import EmployeeUpdateRequestViewSet, EmployeeViewSet, RewardViewSet

router = DefaultRouter()
router.register("employees", EmployeeViewSet, basename="employee")
router.register("employee-update-requests", EmployeeUpdateRequestViewSet, basename="employee-update-request")
router.register("rewards", RewardViewSet, basename="reward")

urlpatterns = [
    path("", include(router.urls)),
]
