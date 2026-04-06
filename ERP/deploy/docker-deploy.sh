#!/bin/bash
# ============================================================
# ERP Docker Deploy — Git Pull + Auto Build + Restart
# Dùng trên máy chủ production (WSL 2 / Linux)
#
# Chạy thủ công:  bash /opt/erp/deploy/docker-deploy.sh
# Webhook tự gọi: xem erp-autodeploy.service
# ============================================================
set -euo pipefail

PROJECT_DIR="/opt/erp"
LOG_FILE="$PROJECT_DIR/deploy/deploy.log"
LOCK_FILE="/tmp/erp-deploy.lock"
BRANCH="${1:-main}"

# ── Hàm log ──
log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# ── Lock: tránh chạy song song ──
if [ -f "$LOCK_FILE" ]; then
  log "SKIP: Deploy đang chạy (lock file tồn tại: $LOCK_FILE)"
  exit 0
fi
trap "rm -f $LOCK_FILE" EXIT
touch "$LOCK_FILE"

log "========================================"
log "  ERP DOCKER DEPLOY — START"
log "========================================"

cd "$PROJECT_DIR"

# ── 1. Git Pull ──
log "[1/5] Git pull origin $BRANCH..."
OLD_COMMIT=$(git rev-parse HEAD)
git fetch origin "$BRANCH"
git reset --hard "origin/$BRANCH"
NEW_COMMIT=$(git rev-parse HEAD)

if [ "$OLD_COMMIT" = "$NEW_COMMIT" ]; then
  log "Không có thay đổi. Bỏ qua deploy."
  exit 0
fi

log "Commit: $OLD_COMMIT → $NEW_COMMIT"

# ── 2. Detect thay đổi ──
CHANGED_FILES=$(git diff --name-only "$OLD_COMMIT" "$NEW_COMMIT")
log "Files thay đổi:"
echo "$CHANGED_FILES" | tee -a "$LOG_FILE"

BUILD_BACKEND=false
BUILD_FRONTEND=false
RUN_MIGRATE=false

if echo "$CHANGED_FILES" | grep -q "^backend/"; then
  BUILD_BACKEND=true
fi
if echo "$CHANGED_FILES" | grep -q "^frontend/"; then
  BUILD_FRONTEND=true
fi
if echo "$CHANGED_FILES" | grep -q "^backend/.*migrations/"; then
  RUN_MIGRATE=true
fi
if echo "$CHANGED_FILES" | grep -q "^docker-compose.yml"; then
  BUILD_BACKEND=true
  BUILD_FRONTEND=true
fi

# ── 3. Build images (chỉ build phần thay đổi) ──
if [ "$BUILD_BACKEND" = true ] && [ "$BUILD_FRONTEND" = true ]; then
  log "[2/5] Building backend + frontend..."
  docker compose build backend frontend
elif [ "$BUILD_BACKEND" = true ]; then
  log "[2/5] Building backend only..."
  docker compose build backend
elif [ "$BUILD_FRONTEND" = true ]; then
  log "[2/5] Building frontend only..."
  docker compose build frontend
else
  log "[2/5] Không cần build image (chỉ thay đổi config/docs)."
fi

# ── 4. Restart containers ──
if [ "$BUILD_BACKEND" = true ] || [ "$BUILD_FRONTEND" = true ]; then
  log "[3/5] Restarting containers..."
  docker compose up -d
else
  log "[3/5] Không cần restart containers."
fi

# ── 5. Migration (nếu có migration mới) ──
if [ "$RUN_MIGRATE" = true ]; then
  log "[4/5] Running database migrations..."
  docker compose exec -T backend python manage.py migrate --noinput
else
  log "[4/5] Không có migration mới."
fi

# ── 6. Collect static (nếu backend thay đổi) ──
if [ "$BUILD_BACKEND" = true ]; then
  log "[5/5] Collecting static files..."
  docker compose exec -T backend python manage.py collectstatic --noinput
else
  log "[5/5] Không cần collectstatic."
fi

# ── Dọn dẹp images cũ (optional) ──
docker image prune -f >> "$LOG_FILE" 2>&1 || true

log "========================================"
log "  DEPLOY THANH CONG!"
log "  Commit: $(git log --oneline -1)"
log "========================================"
