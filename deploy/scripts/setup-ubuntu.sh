#!/usr/bin/env bash
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "Please run this script with sudo."
  exit 1
fi

apt-get update
apt-get install -y ca-certificates curl gnupg nginx git

if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

npm install -g pm2
apt-get install -y certbot python3-certbot-nginx

systemctl enable nginx
systemctl restart nginx

echo "Server basics are ready: Node.js, npm, nginx, pm2, and certbot."
