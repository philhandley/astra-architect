#!/usr/bin/env bash
# Usage: tools/shot.sh <name> "<path-and-query#hash>" [W,H] [virtual-ms]
# Headless Chrome screenshot of http://127.0.0.1:8400/<path> into dev/shots/, printing console lines.
OUT="$(cd "$(dirname "$0")/.." && pwd)/dev/shots"
mkdir -p "$OUT"
NAME="$1"; PATHQ="$2"; SIZE="${3:-1280,800}"; VT="${4:-8000}"
timeout 150 "/c/Program Files/Google/Chrome/Application/chrome.exe" --headless=new --enable-unsafe-swiftshader --use-angle=swiftshader \
  --no-first-run --user-data-dir="$OUT/profile-$NAME" --window-size="$SIZE" --virtual-time-budget="$VT" \
  --enable-logging=stderr --v=0 --screenshot="$OUT/$NAME.png" "http://127.0.0.1:8400/$PATHQ" 2>&1 | grep -E "CONSOLE" | sed -E 's/^.*CONSOLE[^"]*"//' | head -30
echo "-> $OUT/$NAME.png"
