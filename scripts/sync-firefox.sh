#!/bin/bash
set -euo pipefail

# Sync source files into dist/firefox for temporary loading in Firefox.
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$ROOT/dist/firefox"

rm -rf "$DEST"
mkdir -p "$DEST"

# Manifest: MV2 copy for Firefox
cp "$ROOT/manifest.firefox.json" "$DEST/manifest.json"

# Core files
cp "$ROOT"/{background.js,content.js,popup.html,popup.js,options.html,options.js} "$DEST"/

echo "Firefox build synced to $DEST"
