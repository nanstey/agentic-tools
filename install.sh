#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(git -C "$(dirname "${BASH_SOURCE[0]:-$PWD}")" rev-parse --show-toplevel 2>/dev/null || echo "$PWD")" && pwd)"

# Each harness declares: name | detect_dir | binaries | type:dir;type:dir;...
# A harness installs only the artifact types it lists. Add a "type:dir" pair to
# teach a harness about a new type; add a row to support a new harness.
# A dir may be a glob (e.g. one skills dir per hermes profile): it expands to
# every existing match, so a single pair can fan out to many destinations.
HARNESSES=(
  "claude|$HOME/.claude|claude|skills:$HOME/.claude/skills;agents:$HOME/.claude/agents"
  "codex|$HOME/.codex|codex|skills:$HOME/.codex/skills"
  "cursor|$HOME/.cursor|cursor,cursor-agent|skills:$HOME/.cursor/skills"
  "openclaw|$HOME/.openclaw|openclaw|skills:$HOME/.openclaw/skills"
  "hermes|$HOME/.hermes|hermes|skills:$HOME/.hermes/skills;skills:$HOME/.hermes/profiles/*/skills"
)

# Extract the `name:` value from a file's YAML frontmatter.
fm_name() {
  awk -F: '/^name:[[:space:]]*/{sub(/^name:[[:space:]]*/,"");gsub(/[[:space:]]/,"");print;exit}' "$1"
}

# Skills: directories with a SKILL.md under skills/. Emits "linkname<TAB>srcdir".
collect_skills() {
  [ -d "$REPO_ROOT/skills" ] || return 0
  # `-exec dirname` instead of GNU-only `-printf '%h\n'` so this works on BSD/macOS find too.
  find "$REPO_ROOT/skills" -type f -name SKILL.md -not -path '*/.git/*' -exec dirname {} \; | sort -u |
  while read -r d; do
    n="$(fm_name "$d/SKILL.md")"; [ -n "$n" ] || n="$(basename "$d")"
    printf '%s\t%s\n' "$n" "$(cd "$d" && pwd)"
  done
}

# Agents: *.md files under agents/. Emits "linkname.md<TAB>srcfile".
collect_agents() {
  [ -d "$REPO_ROOT/agents" ] || return 0
  find "$REPO_ROOT/agents" -type f -name '*.md' -not -path '*/.git/*' |
  while read -r f; do
    n="$(fm_name "$f")"; [ -n "$n" ] || n="$(basename "${f%.md}")"
    printf '%s.md\t%s\n' "$n" "$(cd "$(dirname "$f")" && pwd)/$(basename "$f")"
  done
}

# Present if the home dir exists or any listed binary is on PATH.
present() {
  [ -d "$1" ] && return 0
  local IFS=','; for b in $2; do command -v "$b" >/dev/null 2>&1 && return 0; done
  return 1
}

# Idempotent linker shared by all types (file or directory source). Prints a
# single category word (ok|repoint|link|conflict) so callers can tally rather
# than emit a line per artifact.
link_one() {
  local link="$1" src="$2"
  if [ -L "$link" ]; then
    if [ "$(readlink -f "$link")" = "$src" ]; then echo ok
    else ln -sfn "$src" "$link"; echo repoint; fi
  elif [ -e "$link" ]; then
    echo conflict
  else
    ln -s "$src" "$link"; echo link
  fi
}

for entry in "${HARNESSES[@]}"; do
  IFS='|' read -r name detect_dir bins typemap <<<"$entry"
  if ! present "$detect_dir" "$bins"; then echo "skip $name (not installed)"; continue; fi
  echo "== $name"
  IFS=';' read -ra pairs <<<"$typemap"
  for pair in "${pairs[@]}"; do
    type="${pair%%:*}"; pattern="${pair#*:}"
    case "$type" in
      skills) collector=collect_skills ;;
      agents) collector=collect_agents ;;
      *) echo "  [$type] unknown type, skipping"; continue ;;
    esac
    # The dir may be a glob; nullglob makes a non-matching pattern expand to
    # nothing rather than to itself.
    shopt -s nullglob; dirs=( $pattern ); shopt -u nullglob
    if [ "${#dirs[@]}" -eq 0 ]; then
      # No matches: a literal path installs anyway (creating it), but an unmatched
      # glob has no destination — e.g. a harness with no profiles yet — so skip it.
      case "$pattern" in
        *[*?[]*) echo "  [$type] no match for $pattern, skipping"; continue ;;
        *) dirs=( "$pattern" ) ;;
      esac
    fi
    for dir in "${dirs[@]}"; do
      mkdir -p "$dir"
      ok=0; linked=0; repointed=0; conflicts=()
      while IFS=$'\t' read -r linkname src; do
        [ -n "$linkname" ] || continue
        case "$(link_one "$dir/$linkname" "$src")" in
          ok)       ok=$((ok+1)) ;;
          link)     linked=$((linked+1)) ;;
          repoint)  repointed=$((repointed+1)) ;;
          conflict) conflicts+=("$linkname") ;;
        esac
      done < <($collector)
      # One summary line per destination; conflicts also listed since they need a fix.
      summary="$ok ok"
      [ "$linked" -gt 0 ] && summary="$summary, $linked linked"
      [ "$repointed" -gt 0 ] && summary="$summary, $repointed repointed"
      [ "${#conflicts[@]}" -gt 0 ] && summary="$summary, ${#conflicts[@]} conflict"
      echo "  [$type] -> $dir ($summary)"
      for c in "${conflicts[@]}"; do echo "      CONFLICT $c (real path exists, left untouched)"; done
    done
  done
done
