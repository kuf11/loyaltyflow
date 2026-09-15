#!/usr/bin/env bash
set -Eeuo pipefail
APP_DIR=/opt/loyaltyflow
REPO_URL=https://github.com/kuf11/loyaltyflow.git
DEPLOY_BRANCH=${DEPLOY_BRANCH:-backup/pre-glass-redesign-20260915}
DOMAIN=1977072.hosted-by.xorek.cloud
if ! command -v apt-get >/dev/null 2>&1; then echo 'This bootstrap currently supports Debian/Ubuntu.' >&2; exit 1; fi
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y ca-certificates curl git nginx fail2ban ufw docker.io
apt-get install -y docker-compose-v2 2>/dev/null || apt-get install -y docker-compose-plugin 2>/dev/null || true
systemctl enable --now docker nginx fail2ban
id -u loyaltyflow >/dev/null 2>&1 || useradd --create-home --shell /bin/bash loyaltyflow
usermod -aG docker loyaltyflow
install -d -m 755 -o loyaltyflow -g loyaltyflow "$APP_DIR"
if [ -d "$APP_DIR/.git" ]; then git -C "$APP_DIR" fetch origin "refs/heads/$DEPLOY_BRANCH"; git -C "$APP_DIR" reset --hard FETCH_HEAD; else rm -rf "$APP_DIR"; git clone --depth 1 --branch "$DEPLOY_BRANCH" --single-branch "$REPO_URL" "$APP_DIR"; fi
chown -R loyaltyflow:loyaltyflow "$APP_DIR"
cat >/etc/nginx/sites-available/loyaltyflow <<NGINX
server { listen 80; listen [::]:80; server_name ${DOMAIN} 31.77.207.38; root ${APP_DIR}; index index.html; location / { try_files \$uri \$uri/ /index.html; } location ~* \.(?:css|js|png|jpg|jpeg|gif|svg|ico|webp|woff2?)\$ { expires 1h; add_header Cache-Control "public"; try_files \$uri =404; } location ~ /\.(?!well-known) { deny all; } location ^~ /deploy/ { deny all; } location = /docker-compose.yml { deny all; } add_header X-Content-Type-Options nosniff always; add_header X-Frame-Options SAMEORIGIN always; add_header Referrer-Policy strict-origin-when-cross-origin always; }
NGINX
ln -sfn /etc/nginx/sites-available/loyaltyflow /etc/nginx/sites-enabled/loyaltyflow
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 49222/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
cat >/etc/fail2ban/jail.d/loyaltyflow.local <<'JAIL'
[sshd]
enabled = true
port = 22,49222
maxretry = 5
findtime = 10m
bantime = 1h
JAIL
systemctl restart fail2ban
curl -fsS http://127.0.0.1/ >/dev/null
echo "Deployed branch: $DEPLOY_BRANCH"
echo "Commit: $(git -C "$APP_DIR" rev-parse --short HEAD)"
