#!/usr/bin/env bash
# Definitions only; initialized and called by main.sh.

# First element of settings.json's npmCommand[] (the package manager pi shells
# out to), or empty if unset. Collapses newlines so a multi-line array parses.
pi_pkg_manager() {
  [ -f "$1" ] || return 0
  tr -d '\n' <"$1" | sed -n 's/.*"npmCommand"[[:space:]]*:[[:space:]]*\[[[:space:]]*"\([^"]*\)".*/\1/p'
}

# pnpm's default isolated node_modules only exposes a package's own dependencies
# via symlinks reachable from its real path in the store. pi loads extensions
# through the top-level alias without resolving that real path, so a transitive
# dep like @shikijs/cli (a dependency of @heyhuynhgiabuu/pi-diff) is invisible
# and the extension fails with "Cannot find module". A hoisted layout puts those
# deps at the top level where they resolve through the alias too. This only
# applies to pnpm — npm/yarn/bun lay out flat already — so gate on npmCommand and
# skip otherwise. Changing the linker means the existing isolated store must be
# discarded so pnpm, which pi re-runs on launch, rebuilds it flat.
install_pnpm_hoist() {
  local npm_dir="$1" settings="$2"
  local pm; pm="$(pi_pkg_manager "$settings")"
  if [ "$pm" != "pnpm" ]; then
    echo "  [hoist] -> skip (npmCommand=${pm:-unset}, hoisting is pnpm-only)"; return
  fi
  local rc="$npm_dir/.npmrc" line="node-linker=hoisted"
  mkdir -p "$npm_dir"
  if [ -f "$rc" ] && grep -qxF "$line" "$rc"; then
    echo "  [hoist] -> $rc (ok)"; return
  fi
  printf '%s\n' "$line" >>"$rc"          # keep any other settings already present
  rm -rf "$npm_dir/node_modules" "$npm_dir/pnpm-lock.yaml"
  echo "  [hoist] -> $rc (set, store reset for flat reinstall)"
}

# Remove the package and config directory retired by the lite-only migration. Compose
# the package basename so repository audits for the old extension name stay clean.
# Pi settings are copied before this runs; this removes state a settings rewrite cannot
# reconcile. It is intentionally idempotent.
remove_retired_delegation_state() {
  local agent_dir="$1" npm_dir="$1/npm" package_dir config_dir package_name manifest_key
  package_name="@maplezzk/pi-""interactive""-subagents"
  manifest_key="\"$package_name\""
  package_dir="$npm_dir/node_modules/$package_name"
  config_dir="$agent_dir/extensions/pi-""interactive""-subagents"
  local removed=0
  # Pi maintains its install manifest separately from settings. Remove the retired
  # direct dependency there too; otherwise a later `pi install` rehydrates it.
  if [ -f "$npm_dir/package.json" ] && grep -qF "$manifest_key" "$npm_dir/package.json"; then
    if ! command -v pnpm >/dev/null 2>&1; then
      echo "  [retired-delegation] pnpm not found; cannot remove stale direct dependency" >&2
      return 1
    fi
    if ! pnpm --dir "$npm_dir" remove "$package_name"; then
      echo "  [retired-delegation] failed to remove stale direct dependency" >&2
      return 1
    fi
    removed=$((removed + 1))
  fi
  for path in "$package_dir" "$config_dir"; do
    if [ -e "$path" ] || [ -L "$path" ]; then
      rm -rf "$path"
      removed=$((removed + 1))
    fi
  done
  if [ "$removed" -eq 0 ]; then
    echo "  [retired-delegation] -> $agent_dir (ok)"
  else
    echo "  [retired-delegation] -> $agent_dir ($removed removed)"
  fi
}

# Expose the Pi CLIs to ordinary shells: $PI_AGENT_DIR/bin is only on PATH inside Pi.
install_pi_cli_links() {
  local cli
  for cli in pi-secret pi-improve; do
    [ -x "$PI_AGENT_DIR/bin/$cli" ] || continue
    mkdir -p "$HOME/.local/bin"
    echo "  [link] $cli: $(link_one "$HOME/.local/bin/$cli" "$PI_AGENT_DIR/bin/$cli")"
  done
}

# pi-improve (the self-improvement loop) needs the agentic-tools checkout it
# opens worktrees against. Record the main worktree here, outside the repo, since
# the agent/skill symlinks it could infer it from dangle when install.sh last ran
# from a worktree that has since been removed. AGENTIC_TOOLS_REPO overrides it.
install_self_improve_repo() {
  [ -d "$PI_AGENT_DIR" ] || return 0
  local common root
  common="$(git -C "$REPO_ROOT" rev-parse --path-format=absolute --git-common-dir 2>/dev/null || true)"
  [ -n "$common" ] || { echo "  [self-improve] $REPO_ROOT is not a git checkout; repo path not recorded" >&2; return 0; }
  if [ "$(basename "$common")" = ".git" ]; then root="$(dirname "$common")"; else root="$common"; fi
  mkdir -p "$PI_AGENT_DIR/self-improve"
  if [ -f "$PI_AGENT_DIR/self-improve/repo" ] && [ "$(cat "$PI_AGENT_DIR/self-improve/repo")" = "$root" ]; then
    echo "  [self-improve] -> $PI_AGENT_DIR/self-improve/repo (ok)"
  else
    printf '%s\n' "$root" > "$PI_AGENT_DIR/self-improve/repo"
    echo "  [self-improve] -> $PI_AGENT_DIR/self-improve/repo (set to $root)"
  fi
}

install_typesafe_secret() {
  local key="${TYPESAFE_API_KEY:-}"
  local secret_dir="$PI_AGENT_DIR/secrets"
  local environment_dir="$HOME/.config/environment.d"
  [ -n "$key" ] || return 0
  umask 077
  mkdir -p "$secret_dir" "$environment_dir"
  printf '%s\n' "$key" > "$secret_dir/typesafe_api_key"
  printf 'TYPESAFE_API_KEY=%s\n' "$key" > "$environment_dir/90-typesafe.conf"
  chmod 600 "$secret_dir/typesafe_api_key" "$environment_dir/90-typesafe.conf"
  echo "  [secret] -> $secret_dir/typesafe_api_key"
  echo "  [environment] -> $environment_dir/90-typesafe.conf (active after next login)"
}

# pi-jev reads these only while its extension initializes. Install the
# versioned harness config into the user's environment so every future Pi
# session keeps model routing off and the other automatic modes on.
install_pi_jev_auto_modes() {
  local source="$REPO_ROOT/harness/pi/pi-jev-auto.conf"
  local environment_dir="$HOME/.config/environment.d"
  local target="$environment_dir/91-pi-jev-auto.conf"
  [ -d "$PI_AGENT_DIR" ] || { echo "  [environment] Pi not detected, skipping 91-pi-jev-auto.conf"; return 0; }
  [ -f "$source" ] || { echo "  [environment] missing $source" >&2; return 1; }
  mkdir -p "$environment_dir"
  cp "$source" "$target"
  chmod 644 "$target"
  echo "  [environment] -> $target (active after next login)"
}

# Pi installs a git source as a whole package and has no syntax for a
# subdirectory, so a monorepo whose root carries no pi manifest (one extension
# package per subdirectory) cannot be installed with `git:`. Each line of a
# harness/pi/vendor/*.txt manifest names `<url> <full-40-char-commit>`; the repo
# is cloned at that exact commit under $PI_AGENT_DIR/vendor/<host>/<path> and
# settings.json lists the subdirectories as relative local packages
# (`./vendor/<host>/<path>/<dir>`), which Pi resolves from the settings file.
# Idempotent: a clone already at the pinned commit is left alone; any other
# state is fetched and reset to it. A path that exists but is not a git clone
# is skipped, never deleted. Returns non-zero if any entry failed, because Pi
# silently skips a local package path that does not exist.
install_vendor_git() {
  local vendor_dir="$1" manifest_dir="$2" manifest url commit dest rel head tmp failed=0
  if [ ! -d "$manifest_dir" ]; then echo "  [vendor-git] no source $manifest_dir, skipping"; return; fi
  if ! command -v git >/dev/null 2>&1; then echo "  [vendor-git] git not on PATH, skipping"; return; fi
  for manifest in "$manifest_dir"/*.txt; do
    [ -f "$manifest" ] || continue
    while read -r url commit _ || [ -n "$url" ]; do
      case "$url" in ''|\#*) continue ;; esac
      if [ -z "$commit" ] || ! [[ "$commit" =~ ^[0-9a-f]{40}$ ]]; then
        echo "  [vendor-git] $manifest: '$url' needs a full 40-char commit SHA, skipping" >&2; failed=1; continue
      fi
      rel="${url#*://}"; rel="${rel#git@}"; rel="${rel/://}"; rel="${rel%.git}"; rel="${rel%/}"
      if ! [[ "$rel" =~ ^[A-Za-z0-9._-]+(/[A-Za-z0-9._-]+)+$ ]] || [[ "/$rel/" == *"/../"* ]]; then
        echo "  [vendor-git] $manifest: cannot derive a safe path from '$url', skipping" >&2; failed=1; continue
      fi
      dest="$vendor_dir/$rel"
      if [ -d "$dest/.git" ]; then
        head="$(git -C "$dest" rev-parse HEAD 2>/dev/null || true)"
        if [ "$head" = "$commit" ]; then echo "  [vendor-git] -> $dest (ok)"; continue; fi
        if git -C "$dest" fetch -q origin "$commit" 2>/dev/null || git -C "$dest" fetch -q origin; then
          if git -C "$dest" -c advice.detachedHead=false checkout -q --force "$commit"; then
            echo "  [vendor-git] -> $dest (updated to ${commit:0:12})"
          else
            echo "  [vendor-git] $dest: commit $commit not found" >&2; failed=1
          fi
        else
          echo "  [vendor-git] $dest: fetch failed, keeping ${head:0:12}" >&2; failed=1
        fi
        continue
      fi
      if [ -e "$dest" ]; then
        echo "  [vendor-git] $dest exists but is not a git clone, skipping" >&2; failed=1; continue
      fi
      mkdir -p "$(dirname "$dest")"
      tmp="$(mktemp -d "$vendor_dir/.clone.XXXXXX")"
      if git clone -q -- "$url" "$tmp" && git -C "$tmp" -c advice.detachedHead=false checkout -q "$commit" \
         && mv "$tmp" "$dest"; then
        echo "  [vendor-git] -> $dest (cloned at ${commit:0:12})"
      else
        echo "  [vendor-git] $dest: clone of $url at $commit failed" >&2; rm -rf "$tmp"; failed=1
      fi
    done <"$manifest"
  done
  return "$failed"
}
