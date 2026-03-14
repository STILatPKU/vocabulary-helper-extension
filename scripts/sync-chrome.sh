#!/bin/bash
set -euo pipefail

# Sync source files into dist/chrome for loading in Chromium/Chrome.
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$ROOT/dist/chrome"

# Keep both manifests in sync with the single VERSION source.
bash "$ROOT/scripts/sync-manifest-version.sh"

rm -rf "$DEST"
mkdir -p "$DEST"

# Manifest: MV3 for Chrome
cp "$ROOT/manifest.json" "$DEST/manifest.json"

# Core files
cp "$ROOT"/{background.js,content.js,popup.html,popup.js,options.html,options.js} "$DEST"/
cp -R "$ROOT/icons" "$DEST/icons"

echo "Chrome build synced to $DEST"

ZIP_OUT="$ROOT/dist/vocabulary-helper-chrome.zip"
rm -f "$ZIP_OUT"

# Package everything under dist/chrome so paths inside zip are correct.
(
	cd "$DEST"
	zip -r "$ZIP_OUT" . -x "*.DS_Store"
)

echo "Chrome ZIP package created at $ROOT/dist/vocabulary-helper-chrome.zip"
