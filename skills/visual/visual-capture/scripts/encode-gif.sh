#!/usr/bin/env bash
# Encode a video (e.g. a captured .webm) into a PR-friendly GIF.
# Prefers gifski for quality; falls back to a two-pass ffmpeg palette.
# Prints the output path on success.
#
# Usage: encode-gif.sh <input> <output.gif> [fps] [width]
#   fps    default 12   (8-15 is a good PR range)
#   width  default 1000 (scaled with preserved aspect ratio)
set -euo pipefail

in="${1:?usage: encode-gif.sh <input> <output.gif> [fps] [width]}"
out="${2:?usage: encode-gif.sh <input> <output.gif> [fps] [width]}"
fps="${3:-12}"
width="${4:-1000}"

[ -f "$in" ] || { echo "encode-gif: input not found: $in" >&2; exit 1; }

if command -v gifski >/dev/null 2>&1 && gifski --fps "$fps" --width "$width" -o "$out" "$in" >/dev/null 2>&1; then
  : # gifski succeeded
elif command -v ffmpeg >/dev/null 2>&1; then
  pal="$(mktemp --suffix=.png)"
  trap 'rm -f "$pal"' EXIT
  ffmpeg -y -i "$in" -vf "fps=$fps,scale=$width:-1:flags=lanczos,palettegen" "$pal" </dev/null >/dev/null 2>&1
  ffmpeg -y -i "$in" -i "$pal" \
    -lavfi "fps=$fps,scale=$width:-1:flags=lanczos[x];[x][1:v]paletteuse" "$out" </dev/null >/dev/null 2>&1
else
  echo "encode-gif: need gifski or ffmpeg on PATH" >&2
  exit 2
fi

printf '%s\n' "$out"
