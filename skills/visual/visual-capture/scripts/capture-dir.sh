#!/usr/bin/env bash
# Print the private capture directory for the current repository and branch.
# Captures always live below the OS temporary directory, never in the Git
# worktree. Re-running on the same repository and branch reuses the directory.
#
# Layout: <canonical-temp>/visual-capture-<uid>/<repo-slug>-<repo-checksum>/<branch-slug>-<branch-checksum>
# Usage: capture-dir.sh
set -euo pipefail
export LC_ALL=C

if [ "$#" -ne 0 ]; then
  echo "usage: capture-dir.sh" >&2
  exit 2
fi

is_within() {
  local path="$1" root="$2"
  [ "$path" = "$root" ] && return 0
  [ "$root" = "/" ] && return 0
  case "$path" in
    "$root"/*) return 0 ;;
  esac
  return 1
}

canonical_dir() (
  [ -d "$1" ] || exit 1
  cd -P -- "$1" || exit 1
  pwd -P
)

safe_capture_path() {
  case "$1" in
    /*) ;;
    *) return 1 ;;
  esac
  # gh uses # as an attachment separator. Restrict the caller-controlled
  # temporary prefix so its descendants are safe as literal Markdown paths.
  case "$1" in
    *[!A-Za-z0-9_./-]*) return 1 ;;
  esac
}

private_dir() {
  python3 -I -c '
import os
import stat
import sys
path = sys.argv[1]
st = os.lstat(path)
if not stat.S_ISDIR(st.st_mode):
    raise SystemExit("not a directory")
if st.st_uid != os.geteuid():
    raise SystemExit("wrong owner")
if stat.S_IMODE(st.st_mode) != 0o700:
    raise SystemExit("directory mode is not 0700")
' "$1"
}

ensure_private_dir() {
  local path="$1" label="$2"
  if [ -L "$path" ]; then
    echo "capture-dir: $label is a symlink" >&2
    exit 1
  fi
  if [ ! -e "$path" ]; then
    mkdir -m 700 "$path" \
      || { echo "capture-dir: cannot create $label" >&2; exit 1; }
  fi
  if ! private_dir "$path"; then
    echo "capture-dir: $label must be an owned private directory (mode 0700)" >&2
    exit 1
  fi
}

slugify() {
  printf '%s' "$1" \
    | tr '[:upper:]' '[:lower:]' \
    | tr -c 'a-z0-9' '-' \
    | tr -s '-' \
    | sed 's/^-//; s/-$//'
}

repo_root="$(git rev-parse --show-toplevel 2>/dev/null)" \
  || { echo "capture-dir: not inside a Git worktree" >&2; exit 1; }
repo_root="$(canonical_dir "$repo_root")" \
  || { echo "capture-dir: cannot canonicalize repository root" >&2; exit 1; }

temp_root="$(canonical_dir "${TMPDIR:-/tmp}")" \
  || { echo "capture-dir: temporary directory is not a directory" >&2; exit 1; }
if ! safe_capture_path "$temp_root"; then
  echo "capture-dir: temporary directory has characters unsafe for gh attachment paths" >&2
  exit 1
fi
if is_within "$temp_root" "$repo_root"; then
  echo "capture-dir: temporary directory resolves inside the repository" >&2
  exit 1
fi

# Every directory created below this point is private from creation onward.
umask 077
capture_root="$temp_root/visual-capture-$(id -u)"
ensure_private_dir "$capture_root" "capture root"

# Current branch; on detached HEAD fall back to the short commit SHA.
branch="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || true)"
if [ -z "$branch" ] || [ "$branch" = "HEAD" ]; then
  branch="$(git rev-parse --short HEAD 2>/dev/null || echo detached)"
fi

repo_slug="$(slugify "$(basename "$repo_root")")"
branch_slug="$(slugify "$branch")"
[ -n "$repo_slug" ] || repo_slug="repository"
[ -n "$branch_slug" ] || branch_slug="detached"

# Checksums keep slug collisions from merging different repositories or branches.
repo_checksum="$(printf '%s' "$repo_root" | cksum | awk '{print $1}')"
branch_checksum="$(printf '%s' "$branch" | cksum | awk '{print $1}')"
repo_dir="$capture_root/$repo_slug-$repo_checksum"
ensure_private_dir "$repo_dir" "repository capture directory"

dir="$repo_dir/$branch_slug-$branch_checksum"
ensure_private_dir "$dir" "branch capture directory"

# Revalidate every returned path immediately before printing it.
private_dir "$capture_root" \
  || { echo "capture-dir: capture root is no longer private" >&2; exit 1; }
private_dir "$repo_dir" \
  || { echo "capture-dir: repository capture directory is no longer private" >&2; exit 1; }
private_dir "$dir" \
  || { echo "capture-dir: branch capture directory is no longer private" >&2; exit 1; }
if ! is_within "$dir" "$capture_root" || is_within "$dir" "$repo_root"; then
  echo "capture-dir: capture directory is unsafe" >&2
  exit 1
fi

printf '%s\n' "$dir"
