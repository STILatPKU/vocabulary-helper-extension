#!/bin/bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VERSION_FILE="$ROOT/VERSION"

if [[ ! -f "$VERSION_FILE" ]]; then
  echo "Missing VERSION file: $VERSION_FILE" >&2
  exit 1
fi

TARGET_VERSION="$(tr -d '[:space:]' < "$VERSION_FILE")"

if [[ -z "$TARGET_VERSION" ]]; then
  echo "VERSION file is empty" >&2
  exit 1
fi

if [[ ! "$TARGET_VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+([-.][0-9A-Za-z.-]+)?$ ]]; then
  echo "Invalid version format in VERSION: $TARGET_VERSION" >&2
  echo "Expected: x.y.z or x.y.z-suffix" >&2
  exit 1
fi

update_manifest_version() {
  local file="$1"
  local tmp_file
  tmp_file="$(mktemp)"

  awk -v version="$TARGET_VERSION" '
    BEGIN { updated = 0 }
    {
      if (!updated && $0 ~ /"version"[[:space:]]*:/) {
        sub(/"version"[[:space:]]*:[[:space:]]*"[^"]*"/, "\"version\": \"" version "\"")
        updated = 1
      }
      print
    }
    END {
      if (!updated) {
        exit 2
      }
    }
  ' "$file" > "$tmp_file" || {
    rm -f "$tmp_file"
    echo "Failed to update version in $file" >&2
    exit 1
  }

  mv "$tmp_file" "$file"
}

update_manifest_version "$ROOT/manifest.json"
update_manifest_version "$ROOT/manifest.firefox.json"

echo "Manifest versions synced to $TARGET_VERSION"