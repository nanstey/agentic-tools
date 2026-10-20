#!/usr/bin/env bash
# Definitions only; initialized and called by main.sh.

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

# Idempotent linker shared by all types (file or directory source). Prints a
# single category word (ok|repoint|link|overwrite) so callers can tally rather
# than emit a line per artifact. The repo is the source of truth, so a real
# (non-symlink) path occupying a managed name is replaced with the symlink.
link_one() {
  local link="$1" src="$2"
  if [ -L "$link" ]; then
    if [ "$(readlink -f "$link")" = "$src" ]; then echo ok
    else ln -sfn "$src" "$link"; echo repoint; fi
  elif [ -e "$link" ]; then
    rm -rf "$link"; ln -s "$src" "$link"; echo overwrite
  else
    ln -s "$src" "$link"; echo link
  fi
}

# Keep the destination loop in the calling shell, including its shared counters.
install_artifacts() {
  type="$1"; pattern="$2"
  case "$type" in
    skills) collector=collect_skills ;;
    agents) collector=collect_agents ;;
    *) echo "  [$type] unknown type, skipping"; return 0 ;;
  esac
  # The dir may be a glob; nullglob makes a non-matching pattern expand to
  # nothing rather than to itself.
  shopt -s nullglob; dirs=( $pattern ); shopt -u nullglob
  if [ "${#dirs[@]}" -eq 0 ]; then
    # No matches: a literal path installs anyway (creating it), but an unmatched
    # glob has no destination — e.g. a harness with no profiles yet — so skip it.
    case "$pattern" in
      *[*?[]*) echo "  [$type] no match for $pattern, skipping"; return 0 ;;
      *) dirs=( "$pattern" ) ;;
    esac
  fi
  for dir in "${dirs[@]}"; do
    mkdir -p "$dir"
    ok=0; linked=0; repointed=0; overwritten=0
    while IFS=$'\t' read -r linkname src; do
      [ -n "$linkname" ] || continue
      case "$(link_one "$dir/$linkname" "$src")" in
        ok)        ok=$((ok+1)) ;;
        link)      linked=$((linked+1)) ;;
        repoint)   repointed=$((repointed+1)) ;;
        overwrite) overwritten=$((overwritten+1)) ;;
      esac
    done < <($collector)
    # Retired tools leave dangling links behind; drop them so loaders that
    # read every entry in the directory do not fail.
    for stale in "$dir"/*; do
      [ -L "$stale" ] && [ ! -e "$stale" ] && { rm -f "$stale"; echo "  [$type] removed dangling $(basename "$stale")"; }
    done
    # One summary line per destination.
    summary="$ok ok"
    [ "$linked" -gt 0 ] && summary="$summary, $linked linked"
    [ "$repointed" -gt 0 ] && summary="$summary, $repointed repointed"
    [ "$overwritten" -gt 0 ] && summary="$summary, $overwritten overwritten"
    echo "  [$type] -> $dir ($summary)"
  done
}
