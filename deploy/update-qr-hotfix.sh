#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR=${APP_DIR:-/opt/loyaltyflow}
DEPLOY_BRANCH=${DEPLOY_BRANCH:-fix/qr-cashier-code-stability}
DOMAIN=${DOMAIN:-31.77.207.38.nip.io}
SCHEME=${SCHEME:-https}
API_PORT=${API_PORT:-3100}
ADMIN_API_PORT=${ADMIN_API_PORT:-3101}

cd "$APP_DIR"

if docker compose version >/dev/null 2>&1; then
  COMPOSE=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE=(docker-compose)
else
  apt-get update
  apt-get install -y docker-compose-plugin 2>/dev/null || apt-get install -y docker-compose
  COMPOSE=(docker compose)
fi

echo "==> Fetching $DEPLOY_BRANCH"
git fetch --prune origin "$DEPLOY_BRANCH"
git reset --hard FETCH_HEAD

echo "==> Rebuilding containers"
"${COMPOSE[@]}" up -d --build

echo "==> Reloading nginx"
nginx -t
systemctl reload nginx

echo "==> Checking health"
curl -fsS "http://127.0.0.1:${API_PORT}/api/health" >/dev/null
curl -fsS "http://127.0.0.1:${ADMIN_API_PORT}/admin-api/health" >/dev/null

echo "==> Checking miniapp QR cache-bust"
curl -ksS --resolve "${DOMAIN}:443:127.0.0.1" "${SCHEME}://${DOMAIN}/miniapp.html?tenant=main" | grep -F 'miniapp-qr.js?v=10' >/dev/null
curl -ksS --resolve "${DOMAIN}:443:127.0.0.1" "${SCHEME}://${DOMAIN}/miniapp-qr.js?v=10" | grep -F 'ensureLabelNode' >/dev/null

echo "==> Sensitive paths check"
for path in /.env /.git/config /docker-compose.yml /deploy/update-qr-hotfix.sh /deploy/production.sh; do
  code=$(curl -ksS -o /dev/null -w '%{http_code}' --resolve "${DOMAIN}:443:127.0.0.1" "${SCHEME}://${DOMAIN}${path}")
  [ "$code" = 403 ] || [ "$code" = 404 ] || { echo "Sensitive path exposed: $path ($code)" >&2; exit 1; }
done

echo
printf 'QR hotfix deployed OK\nBranch: %s\nCommit: %s\n' "$DEPLOY_BRANCH" "$(git rev-parse --short HEAD)"
