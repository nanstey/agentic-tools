#!/usr/bin/env bash
# Report functions that exceed complexity thresholds, worst first.
# Usage: complexity.sh [--base REF] [--full] [--ccn N] [--nloc N] [--args N] [--all] [PATH...]
# Default scope: files changed since merge-base(BASE, HEAD): commits, staged, unstaged, untracked.
#   BASE defaults to origin/HEAD, then origin/main, main, master, else HEAD (uncommitted only).
#   PATH...    narrow the changed set to these files or folders
#   --full     ignore git state; analyze PATH... (or the whole repo) completely
#   --base REF compare against REF instead of the default base
#   --ccn N    cyclomatic complexity limit      (default 10)
#   --nloc N   lines of code per function limit (default 60)
#   --args N   parameter count limit            (default 5)
#   --all      list every function, not only violations
# Output: TSV  CCN  NLOC  PARAMS  FUNCTION  LOCATION  FLAGS   (header first; summary on stderr)
# Exit: 0 analyzed (violations are data, not failure), 2 bad usage, 3 Lizard unavailable.
set -uo pipefail

ccn=10 nloc=60 args=5 all=0 full=0 base="" paths=()
while [ $# -gt 0 ]; do
  case "$1" in
    --ccn)  ccn="${2:?}"; shift 2 ;;
    --nloc) nloc="${2:?}"; shift 2 ;;
    --args) args="${2:?}"; shift 2 ;;
    --base) base="${2:?}"; shift 2 ;;
    --all)  all=1; shift ;;
    --full) full=1; shift ;;
    -h|--help) sed -n 2,15p "$0"; exit 0 ;;
    -*) echo "unknown option: $1" >&2; exit 2 ;;
    *) paths+=("$1"); shift ;;
  esac
done

for v in "$ccn" "$nloc" "$args"; do
  case "$v" in ''|*[!0-9]*) echo "limits must be non-negative integers: $v" >&2; exit 2 ;; esac
done
if [ -n "$base" ]; then
  git rev-parse --verify -q "$base^{commit}" >/dev/null 2>&1 || { echo "unknown base ref: $base" >&2; exit 2; }
fi

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if ! cmd="$("$here/resolve-lizard.sh")"; then
  echo "Lizard not found. Install: ./install.sh --tool lizard (or: pipx install lizard / uv tool install lizard)" >&2
  exit 3
fi

in_git=0
git rev-parse --is-inside-work-tree >/dev/null 2>&1 && in_git=1

if [ "$full" = 0 ] && [ "$in_git" = 1 ]; then
  if [ -z "$base" ]; then
    base=HEAD
    for c in "$(git symbolic-ref -q --short refs/remotes/origin/HEAD 2>/dev/null)" origin/main main master; do
      [ -n "$c" ] && git rev-parse --verify -q "$c^{commit}" >/dev/null && { base="$c"; break; }
    done
  fi
  if ! mb="$(git merge-base "$base" HEAD 2>/dev/null)"; then
    echo "warning: no merge-base with $base (shallow clone?); diffing against $base directly" >&2
    mb="$base"
  fi
  # Run from the repo root so diff paths resolve; keep user paths relative to the caller.
  root="$(cd "$(git rev-parse --show-toplevel)" && pwd -P)"
  prefix="$(git rev-parse --show-prefix)"
  selected=()
  # while-read, not mapfile: stock macOS Bash is 3.2.
  while IFS= read -r f; do
    [ -f "$root/$f" ] || continue
    if [ ${#paths[@]} -gt 0 ]; then
      keep=0
      for p in "${paths[@]}"; do
        rp="${p#./}"; [ "$rp" = . ] && rp=""
        case "$p" in
          /*) ap="$(realpath -m "$p" 2>/dev/null || echo "$p")"; rel="${ap#"$root"}"; rel="${rel#/}" ;;
          *) rel="$prefix$rp" ;;
        esac
        rel="${rel%/}"
        if [ -z "$rel" ] || [ "$f" = "$rel" ] || [[ "$f" == "$rel"/* ]]; then keep=1; break; fi
      done
      [ $keep = 1 ] || continue
    fi
    selected+=("$root/$f")
  done < <({ git diff --name-only --diff-filter=ACMR "$mb" -- ; git ls-files --others --exclude-standard; } 2>/dev/null | sort -u)
  [ ${#selected[@]} -gt 0 ] || { echo "no changed files since ${mb:0:10} (base: $base)" >&2; echo -e "CCN\tNLOC\tPARAMS\tFUNCTION\tLOCATION\tFLAGS"; exit 0; }
  paths=("${selected[@]}")
elif [ ${#paths[@]} -eq 0 ]; then
  # Whole repository when inside git, else the current directory.
  if [ "$in_git" = 1 ]; then paths=("$(git rev-parse --show-toplevel)"); else paths=(.); fi
fi

# CSV columns: NLOC,CCN,token,PARAM,length,location,file,function,long_name,start,end
# No -l filter: Lizard auto-detects every language it supports. Exclude vendored/generated trees.
$cmd --csv \
  -x '*/node_modules/*' -x '*/vendor/*' -x '*/dist/*' -x '*/build/*' -x '*/.git/*' -x '*/target/*' \
  -x '*/__pycache__/*' -x '*.min.js' -x '*/.venv/*' "${paths[@]}" 2>/dev/null |
python3 -c '
import csv, sys, os
ccn_l, nloc_l, args_l, show_all = map(int, sys.argv[1:5])
rows = []
for r in csv.reader(sys.stdin):
    if len(r) < 10: continue
    try: nloc, ccn, par = int(r[0]), int(r[1]), int(r[3])
    except ValueError: continue
    flags = [n for n, bad in (("CCN", ccn > ccn_l), ("NLOC", nloc > nloc_l), ("ARGS", par > args_l)) if bad]
    if flags or show_all:
        f = os.path.relpath(r[6])
        rows.append((ccn, nloc, par, r[7], f"{f}:{r[9]}", ",".join(flags) or "-"))
rows.sort(key=lambda x: (-x[0], -x[1]))
print("CCN\tNLOC\tPARAMS\tFUNCTION\tLOCATION\tFLAGS")
for x in rows: print("\t".join(map(str, x)))
print(f"# {len(rows)} function(s) listed; limits CCN>{ccn_l} NLOC>{nloc_l} ARGS>{args_l}", file=sys.stderr)
' "$ccn" "$nloc" "$args" "$all"
