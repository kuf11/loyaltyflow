#!/usr/bin/env bash
set -Eeuo pipefail
cd /opt/loyaltyflow
export DEBIAN_FRONTEND=noninteractive
DOMAIN=31.77.207.38.nip.io
SCHEME=https

apt-get update
apt-get install -y git curl openssl nginx docker.io certbot python3-certbot-nginx
systemctl enable --now docker nginx
if docker compose version >/dev/null 2>&1; then
  COMPOSE=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE=(docker-compose)
else
  apt-get install -y docker-compose-plugin 2>/dev/null || apt-get install -y docker-compose
  if docker compose version >/dev/null 2>&1; then COMPOSE=(docker compose); else COMPOSE=(docker-compose); fi
fi

git fetch --prune origin
git reset --hard origin/main
if [ ! -f .env ]; then
  cat >.env <<ENV
POSTGRES_PASSWORD=$(openssl rand -hex 24)
SYNC_SECRET=$(openssl rand -hex 32)
BUSINESS_SLUG=main
PUBLIC_APP_URL=${SCHEME}://${DOMAIN}/miniapp.html?tenant=main
TELEGRAM_BOT_TOKEN=
ENV
  chmod 600 .env
fi
"${COMPOSE[@]}" up -d --build

find /etc/nginx/sites-enabled -mindepth 1 -maxdepth 1 -type l -delete
cat >/etc/nginx/sites-available/loyaltyflow <<NGINX
server {
  listen 80 default_server;
  listen [::]:80 default_server;
  server_name ${DOMAIN} 1977072.hosted-by.xorek.cloud 31.77.207.38 _;
  root /opt/loyaltyflow;
  index index.html;
  location /.well-known/acme-challenge/ { try_files \$uri =404; }
  location /api/ { proxy_pass http://127.0.0.1:3000/api/; proxy_set_header Host \$host; proxy_set_header X-Forwarded-Proto \$scheme; proxy_set_header X-Real-IP \$remote_addr; }
  location / { try_files \$uri \$uri/ /index.html; }
}
NGINX
ln -sfn /etc/nginx/sites-available/loyaltyflow /etc/nginx/sites-enabled/loyaltyflow
nginx -t
systemctl reload nginx

if [ ! -d "/etc/letsencrypt/live/${DOMAIN}" ]; then
  certbot certonly --webroot -w /opt/loyaltyflow -d "${DOMAIN}" --agree-tos --register-unsafely-without-email -n
fi
cat >/etc/nginx/sites-available/loyaltyflow <<NGINX
server {
  listen 80 default_server;
  listen [::]:80 default_server;
  server_name ${DOMAIN} 1977072.hosted-by.xorek.cloud 31.77.207.38 _;
  location /.well-known/acme-challenge/ { root /opt/loyaltyflow; }
  return 301 ${SCHEME}://${DOMAIN}\$request_uri;
}
server {
  listen 443 ssl http2;
  listen [::]:443 ssl http2;
  server_name ${DOMAIN};
  ssl_certificate /etc/letsencrypt/live/${DOMAIN}/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/${DOMAIN}/privkey.pem;
  include /etc/letsencrypt/options-ssl-nginx.conf;
  ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;
  root /opt/loyaltyflow;
  index index.html;
  client_max_body_size 1m;
  location /api/ { proxy_pass http://127.0.0.1:3000/api/; proxy_http_version 1.1; proxy_set_header Host \$host; proxy_set_header X-Forwarded-Proto https; proxy_set_header X-Real-IP \$remote_addr; }
  location / { try_files \$uri \$uri/ /index.html; }
  add_header X-Content-Type-Options nosniff always;
  add_header Referrer-Policy strict-origin-when-cross-origin always;
}
NGINX
nginx -t
systemctl reload nginx
sleep 5
curl -fsS http://127.0.0.1:3000/api/health
curl -kfsS --resolve "${DOMAIN}:443:127.0.0.1" "${SCHEME}://${DOMAIN}/api/health"
echo
SYNC=$(grep '^SYNC_SECRET=' .env | cut -d= -f2-)
echo "Admin: ${SCHEME}://${DOMAIN}/"
echo "Mini App: ${SCHEME}://${DOMAIN}/miniapp.html?tenant=main"
echo "Sync URL: ${SCHEME}://${DOMAIN}/api/v1/sync/${SYNC}"
echo "To enable Telegram: edit TELEGRAM_BOT_TOKEN in /opt/loyaltyflow/.env, then run ${COMPOSE[*]} up -d --build api"
