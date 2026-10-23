#!/usr/bin/env bash
set -euo pipefail

repo="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
tmp="$(mktemp -d "${TMPDIR:-/tmp}/durable-bump-test.XXXXXX")"
trap 'rm -rf "$tmp"' EXIT

git init -q --bare "$tmp/remote.git"
git init -q "$tmp/work"
git -C "$tmp/work" config user.name test
git -C "$tmp/work" config user.email test@example.invalid
echo one >"$tmp/work/file"
git -C "$tmp/work" add file && git -C "$tmp/work" commit -qm one
git -C "$tmp/work" branch -M main
git -C "$tmp/work" remote add origin "$tmp/remote.git"
git -C "$tmp/work" push -q -u origin main
old="$(git -C "$tmp/work" rev-parse HEAD)"
echo two >>"$tmp/work/file"
git -C "$tmp/work" commit -qam two
git -C "$tmp/work" push -q
new="$(git -C "$tmp/work" rev-parse HEAD)"

mkdir -p "$tmp/harness/durable/vendor"
cp "$repo/harness/durable/bump-pin.sh" "$tmp/harness/durable/"
printf '%s %s\n' "$tmp/remote.git" "$old" >"$tmp/harness/durable/vendor/nanstey-durable.txt"
DURABLE_REPO_URL="$tmp/remote.git" bash "$tmp/harness/durable/bump-pin.sh" main >"$tmp/out"
grep -qF "$old -> $new" "$tmp/out"
grep -qF "$new" "$tmp/harness/durable/vendor/nanstey-durable.txt"
before="$(cat "$tmp/harness/durable/vendor/nanstey-durable.txt")"
DURABLE_REPO_URL="$tmp/remote.git" bash "$tmp/harness/durable/bump-pin.sh" main >"$tmp/out2"
[ "$(cat "$tmp/harness/durable/vendor/nanstey-durable.txt")" = "$before" ]
grep -qF "$new -> $new" "$tmp/out2"
echo 'ok: bump-pin resolves a local bare remote and is idempotent'
