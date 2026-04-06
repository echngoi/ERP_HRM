#!/bin/bash
# ============================================================
# ERP Docker — First-time setup & migration script
# Chạy sau docker compose up lần đầu
# ============================================================
set -e

echo "=== ERP Docker Init ==="

echo "[1/3] Running migrations..."
docker compose exec backend python manage.py migrate --noinput

echo "[2/3] Collecting static files..."
docker compose exec backend python manage.py collectstatic --noinput --clear

echo "[3/3] Creating superuser..."
echo "Nhập thông tin tài khoản admin:"
docker compose exec -it backend python manage.py createsuperuser

echo ""
echo "=== HOÀN TẤT! ==="
echo "Truy cập: http://localhost hoặc http://192.168.1.100"
