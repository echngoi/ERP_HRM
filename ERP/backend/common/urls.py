from django.urls import path
from common.views import SiteConfigPublicView, SiteConfigAdminView

urlpatterns = [
    path('site-config/', SiteConfigPublicView.as_view(), name='site-config-public'),
    path('site-config/admin/', SiteConfigAdminView.as_view(), name='site-config-admin'),
]
