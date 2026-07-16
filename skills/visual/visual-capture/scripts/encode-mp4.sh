#!/usr/bin/env bash
# Transcode a recording (e.g. a captured .webm) to an MP4 that GitHub plays
# inline in PRs/issues. H.264 + yuv420p + faststart for broad compatibility
# (Safari/QuickTime/GitHub); audio dropped (screencasts have none).
# Prints the output path on success.
#
# Usage: encode-mp4.sh <input> <output.mp4> [crf] [width]
#   crf    default 23  (lower = higher quality/larger; 18-28 is sensible)
#   width  default: native (source) width; pass a smaller width to shrink.
set -euo pipefail

in="${1:?usage: encode-mp4.sh <input> <output.mp4> [crf] [width]}"
out="${2:?usage: encode-mp4.sh <input> <output.mp4> [crf] [width]}"
crf="${3:-23}"
width="${4:-}"   # empty => keep native resolution

[ -f "$in" ] || { echo "encode-mp4: input not found: $in" >&2; exit 1; }
command -v ffmpeg >/dev/null 2>&1 || { echo "encode-mp4: ffmpeg not found on PATH" >&2; exit 2; }

# H.264 + yuv420p require even dimensions. Downscale to $width (even height via
# -2) when given, else just round the native size down to even.
if [ -n "$width" ]; then
  vf="scale=$width:-2:flags=lanczos"
else
  vf="scale=trunc(iw/2)*2:trunc(ih/2)*2"
fi

ffmpeg -y -i "$in" -vf "$vf" -c:v libx264 -crf "$crf" -preset veryfast \
  -pix_fmt yuv420p -movflags +faststart -an "$out" </dev/null >/dev/null 2>&1

printf '%s\n' "$out"
