#!/usr/bin/env bash
set -Eeuo pipefail
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
cd "${APP_DIR}"
export DEBIAN_FRONTEND=noninteractive
DOMAIN=${DOMAIN:-loyaltyflow.ru}
EXPECTED_IPV4=${EXPECTED_IPV4:-31.77.207.38}
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
RESOLVED_IPV4=$(getent ahostsv4 "$DOMAIN" | awk '{print $1}' | sort -u)
if ! grep -Fxq "$EXPECTED_IPV4" <<<"$RESOLVED_IPV4"; then
  echo "DNS $DOMAIN ещё не указывает на $EXPECTED_IPV4. Текущие IPv4: ${RESOLVED_IPV4:-не найдены}" >&2
  exit 1
fi
if [ ! -f .env ]; then
cat >.env <<ENV
POSTGRES_PASSWORD=$(openssl rand -hex 24)
SYNC_SECRET=$(openssl rand -hex 32)
ADMIN_KEY=$(openssl rand -hex 24)
JWT_SECRET=$(openssl rand -hex 48)
BOT_TOKEN_ENCRYPTION_KEY=$(openssl rand -hex 48)
BUSINESS_SLUG=main
PUBLIC_APP_URL=${SCHEME}://${DOMAIN}/miniapp?tenant=main
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
set_env(){ local key=$1 value=$2; if grep -q "^${key}=" .env; then sed -i "s#^${key}=.*#${key}=${value}#" .env; else printf '%s=%s\n' "$key" "$value" >>.env; fi; }
set_env PUBLIC_APP_URL "${SCHEME}://${DOMAIN}/miniapp?tenant=main"
set_env CORS_ORIGINS "${SCHEME}://${DOMAIN}"
chmod 600 .env
"${COMPOSE[@]}" up -d --build
CERT_DIR="/etc/letsencrypt/live/${DOMAIN}"
if [ ! -f "${CERT_DIR}/fullchain.pem" ] || [ ! -f "${CERT_DIR}/privkey.pem" ]; then
  echo "TLS certificate for ${DOMAIN} is missing; refusing to replace the active Nginx config." >&2
  exit 1
fi
certbot certonly --webroot -w ${APP_DIR} -d "${DOMAIN}" -d "www.${DOMAIN}" --cert-name "${DOMAIN}" --expand --agree-tos --register-unsafely-without-email -n
NGINX_BACKUP=/etc/nginx/sites-available/loyaltyflow.before-deploy
if [ -f /etc/nginx/sites-available/loyaltyflow ]; then cp -a /etc/nginx/sites-available/loyaltyflow "${NGINX_BACKUP}"; fi
cat >/etc/nginx/sites-available/loyaltyflow <<NGINX
server { listen 80 default_server; listen [::]:80 default_server; server_name ${DOMAIN} www.${DOMAIN} 1977072.hosted-by.xorek.cloud 31.77.207.38 _; location /.well-known/acme-challenge/ { root ${APP_DIR}; } location ~ /\.(?!well-known) { deny all; } return 301 ${SCHEME}://${DOMAIN}\$request_uri; }
server { listen 443 ssl http2; listen [::]:443 ssl http2; server_name ${DOMAIN} www.${DOMAIN}; ssl_certificate /etc/letsencrypt/live/${DOMAIN}/fullchain.pem; ssl_certificate_key /etc/letsencrypt/live/${DOMAIN}/privkey.pem; include /etc/letsencrypt/options-ssl-nginx.conf; ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem; root ${APP_DIR}; index index.html; client_max_body_size 8m; sub_filter_once on; sub_filter '<head>' '<head><style id="lf-first-paint">html:not(.lf-public):not(.lf-auth-ok):not(.lf-auth-pending):not(.lf-auth-error){visibility:hidden!important}</style>'; sub_filter '</head>' '<script src="/session-cookie.js?v=12"></script><script src="/form-ui.js?v=1"></script></head>'; location = /session-cookie.js { add_header Cache-Control "no-store, no-cache, must-revalidate" always; try_files \$uri =404; } location = /form-ui.js { add_header Cache-Control "no-store, no-cache, must-revalidate" always; try_files \$uri =404; } location ~ /\.(?!well-known) { deny all; } location ^~ /deploy/ { deny all; } location = /docker-compose.yml { deny all; } location = /admin-approvals.html { return 404; } location ^~ /api/v1/admin/ { return 404; } location ~* \.(?:sql|sh|md|ya?ml|lock)$ { deny all; } location /api/ { proxy_pass http://127.0.0.1:${API_PORT}/api/; proxy_http_version 1.1; proxy_set_header Host \$host; proxy_set_header X-Forwarded-Proto https; proxy_set_header X-Real-IP \$remote_addr; proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for; } location /admin-api/ { proxy_pass http://127.0.0.1:${ADMIN_API_PORT}/admin-api/; proxy_http_version 1.1; proxy_set_header Host \$host; proxy_set_header X-Forwarded-Proto https; proxy_set_header X-Real-IP \$remote_addr; proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for; proxy_set_header Cookie \$http_cookie; } types { text/html html; text/css css; application/javascript js; application/manifest+json webmanifest; image/svg+xml svg; image/x-icon ico; image/png png; image/jpeg jpg jpeg; image/gif gif; image/webp webp; font/woff woff; font/woff2 woff2; } location = /index.html { return 301 /dashboard\$is_args\$args; } location = /auth.html { return 301 /auth\$is_args\$args; } location = /login.html { return 301 /login\$is_args\$args; } location = /register.html { return 301 /register\$is_args\$args; } location = /forgot-password.html { return 301 /forgot-password\$is_args\$args; } location = /analytics.html { return 301 /analytics\$is_args\$args; } location = /broadcasts.html { return 301 /broadcasts\$is_args\$args; } location = /cashier-login.html { return 301 /cashier-login\$is_args\$args; } location = /cashier.html { return 301 /cashier\$is_args\$args; } location = /cashiers.html { return 301 /cashiers\$is_args\$args; } location = /catalog-admin.html { return 301 /catalog-admin\$is_args\$args; } location = /integration-evotor.html { return 301 /integration-evotor\$is_args\$args; } location = /integration-moysklad.html { return 301 /integration-moysklad\$is_args\$args; } location = /integrations.html { return 301 /integrations\$is_args\$args; } location = /loyalty-admin.html { return 301 /loyalty-admin\$is_args\$args; } location = /miniapp.html { return 301 /miniapp\$is_args\$args; } location = /platform-admin.html { return 301 /platform-admin\$is_args\$args; } location = /privacy.html { return 301 /privacy\$is_args\$args; } location = /admin-approvals.html { return 301 /admin-approvals\$is_args\$args; } location = / { try_files /auth.html =404; } location = /auth { try_files /auth.html =404; } location = /login { try_files /login.html =404; } location = /register { try_files /register.html =404; } location = /forgot-password { try_files /forgot-password.html =404; } location = /dashboard { try_files /index.html =404; } location = /analytics { try_files /analytics.html =404; } location = /broadcasts { try_files /broadcasts.html =404; } location = /cashier-login { try_files /cashier-login.html =404; } location = /cashier { try_files /cashier.html =404; } location = /cashiers { try_files /cashiers.html =404; } location = /catalog-admin { try_files /catalog-admin.html =404; } location = /integration-evotor { try_files /integration-evotor.html =404; } location = /integration-moysklad { try_files /integration-moysklad.html =404; } location = /integrations { try_files /integrations.html =404; } location = /loyalty-admin { try_files /loyalty-admin.html =404; } location = /miniapp { try_files /miniapp.html =404; } location = /platform-admin { try_files /platform-admin.html =404; } location = /privacy { try_files /privacy.html =404; } location = /admin-approvals { try_files /admin-approvals.html =404; } location ~* \.(?:css|js|svg|ico|png|jpg|jpeg|gif|webp|woff2?|webmanifest)$ { expires 7d; add_header Cache-Control "public, max-age=604800, stale-while-revalidate=86400" always; try_files \$uri =404; } location / { expires -1; try_files \$uri \$uri/ /index.html; } add_header X-Content-Type-Options nosniff always; add_header X-Frame-Options SAMEORIGIN always; add_header Referrer-Policy no-referrer always; add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always; add_header Permissions-Policy "camera=(self), microphone=(), geolocation=()" always; add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' https://telegram.org https://cdnjs.cloudflare.com https://cdn.jsdelivr.net https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; img-src 'self' data: https:; connect-src 'self' https://api.telegram.org https://challenges.cloudflare.com; frame-src 'self' https://challenges.cloudflare.com; object-src 'none'; base-uri 'self'; frame-ancestors 'self' https://web.telegram.org https://*.telegram.org" always; }
NGINX
ln -sfn /etc/nginx/sites-available/loyaltyflow /etc/nginx/sites-enabled/loyaltyflow
if nginx -t; then
  systemctl reload nginx
else
  if [ -f "${NGINX_BACKUP}" ]; then cp -a "${NGINX_BACKUP}" /etc/nginx/sites-available/loyaltyflow; fi
  nginx -t && systemctl reload nginx || true
  echo "Nginx validation failed; previous config restored." >&2
  exit 1
fi
sleep 5
curl -fsS http://127.0.0.1:${API_PORT}/api/health
curl -fsS http://127.0.0.1:${ADMIN_API_PORT}/admin-api/health
curl -ksS --resolve "${DOMAIN}:443:127.0.0.1" "${SCHEME}://${DOMAIN}/" | grep -F 'session-cookie.js?v=12' >/dev/null
curl -ksS --resolve "${DOMAIN}:443:127.0.0.1" "${SCHEME}://${DOMAIN}/session-cookie.js" | grep -F 'Используем необходимые cookie.' >/dev/null
curl -ksS --resolve "${DOMAIN}:443:127.0.0.1" "${SCHEME}://${DOMAIN}/broadcasts.html" | grep -F 'broadcasts.js?v=3' >/dev/null
for path in /.env /.git/config /docker-compose.yml /deploy/production.sh /admin-approvals.html; do code=$(curl -ksS -o /dev/null -w '%{http_code}' --resolve "${DOMAIN}:443:127.0.0.1" "${SCHEME}://${DOMAIN}${path}"); [ "$code" = 403 ] || [ "$code" = 404 ] || { echo "Sensitive path exposed: $path ($code)" >&2; exit 1; }; done
echo; echo "Deployed branch: ${DEPLOY_BRANCH}"; echo "Commit: $(git rev-parse --short HEAD)"
