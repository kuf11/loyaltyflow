#!/usr/bin/env bash
set -Eeuo pipefail
SITE=/etc/nginx/sites-available/loyaltyflow
[ -f "$SITE" ] || { echo "Nginx config not found: $SITE" >&2; exit 1; }
cp -a "$SITE" "$SITE.bak.$(date +%Y%m%d%H%M%S)"
sed -i -E \
  -e 's#<script src="/session-stability\\.js\\?v=[^"]+"></script>##g' \
  -e 's#<script src="/cookie-ui\\.js\\?v=[^"]+"></script>##g' \
  -e 's#<link rel="stylesheet" href="/mobile-audit\\.css\\?v=[^"]+">##g' \
  -e 's#session-cookie\\.js\\?v=[0-9]+#session-cookie.js?v=12#g' \
  "$SITE"
if grep -Eq 'session-stability\\.js|cookie-ui\\.js|mobile-audit\\.css' "$SITE"; then echo 'Obsolete global UI injection is still present' >&2; exit 1; fi
grep -q 'session-cookie.js?v=12' "$SITE" || { echo 'session-cookie cache bump failed' >&2; exit 1; }
nginx -t
systemctl reload nginx
echo 'Bearer fallback and dark cookie UI enabled'
