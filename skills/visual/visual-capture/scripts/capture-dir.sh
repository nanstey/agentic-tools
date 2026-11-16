#!/usr/bin/env bash
# Print the capture directory for the current repository and branch. Captures
# always live below the OS temporary directory, never in the Git worktree.
# Re-running on the same repository and branch reuses the same directory.
#
# Layout:  <canonical-temp>/visual-capture/<repo-slug>-<repo-checksum>/<branch-slug>-<branch-checksum>
# Usage:   capture-dir.sh
set -euo pipefail

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

slugify() {
  printf '%s' "$1" \
    | tr '[:upper:]' '[:lower:]' \
    | tr -c 'a-z0-9' '-' \
    | tr -s '-' \
    | sed 's/^-//; s/-$//'
}

repo_root="$(git rev-parse --show-toplevel 2>/dev/null)" \
  || { echo "capture-dir: not inside a Git worktree" >&2; exit 1; }
repo_root="$(realpath -e -- "$repo_root")" \
  || { echo "capture-dir: cannot canonicalize repository root" >&2; exit 1; }

temp_root="$(realpath -e -- "${TMPDIR:-/tmp}")" \
  || { echo "capture-dir: cannot canonicalize temporary directory" >&2; exit 1; }
[ -d "$temp_root" ] \
  || { echo "capture-dir: temporary directory is not a directory" >&2; exit 1; }
if is_within "$temp_root" "$repo_root"; then
  echo "capture-dir: temporary directory resolves inside the repository" >&2
  exit 1
fi

capture_root="$temp_root/visual-capture"
mkdir -p "$capture_root"
capture_root="$(realpath -e -- "$capture_root")" \
  || { echo "capture-dir: cannot canonicalize capture root" >&2; exit 1; }

if ! is_within "$capture_root" "$temp_root" || is_within "$capture_root" "$repo_root"; then
  echo "capture-dir: capture root is outside temporary storage or inside the repository" >&2
  exit 1
fi

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

# Do not traverse a pre-existing symlink before creating either path component.
[ ! -L "$repo_dir" ] \
  || { echo "capture-dir: repository capture directory is a symlink" >&2; exit 1; }
mkdir -p "$repo_dir"
repo_dir="$(realpath -e -- "$repo_dir")" \
  || { echo "capture-dir: cannot canonicalize repository capture directory" >&2; exit 1; }
if ! is_within "$repo_dir" "$capture_root" || is_within "$repo_dir" "$repo_root"; then
  echo "capture-dir: repository capture directory is unsafe" >&2
  exit 1
fi

dir="$repo_dir/$branch_slug-$branch_checksum"
[ ! -L "$dir" ] \
  || { echo "capture-dir: branch capture directory is a symlink" >&2; exit 1; }
mkdir -p "$dir"
dir="$(realpath -e -- "$dir")" \
  || { echo "capture-dir: cannot canonicalize capture directory" >&2; exit 1; }

if ! is_within "$dir" "$repo_dir" || is_within "$dir" "$repo_root"; then
  echo "capture-dir: capture directory is unsafe" >&2
  exit 1
fi

printf '%s\n' "$dir"
