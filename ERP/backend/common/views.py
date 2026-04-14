from rest_framework import status
from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from common.models import SiteConfig
from common.serializers import SiteConfigSerializer
from rbac.permissions import IsAdminUser


ALLOWED_LOGO_TYPES = {'image/png', 'image/jpeg', 'image/svg+xml', 'image/webp', 'image/x-icon', 'image/vnd.microsoft.icon'}
MAX_LOGO_SIZE = 2 * 1024 * 1024  # 2 MB


class SiteConfigPublicView(APIView):
    """GET public site config (logos) — no auth needed."""
    permission_classes = []
    authentication_classes = []

    def get(self, request):
        configs = SiteConfig.objects.filter(key__in=['login_logo', 'favicon'])
        serializer = SiteConfigSerializer(configs, many=True, context={'request': request})
        result = {item['key']: item for item in serializer.data}
        return Response(result)


class SiteConfigAdminView(APIView):
    """Admin: upload/update logos."""
    permission_classes = [IsAuthenticated, IsAdminUser]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get(self, request):
        configs = SiteConfig.objects.all()
        serializer = SiteConfigSerializer(configs, many=True, context={'request': request})
        return Response(serializer.data)

    def post(self, request):
        key = request.data.get('key')
        if key not in ('login_logo', 'favicon'):
            return Response({'detail': 'Key không hợp lệ. Chỉ hỗ trợ: login_logo, favicon'}, status=status.HTTP_400_BAD_REQUEST)

        image = request.FILES.get('image')
        if not image:
            return Response({'detail': 'Vui lòng chọn file ảnh.'}, status=status.HTTP_400_BAD_REQUEST)

        if image.content_type not in ALLOWED_LOGO_TYPES:
            return Response({'detail': f'Loại file không hợp lệ: {image.content_type}'}, status=status.HTTP_400_BAD_REQUEST)

        if image.size > MAX_LOGO_SIZE:
            return Response({'detail': 'File quá lớn (tối đa 2MB).'}, status=status.HTTP_400_BAD_REQUEST)

        config, _ = SiteConfig.objects.get_or_create(key=key)
        # Delete old file if exists
        if config.image:
            config.image.delete(save=False)
        config.image = image
        config.save()

        serializer = SiteConfigSerializer(config, context={'request': request})
        return Response(serializer.data)
