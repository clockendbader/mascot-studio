#!/usr/bin/env bash
# Copy the plugin into a Claude Code session's hot-reload mods folder.
# Usage: scripts/sync-dev.sh <mods-folder>
set -euo pipefail
if [ $# -ne 1 ] || [ -z "$1" ] || [ ! -d "$1" ]; then
  echo "usage: scripts/sync-dev.sh <mods-folder>   (an existing folder)" >&2
  exit 2
fi
root="$(cd "$(dirname "$0")/.." && pwd)"
dest="$1/mascot-studio"
rm -rf "$dest"
mkdir -p "$dest"
(cd "$root/plugins/mascot-studio" && tar --exclude='./.claude-plugin/types' --exclude='./tests' -cf - .) | (cd "$dest" && tar -xf -)
echo "synced to $dest"
