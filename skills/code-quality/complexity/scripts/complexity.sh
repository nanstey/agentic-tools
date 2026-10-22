#!/usr/bin/env bash
# Report functions that exceed complexity thresholds, worst first.
# Usage: complexity.sh [--changed [BASE]] [--ccn N] [--nloc N] [--args N] [--all] [PATH...]
#   --changed [BASE]  analyze only files changed versus BASE (default HEAD, plus untracked)
#   --ccn N           cyclomatic complexity limit      (default 10)
#   --nloc N          lines of code per function limit (default 60)
#   --args N          parameter count limit            (default 5)
#   --all             list every function, not only violations
# Output: TSV  CCN  NLOC  PARAMS  FUNCTION  FILE:LINE  FLAGS   (header first)
# Exit: 0 analyzed (violations are data, not failure), 2 bad usage, 3 Lizard unavailable.
set -uo pipefail

ccn=10 nloc=60 args=5 all=0 changed=0 base=HEAD paths=()
while [ $# -gt 0 ]; do
  case "$1" in
    --ccn)  ccn="${2:?}"; shift 2 ;;
    --nloc) nloc="${2:?}"; shift 2 ;;
    --args) args="${2:?}"; shift 2 ;;
    --all)  all=1; shift ;;
    --changed) changed=1; shift
      if [ $# -gt 0 ] && [[ "$1" != -* ]] && git rev-parse --verify -q "$1^{commit}" >/dev/null 2>&1; then base="$1"; shift; fi ;;
    -h|--help) sed -n 2,11p "$0"; exit 0 ;;
    -*) echo "unknown option: $1" >&2; exit 2 ;;
    *) paths+=("$1"); shift ;;
  esac
done

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if ! cmd="$("$here/resolve-lizard.sh")"; then
  echo "Lizard not found. Install: ./install.sh --tool lizard (or: pipx install lizard / uv tool install lizard)" >&2
  exit 3
fi

if [ "$changed" = 1 ]; then
  mapfile -t files < <({ git diff --name-only --diff-filter=ACMR "$base" --; git ls-files --others --exclude-standard; } 2>/dev/null | sort -u)
  existing=()
  for f in "${files[@]}"; do
    [ -f "$f" ] || continue
    if [ ${#paths[@]} -gt 0 ]; then
      keep=0; for p in "${paths[@]}"; do case "$f" in "$p"|"$p"/*) keep=1 ;; esac; done
      [ $keep = 1 ] || continue
    fi
    existing+=("$f")
  done
  paths=("${existing[@]}")
  [ ${#paths[@]} -gt 0 ] || { echo "no changed files"; exit 0; }
elif [ ${#paths[@]} -eq 0 ]; then
  paths=(.)
fi

# CSV columns: NLOC,CCN,token,PARAM,length,location,file,function,long_name,start,end
# No -l filter: Lizard auto-detects every language it supports. Exclude vendored/generated trees.
$cmd --csv \
  -x '*/node_modules/*' -x '*/vendor/*' -x '*/dist/*' -x '*/build/*' -x '*/.git/*' -x '*/target/*' \
  -x '*/__pycache__/*' -x '*.min.js' -x '*/.venv/*' "${paths[@]}" 2>/dev/null |
python3 -c '
import csv, sys
ccn_l, nloc_l, args_l, show_all = map(int, sys.argv[1:5])
rows = []
for r in csv.reader(sys.stdin):
    if len(r) < 10: continue
    try: nloc, ccn, par = int(r[0]), int(r[1]), int(r[3])
    except ValueError: continue
    flags = [n for n, bad in (("CCN", ccn > ccn_l), ("NLOC", nloc > nloc_l), ("ARGS", par > args_l)) if bad]
    if flags or show_all:
        rows.append((ccn, nloc, par, r[7], f"{r[6]}:{r[9]}", ",".join(flags) or "-"))
rows.sort(key=lambda x: (-x[0], -x[1]))
print("CCN\tNLOC\tPARAMS\tFUNCTION\tLOCATION\tFLAGS")
for x in rows: print("\t".join(map(str, x)))
print(f"# {len(rows)} function(s) listed; limits CCN>{ccn_l} NLOC>{nloc_l} ARGS>{args_l}", file=sys.stderr)
' "$ccn" "$nloc" "$args" "$all"
