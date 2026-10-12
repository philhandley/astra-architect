#!/usr/bin/env bash
# Offline test: headless Edge registers sw.js and reports what it cached.
# Needs the slow test server running first: python tools/slowserve.py 8401
OUT="$(cd "$(dirname "$0")/.." && pwd)/dev/shots"
mkdir -p "$OUT"
PROF="$OUT/profile-edge-sw-$$"; rm -rf "$PROF"
timeout 150 "/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" --headless=new --no-first-run --user-data-dir="$PROF" --dump-dom "http://127.0.0.1:8401/dev/test-sw.html" 2>/dev/null | grep -o "SWTEST [^<]*"
rm -rf "$PROF"
