#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR=${APP_DIR:-/opt/loyaltyflow}
DEPLOY_BRANCH=${DEPLOY_BRANCH:-backup/pre-glass-redesign-20260915}
DOMAIN=${DOMAIN:-31.77.207.38.nip.io}
SCHEME=${SCHEME:-https}

cd "$APP_DIR"

stamp=$(date +%Y%m%d-%H%M%S)
echo "==> Saving local diff to /root/loyaltyflow-local-${stamp}.patch"
git status -sb
git diff > "/root/loyaltyflow-local-${stamp}.patch"

echo "==> Updating static frontend from ${DEPLOY_BRANCH}"
git fetch origin "refs/heads/${DEPLOY_BRANCH}"
git reset --hard FETCH_HEAD
git log -1 --oneline

echo "==> Reloading nginx without Docker rebuild"
nginx -t
systemctl reload nginx

echo "==> Checking miniapp QR cache-bust and hotfix code"
curl -ksS --resolve "${DOMAIN}:443:127.0.0.1" "${SCHEME}://${DOMAIN}/miniapp.html?tenant=main" | grep -F 'miniapp-qr.js?v=10' >/dev/null
curl -ksS --resolve "${DOMAIN}:443:127.0.0.1" "${SCHEME}://${DOMAIN}/miniapp-qr.js?v=10" | grep -F 'ensureLabelNode' >/dev/null

echo "==> Checking protected paths"
for path in /.env /.git/config /docker-compose.yml /deploy/update-qr-hotfix.sh /deploy/production.sh; do
  code=$(curl -ksS -o /dev/null -w '%{http_code}' --resolve "${DOMAIN}:443:127.0.0.1" "${SCHEME}://${DOMAIN}${path}")
  [ "$code" = 403 ] || [ "$code" = 404 ] || { echo "Sensitive path exposed: $path ($code)" >&2; exit 1; }
done

echo
printf 'QR hotfix deployed OK\nBranch: %s\nCommit: %s\n' "$DEPLOY_BRANCH" "$(git rev-parse --short HEAD)"
