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

# Remove this installer's managed Pi profiles before an unavailable or failed
# strict-dispatch patch can leave an upstream Agent tool with usable profiles.
# Only manifest-listed files are removed, so a user-owned scout.md or worker.md
# is never touched.
disable_managed_pi_agents() {
  local dir="$1" manifest="$1/.agentic-tools-pi-agents" name target removed=0
  [ -d "$dir" ] || return 0
  while IFS= read -r name; do
    case "$name" in
      *.md) ;;
      *) continue ;;
    esac
    case "$name" in .*|*/*) continue ;; esac
    target="$dir/$name"
    if [ -e "$target" ] || [ -L "$target" ]; then
      rm -rf "$target"
      removed=$((removed + 1))
    fi
  done < <({
    [ -f "$manifest" ] && cat "$manifest"
  } | sort -u)
  rm -f "$manifest"
  echo "  [pi-agents] -> $dir ($removed disabled; strict dispatch patch unavailable)" >&2
}

# Managed Pi profiles are copied as regular files. The candidate discovers that
# form, and keeping it avoids a discovery patch while the manifest lets future
# installs retire only files this installer owns, leaving user-created profiles alone.
install_pi_agents() {
  local dir="$1" manifest next_manifest entry target linkname src stale
  local ok=0 copied=0 migrated=0 replaced=0 removed=0
  mkdir -p "$dir"
  manifest="$dir/.agentic-tools-pi-agents"
  next_manifest="$(mktemp "$dir/.agentic-tools-pi-agents.XXXXXX")" || {
    echo "  [pi-agents] cannot create manifest in $dir" >&2
    return 1
  }

  # Migrate the previous per-file symlink layout and remove managed dangling
  # links. Do not touch user-owned links outside this repository's agents/ tree.
  for entry in "$dir"/*; do
    [ -L "$entry" ] || continue
    if [ ! -e "$entry" ]; then
      # link_one creates absolute links, so this catches only dangling profiles
      # from the old Pi install layout and preserves dangling user-owned links.
      target="$(readlink "$entry" 2>/dev/null || true)"
      case "$target" in
        "$REPO_ROOT"/agents/*.md)
          rm -f "$entry"
          removed=$((removed + 1))
          ;;
      esac
      continue
    fi
    target="$(readlink -f "$entry" 2>/dev/null || true)"
    case "$target" in
      "$REPO_ROOT"/agents/*.md)
        rm -f "$entry"
        migrated=$((migrated + 1))
        ;;
    esac
  done

  while IFS=$'\t' read -r linkname src; do
    [ -n "$linkname" ] || continue
    printf '%s\n' "$linkname" >>"$next_manifest"
  done < <(collect_agents)

  # Retire only files listed by a previous installer manifest. Reject unsafe
  # names in case a local manifest was edited outside the installer.
  if [ -f "$manifest" ]; then
    while IFS= read -r stale; do
      case "$stale" in
        *.md) ;;
        *) continue ;;
      esac
      case "$stale" in .*|*/*) continue ;; esac
      if grep -qxF -- "$stale" "$next_manifest"; then continue; fi
      target="$dir/$stale"
      if [ -e "$target" ] || [ -L "$target" ]; then
        rm -rf "$target"
        removed=$((removed + 1))
      fi
    done <"$manifest"
  fi

  while IFS=$'\t' read -r linkname src; do
    [ -n "$linkname" ] || continue
    target="$dir/$linkname"
    if [ -L "$target" ]; then
      rm -f "$target"
      replaced=$((replaced + 1))
    elif [ -f "$target" ]; then
      if cmp -s "$src" "$target"; then
        ok=$((ok + 1))
        continue
      fi
    elif [ -e "$target" ]; then
      rm -rf "$target"
      replaced=$((replaced + 1))
    fi
    if ! cp "$src" "$target"; then
      rm -f "$next_manifest"
      return 1
    fi
    copied=$((copied + 1))
  done < <(collect_agents)

  mv -f "$next_manifest" "$manifest"
  local summary="$ok ok"
  [ "$copied" -gt 0 ] && summary="$summary, $copied copied"
  [ "$migrated" -gt 0 ] && summary="$summary, $migrated migrated"
  [ "$replaced" -gt 0 ] && summary="$summary, $replaced replaced"
  [ "$removed" -gt 0 ] && summary="$summary, $removed removed"
  echo "  [pi-agents] -> $dir ($summary)"
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

# Remove dangling artifact links, and live links into this repo's agents/ (Pi-only), from destinations that no longer install that artifact
# type. This mirrors the cleanup in install_artifacts without creating a missing
# destination directory.
prune_dangling_artifacts() {
  local pattern="$1" dir stale
  local -a dirs
  shopt -s nullglob; dirs=( $pattern ); shopt -u nullglob
  if [ "${#dirs[@]}" -eq 0 ]; then
    case "$pattern" in
      *[*?[]*) return 0 ;;
      *) dirs=( "$pattern" ) ;;
    esac
  fi
  for dir in "${dirs[@]}"; do
    [ -d "$dir" ] || continue
    for stale in "$dir"/*; do
      [ -L "$stale" ] || continue
      if [ ! -e "$stale" ]; then
        rm -f "$stale"; echo "  [agents] removed dangling $(basename "$stale")"
      elif [ -n "${REPO_ROOT:-}" ]; then
        case "$(readlink -f "$stale")" in
          "$REPO_ROOT"/agents/*) rm -f "$stale"; echo "  [agents] removed Pi-only $(basename "$stale")" ;;
        esac
      fi
    done
  done
  return 0
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
