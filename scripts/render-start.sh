#!/bin/sh
# Optional Render start wrapper — migrations also run automatically in dist/index.js on boot.
set -e
echo "=== JunkShop render-start ==="
echo "APP_ENV=${APP_ENV:-unset}"
node dist/index.js
