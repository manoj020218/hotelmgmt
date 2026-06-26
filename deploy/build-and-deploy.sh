#!/usr/bin/env bash
# Run from the project root on your LOCAL machine.
# Prerequisites: SSH key access to VPS, pnpm installed.
#
# Usage:
#   chmod +x deploy/build-and-deploy.sh
#   VPS=user@YOUR_VPS_IP ./deploy/build-and-deploy.sh

set -e

VPS=${VPS:?Set VPS=user@your_vps_ip}
REMOTE_ROOT=/var/www/hotelqr

echo "==> Building Admin PWA..."
(cd client && pnpm build)

echo "==> Building KDS web build..."
(cd client && pnpm build:kds)
# Temporarily stash dist so it's not overwritten
cp -r client/dist /tmp/hotel-dist-kds

echo "==> Building Waiter web build..."
(cd client && pnpm build:waiter)
cp -r client/dist /tmp/hotel-dist-waiter

# Restore admin dist
(cd client && pnpm build)

echo "==> Uploading Admin build..."
ssh "$VPS" "mkdir -p $REMOTE_ROOT/admin"
rsync -az --delete client/dist/ "$VPS:$REMOTE_ROOT/admin/"

echo "==> Uploading KDS build..."
ssh "$VPS" "mkdir -p $REMOTE_ROOT/kds"
rsync -az --delete /tmp/hotel-dist-kds/ "$VPS:$REMOTE_ROOT/kds/"

echo "==> Uploading Waiter build..."
ssh "$VPS" "mkdir -p $REMOTE_ROOT/waiter"
rsync -az --delete /tmp/hotel-dist-waiter/ "$VPS:$REMOTE_ROOT/waiter/"

echo "==> Uploading server..."
rsync -az --delete --exclude node_modules --exclude .env \
  server/ "$VPS:$REMOTE_ROOT/server/"

echo "==> Installing server dependencies & restarting..."
ssh "$VPS" "cd $REMOTE_ROOT/server && npm install --omit=dev && pm2 restart hotelqr-api || pm2 start src/index.js --name hotelqr-api"

echo "==> Done. Nginx roots:"
echo "    Admin  → $REMOTE_ROOT/admin   (hotelqr.admin.iotsoft.in)"
echo "    KDS    → $REMOTE_ROOT/kds     (hotelqr.kds.iotsoft.in)"
echo "    Waiter → $REMOTE_ROOT/waiter  (hotelqr.waiter.iotsoft.in)"
