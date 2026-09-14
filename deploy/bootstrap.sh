#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR=/opt/loyaltyflow
REPO_URL=https://github.com/kuf11/loyaltyflow.git
DOMAIN=1977072.hosted-by.xorek.cloud

echo '[1/8] Checking operating system'
if ! command -v apt-get >/dev/null 2>&1; then
  echo 'This bootstrap currently supports Debian/Ubuntu.' >&2
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive
echo '[2/8] Installing system packages'
apt-get update
apt-get install -y ca-certificates curl git nginx fail2ban ufw docker.io
apt-get install -y docker-compose-v2 2>/dev/null || apt-get install -y docker-compose-plugin 2>/dev/null || true
systemctl enable --now docker nginx fail2ban

echo '[3/8] Creating deploy user'
id -u loyaltyflow >/dev/null 2>&1 || useradd --create-home --shell /bin/bash loyaltyflow
usermod -aG docker loyaltyflow
install -d -m 755 -o loyaltyflow -g loyaltyflow "$APP_DIR"

echo '[4/8] Downloading LoyaltyFlow'
if [ -d "$APP_DIR/.git" ]; then
  git -C "$APP_DIR" fetch --prune origin
  git -C "$APP_DIR" reset --hard origin/main
else
  rm -rf "$APP_DIR"
  git clone --depth 1 "$REPO_URL" "$APP_DIR"
fi
chown -R loyaltyflow:loyaltyflow "$APP_DIR"

echo '[5/8] Configuring Nginx'
cat >/etc/nginx/sites-available/loyaltyflow <<NGINX
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN} 31.77.207.38;
    root ${APP_DIR};
    index index.html;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    location ~* \\.(?:css|js|png|jpg|jpeg|gif|svg|ico|webp|woff2?)\$ {
        expires 1h;
        add_header Cache-Control "public";
        try_files \$uri =404;
    }

    add_header X-Content-Type-Options nosniff always;
    add_header X-Frame-Options SAMEORIGIN always;
    add_header Referrer-Policy strict-origin-when-cross-origin always;
}
NGINX
ln -sfn /etc/nginx/sites-available/loyaltyflow /etc/nginx/sites-enabled/loyaltyflow
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

echo '[6/8] Configuring firewall'
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 49222/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo '[7/8] Configuring Fail2ban'
cat >/etc/fail2ban/jail.d/loyaltyflow.local <<'JAIL'
[sshd]
enabled = true
port = 22,49222
maxretry = 5
findtime = 10m
bantime = 1h
JAIL
systemctl restart fail2ban

echo '[8/8] Verifying deployment'
curl -fsS http://127.0.0.1/ >/dev/null

echo
echo 'LoyaltyFlow frontend is running.'
echo "Open: http://${DOMAIN}"
echo 'Next step: backend API, database, HTTPS and Telegram integration.'
