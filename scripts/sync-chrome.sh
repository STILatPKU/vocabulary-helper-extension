#!/bin/bash
set -euo pipefail

# Sync source files into dist/chrome for loading in Chromium/Chrome.
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$ROOT/dist/chrome"

rm -rf "$DEST"
mkdir -p "$DEST"

# Manifest: MV3 for Chrome
cp "$ROOT/manifest.json" "$DEST/manifest.json"

# Core files
cp "$ROOT"/{background.js,content.js,popup.html,popup.js,options.html,options.js} "$DEST"/

echo "Chrome build synced to $DEST"
