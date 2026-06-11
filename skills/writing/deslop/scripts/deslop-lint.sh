#!/usr/bin/env bash
# deslop-lint: flag AI vocabulary tells and signature phrases for review.
#
# Mirrors references/phrases.md. Flags candidates only; a human or agent
# decides each replacement in context. Exit 1 if any candidate is found
# (useful in CI), 0 otherwise.
#
# Usage:
#   deslop-lint.sh FILE [FILE...]
#   deslop-lint.sh < input.txt
#   git diff --name-only | xargs deslop-lint.sh
set -uo pipefail

# Single words / short terms matched on word boundaries, case-insensitive.
# Format: "term|suggested replacement"
WORDS=(
  "delve|examine, look at"
  "canonical|standard, reference, definitive"
  "tapestry|mix, combination, range"
  "nuanced|complex, subtle, specific"
  "robust|strong, solid"
  "leverage|use"
  "utilize|use"
  "streamline|simplify"
  "harness|use, apply"
  "paradigm|model, approach"
  "synergy|cooperation, combined effect"
  "ecosystem|system, field, community"
  "navigate|handle, address"
  "certainly|usually deletable"
  "really|delete"
  "just|delete"
  "literally|delete"
  "genuinely|delete"
  "simply|delete"
  "actually|delete"
  "fundamentally|delete"
  "inherently|delete"
  "interestingly|delete"
  "importantly|delete"
  "crucially|delete"
  "quietly|delete or be specific"
  "remarkably|delete"
  "arguably|delete"
)

# Multi-word phrases matched as case-insensitive substrings.
# Format: "phrase|note"
PHRASES=(
  "serves as|use: is"
  "stands as|use: is"
  "here's the thing|state the point directly"
  "here's why that matters|delete"
  "here's what|state the point directly"
  "it's worth noting|delete"
  "it bears mentioning|delete"
  "make no mistake|delete"
  "let that sink in|delete"
  "full stop|delete"
  "let's unpack|state the point directly"
  "let's break this down|state the point directly"
  "let's dive in|state the point directly"
  "let's delve|state the point directly"
  "let's explore|state the point directly"
  "deep dive|analysis, examination"
  "game-changer|significant, important"
  "double down|commit, increase"
  "circle back|return to, revisit"
  "moving forward|next, from now"
  "lean into|accept, embrace"
  "at its core|delete"
  "at the end of the day|delete"
  "when it comes to|delete"
  "in a world where|delete"
  "in today's|delete"
  "the reality is|delete"
)

status=0

emit() { # file lineno term note line
  printf '%s:%s: "%s" -> %s\n' "$1" "$2" "$3" "$4"
  printf '      %s\n' "$5"
  status=1
}

scan_file() {
  local label="$1" path="$2" entry term note lineno line
  for entry in "${WORDS[@]}"; do
    term="${entry%%|*}"; note="${entry#*|}"
    while IFS=: read -r lineno line; do
      [ -n "$lineno" ] && emit "$label" "$lineno" "$term" "$note" "$line"
    done < <(grep -niE "\\b${term}\\b" "$path" 2>/dev/null)
  done
  for entry in "${PHRASES[@]}"; do
    term="${entry%%|*}"; note="${entry#*|}"
    while IFS=: read -r lineno line; do
      [ -n "$lineno" ] && emit "$label" "$lineno" "$term" "$note" "$line"
    done < <(grep -niF "$term" "$path" 2>/dev/null)
  done
}

if [ "$#" -eq 0 ]; then
  tmp="$(mktemp)"
  trap 'rm -f "$tmp"' EXIT
  cat > "$tmp"
  scan_file "(stdin)" "$tmp"
else
  for f in "$@"; do
    if [ -f "$f" ]; then
      scan_file "$f" "$f"
    else
      printf 'deslop-lint: skipping non-file: %s\n' "$f" >&2
    fi
  done
fi

if [ "$status" -eq 0 ]; then
  printf 'deslop-lint: no candidates found.\n'
fi
exit "$status"
