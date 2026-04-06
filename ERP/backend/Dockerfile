# ============================================================
# ERP Backend — Dockerfile
# Python 3.12 + Daphne (ASGI) + Django 6
# ============================================================
FROM python:3.12-slim

# Tránh Python tạo .pyc và buffered output
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Cài system dependencies (psycopg2, Pillow, Twisted cần)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev libjpeg62-turbo-dev zlib1g-dev \
    && rm -rf /var/lib/apt/lists/*

# Cài Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy code
COPY . .

# Thu thập static files (cần thiết cho Django Admin)
RUN python manage.py collectstatic --noinput 2>/dev/null || true

# Tạo thư mục media
RUN mkdir -p /app/media

EXPOSE 8000

# Chạy Daphne (ASGI — hỗ trợ HTTP + WebSocket)
CMD ["daphne", "-b", "0.0.0.0", "-p", "8000", "--proxy-headers", "config.asgi:application"]
