#!/bin/bash
# Coursera AI AutoPilot - 1-Click Terminal Updater
set -e
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

echo "=================================================="
echo "⚡ Coursera AI AutoPilot - 1-Click Updater"
echo "=================================================="
echo "Fetching latest version from GitHub..."

git fetch origin main
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main)

if [ "$LOCAL" = "$REMOTE" ]; then
    echo "✓ Extension is already up to date! (Commit: ${LOCAL:0:7})"
    exit 0
fi

echo "Updating code (${LOCAL:0:7} -> ${REMOTE:0:7})..."
git pull origin main

echo ""
echo "🎉 Update complete! Reload the extension at chrome://extensions"
