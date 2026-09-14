#!/usr/bin/env bash
set -Eeuo pipefail
cd /opt/loyaltyflow
git fetch origin main
git reset --hard origin/main
ensure(){ grep -q "^$1=" .env || printf '%s=%s\n' "$1" "$2" >>.env; }
ensure ADMIN_KEY "$(openssl rand -hex 24)"
ensure JWT_SECRET "$(openssl rand -hex 48)"
ensure RESEND_API_KEY ""
ensure EMAIL_FROM ""
ensure ALLOW_DEV_EMAIL_CODE "true"
chmod 600 .env
docker compose up -d --build
sleep 5
curl -fsS http://127.0.0.1:3100/api/health
echo
echo 'Registration: https://31.77.207.38.nip.io/auth.html'
echo 'Approvals: https://31.77.207.38.nip.io/admin-approvals.html'
echo 'Admin key is stored in /opt/loyaltyflow/.env. Do not share it.'
