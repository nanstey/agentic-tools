#!/usr/bin/env bash
# Offline applicator regression tests. No installed packages are modified.
set -euo pipefail
REPO="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$REPO"
SB="$(mktemp -d)"
trap 'rm -rf "$SB"' EXIT
# Load definitions only, without running the installer or reading local secrets.
source "$REPO/install/modules/patches.sh"
pkg="$SB/package"
mkdir -p "$pkg/src"
printf 'first\nsecond\n' > "$pkg/src/test.ts"
printf '%s\n' '--- a/src/test.ts' '+++ b/src/test.ts' '@@ -1,2 +1,2 @@' '-first' '+patched' ' second' > "$SB/test.patch"
apply_package_patch "$pkg" test "$SB/test.patch" src/test.ts | grep -q '(patched)'
apply_package_patch "$pkg" test "$SB/test.patch" src/test.ts | grep -q '(ok)'
echo 'ok: patch applies once, then reports ok'
apply_package_patch "$SB/missing" test "$SB/test.patch" src/test.ts | grep -q 'not installed yet, skipping'
echo 'ok: missing package is skipped'
printf 'changed upstream\nsecond\n' > "$pkg/src/test.ts"
cp "$pkg/src/test.ts" "$SB/before"
if apply_package_patch "$pkg" test "$SB/test.patch" src/test.ts > "$SB/result" 2>&1; then
  echo 'FAIL: changed upstream accepted' >&2; exit 1
fi
cmp "$pkg/src/test.ts" "$SB/before"
grep -q 'upstream code changed' "$SB/result"
echo 'ok: upstream mismatch fails without changing the file'
# A failed later hunk must not leave an earlier hunk applied.
printf '%s\n' '--- a/src/test.ts' '+++ b/src/test.ts' '@@ -1 +1 @@' '-changed upstream' '+patched' '@@ -10 +10 @@' '-absent' '+replacement' > "$SB/multi.patch"
if apply_package_patch "$pkg" test "$SB/multi.patch" src/test.ts > "$SB/result" 2>&1; then
  echo 'FAIL: partial patch accepted' >&2; exit 1
fi
cmp "$pkg/src/test.ts" "$SB/before"
echo 'ok: failed multi-hunk dry run leaves file untouched'
