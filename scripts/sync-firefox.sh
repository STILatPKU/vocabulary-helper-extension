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

VERSION="$(tr -d '[:space:]' < "$ROOT/VERSION")"
XPI_OUT="$ROOT/dist/vocabulary-helper-firefox-${VERSION}.xpi"
rm -f "$XPI_OUT"

# Package everything under dist/firefox so relative paths inside XPI are correct.
(
	cd "$DEST"
	zip -r "$XPI_OUT" . -x "*.DS_Store"
)

echo "Firefox XPI package created at $XPI_OUT"

# Update updates.json with the new XPI URL and version.
UPDATES_JSON="$ROOT/updates/firefox/updates.json"
sed -i '' -E \
  -e "s|\"version\": \"[0-9]+\.[0-9]+\.[0-9]+([-.][0-9A-Za-z.-]+)?\"|\"version\": \"${VERSION}\"|g" \
  -e "s|vocabulary-helper-firefox-[0-9]+\.[0-9]+\.[0-9]+([-.][0-9A-Za-z.-]+)?\.xpi|vocabulary-helper-firefox-${VERSION}.xpi|g" \
  "$UPDATES_JSON"
echo "updates.json updated with version $VERSION"