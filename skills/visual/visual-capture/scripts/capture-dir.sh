#!/usr/bin/env bash
# Print the capture directory for the current git branch, reusing an existing
# one when the branch slug matches or creating a new timestamped one otherwise.
# Deterministic: the agent runs this and reads the printed path — no judgement.
#
# Layout:  <root>/<YYYYMMDD-HHMMSS>-<branch-slug>
# Usage:   capture-dir.sh [captures-root]     (default: captures)
set -euo pipefail

root="${1:-captures}"

# Current branch; on detached HEAD fall back to the short commit SHA.
branch="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || true)"
if [ -z "$branch" ] || [ "$branch" = "HEAD" ]; then
  branch="$(git rev-parse --short HEAD 2>/dev/null || echo detached)"
fi

# Slugify: lowercase, non-alphanumeric -> '-', collapse repeats, trim ends.
slug="$(printf '%s' "$branch" \
  | tr '[:upper:]' '[:lower:]' \
  | tr -c 'a-z0-9' '-' \
  | tr -s '-' \
  | sed 's/^-//; s/-$//')"
[ -n "$slug" ] || slug="detached"

# Reuse the most recent existing dir whose slug matches exactly; else create one.
# Globs sort ascending, so the last match (newest timestamp) wins. The exact
# suffix check stops slug "app" from matching a "...-web-app" directory.
found=""
for d in "$root"/*-"$slug"; do
  [ -d "$d" ] || continue
  b="$(basename "$d")"
  [ "${b#*-*-}" = "$slug" ] || continue
  found="$d"
done

if [ -n "$found" ]; then
  dir="$found"
else
  dir="$root/$(date +%Y%m%d-%H%M%S)-$slug"
  mkdir -p "$dir"
fi

printf '%s\n' "$dir"
