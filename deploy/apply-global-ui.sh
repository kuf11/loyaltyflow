#!/usr/bin/env bash
set -Eeuo pipefail
SITE=/etc/nginx/sites-available/loyaltyflow
[ -f "$SITE" ] || { echo "Nginx config not found: $SITE" >&2; exit 1; }
if ! grep -q 'cookie-ui.js' "$SITE"; then
  sed -i 's#<script src="/form-ui.js?v=1"></script></head>#<script src="/form-ui.js?v=1"></script><script src="/cookie-ui.js?v=1"></script></head>#g' "$SITE"
fi
grep -q 'cookie-ui.js' "$SITE" || { echo 'Global cookie UI injection failed' >&2; exit 1; }
nginx -t
systemctl reload nginx
echo 'Global cookie UI enabled'
