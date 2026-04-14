import os
from django.db import models


def logo_upload_path(instance, filename):
    ext = os.path.splitext(filename)[1].lower()
    return f"site/{instance.key}{ext}"


class SiteConfig(models.Model):
    """Key-value site configuration. Singleton-per-key pattern."""
    key = models.CharField(max_length=50, unique=True)
    value = models.TextField(blank=True, default="")
    image = models.ImageField(upload_to=logo_upload_path, blank=True, null=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "site_config"

    def __str__(self):
        return self.key
