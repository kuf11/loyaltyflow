#!/usr/bin/env bash
set -Eeuo pipefail
CONFIG=/etc/nginx/sites-available/loyaltyflow
BACKUP="${CONFIG}.bak.$(date +%Y%m%d%H%M%S)"
[ -f "$CONFIG" ] || { echo "Nginx config not found: $CONFIG" >&2; exit 1; }
cp "$CONFIG" "$BACKUP"
python3 - "$CONFIG" <<'PY'
from pathlib import Path
import sys
path=Path(sys.argv[1])
text=path.read_text()
if 'location /admin-api/' not in text:
    marker='  location /api/ {'
    block='''  location /admin-api/ {
    proxy_pass http://127.0.0.1:3101/admin-api/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto https;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  }
'''
    if marker not in text:
        raise SystemExit('Could not find HTTPS API location in Nginx config')
    text=text.replace(marker,block+marker,1)
    path.write_text(text)
PY
nginx -t
systemctl reload nginx
curl -fsS http://127.0.0.1:3101/admin-api/health
echo
echo 'Admin API proxy configured.'
