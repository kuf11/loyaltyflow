#!/usr/bin/env bash
set -Eeuo pipefail
SITE=/etc/nginx/sites-available/loyaltyflow
[ -f "$SITE" ] || { echo "Nginx config not found: $SITE" >&2; exit 1; }
sed -i -E 's#cookie-ui\.js\?v=[0-9]+#cookie-ui.js?v=5#g;s#mobile-audit\.css\?v=[0-9]+#mobile-audit.css?v=4#g;s#session-stability\.js\?v=[0-9]+#session-stability.js?v=2#g' "$SITE"
if ! grep -q 'session-stability.js' "$SITE"; then sed -i 's#<script src="/session-cookie.js#<script src="/session-stability.js?v=2"></script><script src="/session-cookie.js#g' "$SITE"; fi
if ! grep -q 'cookie-ui.js' "$SITE"; then sed -i 's#<script src="/form-ui.js?v=1"></script></head>#<script src="/form-ui.js?v=1"></script><script src="/cookie-ui.js?v=5"></script></head>#g' "$SITE"; fi
if ! grep -q 'mobile-audit.css' "$SITE"; then sed -i 's#<script src="/cookie-ui.js?v=5"></script>#<link rel="stylesheet" href="/mobile-audit.css?v=4"><script src="/cookie-ui.js?v=5"></script>#g' "$SITE"; fi
grep -q 'session-stability.js?v=2' "$SITE" || { echo 'Session stability injection failed' >&2; exit 1; }
grep -q 'cookie-ui.js?v=5' "$SITE" || { echo 'Global loader/cookie UI injection failed' >&2; exit 1; }
grep -q 'mobile-audit.css?v=4' "$SITE" || { echo 'Global mobile CSS injection failed' >&2; exit 1; }
nginx -t
systemctl reload nginx
echo 'Global mobile session and UI hotfix enabled'
