#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 1 ]; then
  echo "Usage: $0 <durable-ref>" >&2
  exit 1
fi

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
manifest="$script_dir/vendor/nanstey-durable.txt"
url="${DURABLE_REPO_URL:-$(awk '$1 !~ /^#/ && NF { print $1; exit }' "$manifest")}"
old="$(awk '$1 !~ /^#/ && NF { print $2; exit }' "$manifest")"
[[ "$old" =~ ^[0-9a-f]{40}$ ]] || {
  echo "Invalid durable manifest: $manifest" >&2
  exit 1
}

new="$(git ls-remote "$url" "$1" | awk 'NR == 1 { print $1 }')"
if ! [[ "$new" =~ ^[0-9a-f]{40}$ ]]; then
  echo "Could not resolve $1 in $url to a full commit SHA" >&2
  exit 1
fi

if [ "$new" != "$old" ]; then
  tmp="$(mktemp "${manifest}.XXXXXX")"
  awk -v url="$url" -v sha="$new" '
    $1 == url && !done { print url " " sha; done=1; next }
    { print }
  ' "$manifest" >"$tmp"
  mv "$tmp" "$manifest"
fi

printf 'durable pin: %s -> %s\n' "$old" "$new"
printf 'PR range: https://github.com/nanstey/durable/compare/%s...%s\n' "$old" "$new"
