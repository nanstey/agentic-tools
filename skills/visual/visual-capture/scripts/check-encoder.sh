#!/usr/bin/env bash
# Resolve the GIF encoder for this environment and print it:
#   "gifski"   preferred (smaller, higher quality)
#   "ffmpeg"   fallback (larger palette GIFs)
# Exits 3 when neither is available. encode-gif.sh uses whichever is present;
# this is the preflight gate so a capture never fails only at the encode step.
set -euo pipefail

if command -v gifski >/dev/null 2>&1; then
  echo "gifski"
elif command -v ffmpeg >/dev/null 2>&1; then
  echo "ffmpeg"
else
  echo "check-encoder: neither gifski nor ffmpeg found on PATH" >&2
  exit 3
fi
