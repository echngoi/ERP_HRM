#!/bin/bash
# ============================================================
# ERP Deploy Script — Cập nhật code & restart services
# Chạy: bash /opt/erp/deploy/deploy.sh
# ============================================================
set -e

PROJECT_DIR="/opt/erp"
BACKEND_DIR="$PROJECT_DIR/backend"
FRONTEND_DIR="$PROJECT_DIR/frontend"

echo "========================================"
echo "  ERP DEPLOY — $(date '+%Y-%m-%d %H:%M:%S')"
echo "========================================"

# 1. Pull code mới
echo ""
echo "[1/6] Pulling latest code..."
cd "$PROJECT_DIR"
git pull origin main

# 2. Backend dependencies
echo ""
echo "[2/6] Updating backend dependencies..."
cd "$BACKEND_DIR"
source venv/bin/activate
pip install -r requirements.txt --quiet

# 3. Database migrations
echo ""
echo "[3/6] Running migrations..."
python manage.py migrate --noinput

# 4. Collect static files
echo ""
echo "[4/6] Collecting static files..."
python manage.py collectstatic --noinput --clear

# 5. Frontend build
echo ""
echo "[5/6] Building frontend..."
cd "$FRONTEND_DIR"
npm install --silent
npm run build

# 6. Restart backend
echo ""
echo "[6/6] Restarting backend service..."
sudo systemctl restart erp-backend

echo ""
echo "========================================"
echo "  DEPLOY THANH CONG!"
echo "  $(date '+%Y-%m-%d %H:%M:%S')"
echo "========================================"
