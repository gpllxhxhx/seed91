#!/usr/bin/env bash
set -euo pipefail

WEB_URL="${1:-}"
API_URL="${2:-}"

if [ -z "$WEB_URL" ] || [ -z "$API_URL" ]; then
  echo "Usage: ./deploy/scripts/check-public-site.sh https://music.your-domain.com https://api.your-domain.com"
  exit 1
fi

echo "Checking frontend..."
curl -fsSI "$WEB_URL/" >/dev/null
curl -fsS "$WEB_URL/robots.txt" >/dev/null
curl -fsS "$WEB_URL/sitemap.xml" >/dev/null

echo "Checking API..."
curl -fsS "$API_URL/search?keywords=test" >/dev/null

echo "Public site checks passed."
