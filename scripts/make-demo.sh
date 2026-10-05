#!/usr/bin/env bash
# Records the README demo and screenshots: docs/media/demo.gif and theme-*.png.
# Needs: claude (the Claude Code CLI), python 3, ffmpeg, and Edge, Chrome or
# Chromium (set BROWSER_BIN if it is not in a usual place).
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

py=""
for candidate in python3 python; do
  if command -v "$candidate" >/dev/null 2>&1 && "$candidate" -c 'import sys; sys.exit(sys.version_info < (3, 8))' >/dev/null 2>&1; then
    py="$candidate"
    break
  fi
done
[ -n "$py" ] || { echo "make-demo: python 3.8+ is needed" >&2; exit 1; }

# a scratch copy of the plugin whose only test is the demo, so the real tests folder is never touched
rm -rf .demo
mkdir -p .demo
cp -R plugins/mascot-studio .demo/plugin
rm -rf .demo/plugin/.claude-plugin/types
find .demo/plugin/tests -name '*.test.ts' -delete
cp scripts/demo/demo.test.ts.txt .demo/plugin/tests/demo.test.ts

claude plugin test .demo/plugin > .demo/frames.log 2>&1 || { tail -40 .demo/frames.log >&2; echo "make-demo: the demo scenes failed" >&2; exit 1; }
"$py" scripts/demo/render.py .demo/frames.log docs/media --work .demo/render
