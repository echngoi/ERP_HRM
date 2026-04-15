from rest_framework import serializers
from common.models import SiteConfig


class TimestampedModelSerializer(serializers.ModelSerializer):
    """Auto-mark created_at/updated_at as read-only when present."""

    timestamp_read_only_fields = ("created_at", "updated_at")

    def get_fields(self):
        fields = super().get_fields()
        for name in self.timestamp_read_only_fields:
            if name in fields:
                fields[name].read_only = True
        return fields


class SiteConfigSerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField()

    class Meta:
        model = SiteConfig
        fields = ['key', 'value', 'image', 'image_url', 'updated_at']
        read_only_fields = ['updated_at']

    def get_image_url(self, obj):
        if obj.image:
            return obj.image.url
        return None
