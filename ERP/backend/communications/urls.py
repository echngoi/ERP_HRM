from django.urls import include, path
from rest_framework.routers import DefaultRouter

from communications.views import AnnouncementViewSet, CustomGroupViewSet, FooterItemViewSet, MessageViewSet

router = DefaultRouter()
router.register("groups", CustomGroupViewSet, basename="group")
router.register("messages", MessageViewSet, basename="message")
router.register("announcements", AnnouncementViewSet, basename="announcement")
router.register("footer-items", FooterItemViewSet, basename="footer-item")

urlpatterns = [
    path("", include(router.urls)),
]
