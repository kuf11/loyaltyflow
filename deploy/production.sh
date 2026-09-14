#!/usr/bin/env bash
set -Eeuo pipefail
cd /opt/loyaltyflow
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y git curl openssl nginx docker.io docker-compose-v2 certbot python3-certbot-nginx 2>/dev/null || apt-get install -y git curl openssl nginx docker.io docker-compose-plugin certbot python3-certbot-nginx
git fetch --prune origin
git reset --hard origin/main
if [ ! -f .env ]; then
  cat >.env <<ENV
POSTGRES_PASSWORD=$(openssl rand -hex 24)
SYNC_SECRET=$(openssl rand -hex 32)
BUSINESS_SLUG=main
PUBLIC_APP_URL=https://31.77.207.38.nip.io/miniapp.html?tenant=main
TELEGRAM_BOT_TOKEN=
ENV
  chmod 600 .env
fi
docker compose up -d --build
cat >/etc/nginx/sites-available/loyaltyflow <<'NGINX'
server {
  listen 80 default_server;
  listen [::]:80 default_server;
  server_name 31.77.207.38.nip.io 1977072.hosted-by.xorek.cloud 31.77.207.38;
  root /opt/loyaltyflow;
  index index.html;
  location /api/ { proxy_pass http://127.0.0.1:3000/api/; proxy_set_header Host $host; proxy_set_header X-Forwarded-Proto $scheme; proxy_set_header X-Real-IP $remote_addr; }
  location / { try_files $uri $uri/ /index.html; }
  add_header X-Content-Type-Options nosniff always;
  add_header Referrer-Policy strict-origin-when-cross-origin always;
}
NGINX
rm -f /etc/nginx/sites-enabled/default
ln -sfn /etc/nginx/sites-available/loyaltyflow /etc/nginx/sites-enabled/loyaltyflow
nginx -t
systemctl reload nginx
if [ -d /etc/letsencrypt/live/31.77.207.38.nip.io ]; then certbot install --cert-name 31.77.207.38.nip.io --nginx -n || true; else certbot --nginx -d 31.77.207.38.nip.io --agree-tos --register-unsafely-without-email -n || true; fi
systemctl reload nginx
sleep 4
curl -fsS http://127.0.0.1:3000/api/health
echo
SYNC=$(grep '^SYNC_SECRET=' .env | cut -d= -f2-)
echo "Admin: https://31.77.207.38.nip.io/"
echo "Mini App: https://31.77.207.38.nip.io/miniapp.html?tenant=main"
echo "Sync URL: https://31.77.207.38.nip.io/api/v1/sync/$SYNC"
echo 'To enable Telegram, set TELEGRAM_BOT_TOKEN in /opt/loyaltyflow/.env and run: docker compose up -d --build api'
