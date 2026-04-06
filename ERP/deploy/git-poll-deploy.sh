#!/bin/bash
# ============================================================
# ERP Auto-Deploy via Git Poll (dùng khi không có webhook)
# Crontab kiểm tra Git mỗi 2 phút → deploy nếu có code mới
#
# Cài vào crontab:
#   crontab -e
#   */2 * * * * /opt/erp/deploy/git-poll-deploy.sh >> /opt/erp/deploy/poll.log 2>&1
# ============================================================
set -euo pipefail

PROJECT_DIR="/opt/erp"
BRANCH="main"

cd "$PROJECT_DIR"

# Fetch remote
git fetch origin "$BRANCH" --quiet

# So sánh commit local vs remote
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse "origin/$BRANCH")

if [ "$LOCAL" = "$REMOTE" ]; then
  # Không có thay đổi — exit im lặng
  exit 0
fi

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Phát hiện code mới: $LOCAL → $REMOTE"
echo "Đang deploy..."

# Gọi deploy script chính
bash "$PROJECT_DIR/deploy/docker-deploy.sh" "$BRANCH"
