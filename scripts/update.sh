#!/bin/bash
# Historia — server-side update script
# Run this on the VPS to pull latest code and restart the app.
# Called automatically by GitHub Actions on every push to main.
set -e

APP_DIR="${APP_DIR:-/opt/historia}"
SERVICE="${SERVICE_NAME:-historia-3001}"

echo "▶ Pulling latest code..."
git -C "$APP_DIR" pull --ff-only

echo "▶ Installing dependencies..."
cd "$APP_DIR"
npm install --prefer-offline --silent

echo "▶ Building frontend..."
npm run build 2>&1 | tail -5

echo "▶ Syncing database schema..."
npm run db:push 2>&1 | tail -5

echo "▶ Restarting service $SERVICE..."
systemctl restart "$SERVICE"

sleep 2
if systemctl is-active --quiet "$SERVICE"; then
  echo "✅ $SERVICE is running"
else
  echo "❌ Service failed — check: journalctl -u $SERVICE -n 30"
  exit 1
fi
