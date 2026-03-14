#!/bin/bash
set -euo pipefail

# Sync source files into dist/firefox for temporary loading in Firefox.
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$ROOT/dist/firefox"

# Keep both manifests in sync with the single VERSION source.
bash "$ROOT/scripts/sync-manifest-version.sh"

rm -rf "$DEST"
mkdir -p "$DEST"

# Manifest: MV2 copy for Firefox
cp "$ROOT/manifest.firefox.json" "$DEST/manifest.json"

# Core files
cp "$ROOT"/{background.js,content.js,popup.html,popup.js,options.html,options.js} "$DEST"/

# Keep Firefox package lean: include only icon sizes referenced by manifest.
mkdir -p "$DEST/icons"
cp "$ROOT/icons"/{icon-32.png,icon-48.png,icon-96.png} "$DEST/icons/"

echo "Firefox build synced to $DEST"

XPI_OUT="$ROOT/dist/vocabulary-helper-firefox.xpi"
rm -f "$XPI_OUT"

# Package everything under dist/firefox so relative paths inside XPI are correct.
(
	cd "$DEST"
	zip -r "$XPI_OUT" . -x "*.DS_Store"
)

echo "Firefox XPI package created at $ROOT/dist/vocabulary-helper-firefox.xpi"