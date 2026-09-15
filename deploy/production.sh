#!/usr/bin/env bash
set -Eeuo pipefail
cd /opt/loyaltyflow
export DEBIAN_FRONTEND=noninteractive
DOMAIN=31.77.207.38.nip.io
SCHEME=https
API_PORT=3100
ADMIN_API_PORT=3101
DEPLOY_BRANCH=${DEPLOY_BRANCH:-backup/pre-glass-redesign-20260915}
apt-get update
apt-get install -y git curl openssl nginx docker.io certbot python3-certbot-nginx
systemctl enable --now docker nginx
if docker compose version >/dev/null 2>&1; then COMPOSE=(docker compose); elif command -v docker-compose >/dev/null 2>&1; then COMPOSE=(docker-compose); else apt-get install -y docker-compose-plugin 2>/dev/null || apt-get install -y docker-compose; if docker compose version >/dev/null 2>&1; then COMPOSE=(docker compose); else COMPOSE=(docker-compose); fi; fi
git fetch --prune origin "$DEPLOY_BRANCH"
git reset --hard FETCH_HEAD
if [ ! -f .env ]; then
cat >.env <<ENV
POSTGRES_PASSWORD=$(openssl rand -hex 24)
SYNC_SECRET=$(openssl rand -hex 32)
ADMIN_KEY=$(openssl rand -hex 24)
JWT_SECRET=$(openssl rand -hex 48)
BOT_TOKEN_ENCRYPTION_KEY=$(openssl rand -hex 48)
BUSINESS_SLUG=main
PUBLIC_APP_URL=${SCHEME}://${DOMAIN}/miniapp.html?tenant=main
CORS_ORIGINS=${SCHEME}://${DOMAIN}
PLATFORM_ADMIN_EMAILS=
TELEGRAM_BOT_TOKEN=
RESEND_API_KEY=
EMAIL_FROM=
ALLOW_DEV_CAPTCHA=false
ALLOW_DEV_EMAIL_CODE=false
AUTO_APPROVE_REGISTRATIONS=false
ENV
chmod 600 .env
else
if ! grep -Eq '^BOT_TOKEN_ENCRYPTION_KEY=.+$' .env; then sed -i '/^BOT_TOKEN_ENCRYPTION_KEY=/d' .env; printf '\nBOT_TOKEN_ENCRYPTION_KEY=%s\n' "$(openssl rand -hex 48)" >>.env; chmod 600 .env; fi
fi
"${COMPOSE[@]}" up -d --build
find /etc/nginx/sites-enabled -mindepth 1 -maxdepth 1 -type l -delete
cat >/etc/nginx/sites-available/loyaltyflow <<NGINX
server { listen 80 default_server; listen [::]:80 default_server; server_name ${DOMAIN} 1977072.hosted-by.xorek.cloud 31.77.207.38 _; root /opt/loyaltyflow; index index.html; location /.well-known/acme-challenge/ { try_files \$uri =404; } location ~ /\.(?!well-known) { deny all; } location ^~ /deploy/ { deny all; } location = /docker-compose.yml { deny all; } location /api/ { proxy_pass http://127.0.0.1:${API_PORT}/api/; proxy_set_header Host \$host; proxy_set_header X-Forwarded-Proto \$scheme; proxy_set_header X-Real-IP \$remote_addr; proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for; } location /admin-api/ { proxy_pass http://127.0.0.1:${ADMIN_API_PORT}/admin-api/; proxy_set_header Host \$host; proxy_set_header X-Forwarded-Proto \$scheme; proxy_set_header X-Real-IP \$remote_addr; proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for; proxy_set_header Cookie \$http_cookie; } location / { try_files \$uri \$uri/ /index.html; } }
NGINX
ln -sfn /etc/nginx/sites-available/loyaltyflow /etc/nginx/sites-enabled/loyaltyflow
nginx -t; systemctl reload nginx
if [ ! -d "/etc/letsencrypt/live/${DOMAIN}" ]; then certbot certonly --webroot -w /opt/loyaltyflow -d "${DOMAIN}" --agree-tos --register-unsafely-without-email -n; fi
cat >/etc/nginx/sites-available/loyaltyflow <<NGINX
server { listen 80 default_server; listen [::]:80 default_server; server_name ${DOMAIN} 1977072.hosted-by.xorek.cloud 31.77.207.38 _; location /.well-known/acme-challenge/ { root /opt/loyaltyflow; } location ~ /\.(?!well-known) { deny all; } return 301 ${SCHEME}://${DOMAIN}\$request_uri; }
server { listen 443 ssl http2; listen [::]:443 ssl http2; server_name ${DOMAIN}; ssl_certificate /etc/letsencrypt/live/${DOMAIN}/fullchain.pem; ssl_certificate_key /etc/letsencrypt/live/${DOMAIN}/privkey.pem; include /etc/letsencrypt/options-ssl-nginx.conf; ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem; root /opt/loyaltyflow; index index.html; client_max_body_size 8m; sub_filter_once on; sub_filter '<head>' '<head><style id="lf-first-paint">html:not(.lf-public):not(.lf-auth-ok):not(.lf-auth-pending):not(.lf-auth-error){visibility:hidden!important}</style>'; sub_filter '</head>' '<script src="/session-cookie.js?v=9"></script><script src="/form-ui.js?v=1"></script></head>'; location = /session-cookie.js { add_header Cache-Control "no-store, no-cache, must-revalidate" always; try_files \$uri =404; } location = /form-ui.js { add_header Cache-Control "no-store, no-cache, must-revalidate" always; try_files \$uri =404; } location ~ /\.(?!well-known) { deny all; } location ^~ /deploy/ { deny all; } location = /docker-compose.yml { deny all; } location ~* \.(?:sql|sh|md|ya?ml|lock)$ { deny all; } location /api/ { proxy_pass http://127.0.0.1:${API_PORT}/api/; proxy_http_version 1.1; proxy_set_header Host \$host; proxy_set_header X-Forwarded-Proto https; proxy_set_header X-Real-IP \$remote_addr; proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for; } location /admin-api/ { proxy_pass http://127.0.0.1:${ADMIN_API_PORT}/admin-api/; proxy_http_version 1.1; proxy_set_header Host \$host; proxy_set_header X-Forwarded-Proto https; proxy_set_header X-Real-IP \$remote_addr; proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for; proxy_set_header Cookie \$http_cookie; } location / { expires -1; try_files \$uri \$uri/ /index.html; } add_header X-Content-Type-Options nosniff always; add_header X-Frame-Options SAMEORIGIN always; add_header Referrer-Policy strict-origin-when-cross-origin always; add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always; add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always; add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' https://telegram.org https://cdnjs.cloudflare.com https://cdn.jsdelivr.net https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; img-src 'self' data: https:; connect-src 'self' https://api.telegram.org https://challenges.cloudflare.com; frame-src 'self' https://challenges.cloudflare.com; object-src 'none'; base-uri 'self'; frame-ancestors 'self' https://web.telegram.org https://*.telegram.org" always; }
NGINX
nginx -t; systemctl reload nginx
sleep 5
curl -fsS http://127.0.0.1:${API_PORT}/api/health
curl -fsS http://127.0.0.1:${ADMIN_API_PORT}/admin-api/health
curl -ksS --resolve "${DOMAIN}:443:127.0.0.1" "${SCHEME}://${DOMAIN}/" | grep -F 'session-cookie.js?v=9' >/dev/null
curl -ksS --resolve "${DOMAIN}:443:127.0.0.1" "${SCHEME}://${DOMAIN}/session-cookie.js" | grep -F 'LoyaltyFlow использует файлы cookie.' >/dev/null
curl -ksS --resolve "${DOMAIN}:443:127.0.0.1" "${SCHEME}://${DOMAIN}/broadcasts.html" | grep -F 'broadcasts.js?v=3' >/dev/null
for path in /.env /.git/config /docker-compose.yml /deploy/production.sh; do code=$(curl -ksS -o /dev/null -w '%{http_code}' --resolve "${DOMAIN}:443:127.0.0.1" "${SCHEME}://${DOMAIN}${path}"); [ "$code" = 403 ] || [ "$code" = 404 ] || { echo "Sensitive path exposed: $path ($code)" >&2; exit 1; }; done
echo; echo "Deployed branch: ${DEPLOY_BRANCH}"; echo "Commit: $(git rev-parse --short HEAD)"
