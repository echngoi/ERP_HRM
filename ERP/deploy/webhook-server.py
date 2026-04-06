#!/usr/bin/env python3
"""
ERP Auto-Deploy Webhook Server
Lắng nghe GitHub/Gitea webhook push → tự động chạy docker-deploy.sh

Chạy:  python3 /opt/erp/deploy/webhook-server.py
Port:  9000 (chỉ listen nội bộ)
"""
import http.server
import json
import hashlib
import hmac
import os
import subprocess
import threading
import sys
from datetime import datetime

PORT = 9000
DEPLOY_SCRIPT = "/opt/erp/deploy/docker-deploy.sh"
WEBHOOK_SECRET = os.environ.get("WEBHOOK_SECRET", "")
ALLOWED_BRANCHES = {"refs/heads/main", "refs/heads/master"}
LOG_FILE = "/opt/erp/deploy/webhook.log"


def log(msg):
    line = f"[{datetime.now():%Y-%m-%d %H:%M:%S}] {msg}"
    print(line, flush=True)
    try:
        with open(LOG_FILE, "a") as f:
            f.write(line + "\n")
    except OSError:
        pass


def verify_signature(payload_body, signature_header):
    """Xác thực HMAC-SHA256 từ GitHub/Gitea webhook."""
    if not WEBHOOK_SECRET:
        return True  # Bỏ qua nếu không cấu hình secret
    if not signature_header:
        return False
    # Hỗ trợ cả sha256= và sha1= prefix
    if signature_header.startswith("sha256="):
        expected = "sha256=" + hmac.new(
            WEBHOOK_SECRET.encode(), payload_body, hashlib.sha256
        ).hexdigest()
    elif signature_header.startswith("sha1="):
        expected = "sha1=" + hmac.new(
            WEBHOOK_SECRET.encode(), payload_body, hashlib.sha1
        ).hexdigest()
    else:
        return False
    return hmac.compare_digest(expected, signature_header)


def run_deploy():
    """Chạy deploy script trong background thread."""
    log("Bắt đầu deploy...")
    try:
        result = subprocess.run(
            ["bash", DEPLOY_SCRIPT],
            capture_output=True,
            text=True,
            timeout=600,  # 10 phút timeout
        )
        log(f"Deploy exit code: {result.returncode}")
        if result.stdout:
            log(f"STDOUT:\n{result.stdout[-2000:]}")
        if result.stderr:
            log(f"STDERR:\n{result.stderr[-1000:]}")
    except subprocess.TimeoutExpired:
        log("Deploy TIMEOUT (10 phút)!")
    except Exception as e:
        log(f"Deploy ERROR: {e}")


class WebhookHandler(http.server.BaseHTTPRequestHandler):
    def do_POST(self):
        if self.path != "/webhook":
            self.send_response(404)
            self.end_headers()
            return

        content_length = int(self.headers.get("Content-Length", 0))
        if content_length > 1_000_000:  # Max 1MB payload
            self.send_response(413)
            self.end_headers()
            return

        payload_body = self.rfile.read(content_length)

        # Xác thực signature (GitHub: X-Hub-Signature-256, Gitea: cùng header)
        signature = self.headers.get("X-Hub-Signature-256") or self.headers.get(
            "X-Hub-Signature"
        )
        if not verify_signature(payload_body, signature):
            log("Webhook bị từ chối: signature không hợp lệ")
            self.send_response(403)
            self.end_headers()
            self.wfile.write(b"Invalid signature")
            return

        # Parse payload
        try:
            payload = json.loads(payload_body)
        except json.JSONDecodeError:
            self.send_response(400)
            self.end_headers()
            return

        # Kiểm tra event type
        event = self.headers.get("X-GitHub-Event", "push")
        ref = payload.get("ref", "")

        log(f"Webhook nhận: event={event}, ref={ref}")

        if event != "push":
            log(f"Bỏ qua event: {event}")
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b"Ignored: not a push event")
            return

        if ref not in ALLOWED_BRANCHES:
            log(f"Bỏ qua branch: {ref}")
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b"Ignored: not target branch")
            return

        # Trigger deploy trong background
        thread = threading.Thread(target=run_deploy, daemon=True)
        thread.start()

        self.send_response(200)
        self.end_headers()
        self.wfile.write(b"Deploy triggered")
        log("Deploy triggered OK")

    def do_GET(self):
        """Health check endpoint."""
        if self.path == "/health":
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b"OK")
        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, format, *args):
        """Suppress default HTTP log, dùng log() riêng."""
        pass


if __name__ == "__main__":
    log(f"Webhook server starting on port {PORT}...")
    log(f"Secret configured: {'Yes' if WEBHOOK_SECRET else 'No (WARNING: no auth)'}")
    server = http.server.HTTPServer(("127.0.0.1", PORT), WebhookHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        log("Webhook server stopped.")
        server.server_close()
