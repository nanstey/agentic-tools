#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(git -C "$(dirname "${BASH_SOURCE[0]:-$PWD}")" rev-parse --show-toplevel 2>/dev/null || echo "$PWD")" && pwd)"

# Load machine-local installer environment when the calling shell did not
# already provide the key. The git-ignored file accepts shell assignments.
if [ -z "${TYPESAFE_API_KEY:-}" ] && [ -f "$REPO_ROOT/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  . "$REPO_ROOT/.env"
  set +a
fi
PI_AGENT_DIR="${PI_CODING_AGENT_DIR:-$HOME/.pi/agent}"

# Each harness declares: name | detect_dir | binaries | type:dir;type:dir;...
# A harness installs only the artifact types it lists. Add a "type:dir" pair to
# teach a harness about a new type; add a row to support a new harness.
# A dir may be a glob (e.g. one skills dir per hermes profile): it expands to
# every existing match, so a single pair can fan out to many destinations.
HARNESSES=(
  "claude|$HOME/.claude|claude|skills:$HOME/.claude/skills;agents:$HOME/.claude/agents"
  "pi|$PI_AGENT_DIR|pi|skills:$PI_AGENT_DIR/skills;agents:$PI_AGENT_DIR/agents;config:$PI_AGENT_DIR::$REPO_ROOT/harness/pi;config:$PI_AGENT_DIR/extensions::$REPO_ROOT/harness/pi/extensions;config:$PI_AGENT_DIR/extensions/pi-interactive-subagents::$REPO_ROOT/harness/pi/extensions/pi-interactive-subagents;config:$PI_AGENT_DIR/intercom::$REPO_ROOT/harness/pi/extensions/pi-intercom;hoist:$PI_AGENT_DIR/npm::$REPO_ROOT/harness/pi/settings.json"
  "omp|$HOME/.omp/agent|omp|skills:$HOME/.omp/agent/skills;skills:$HOME/.omp/profiles/*/agent/skills;agents:$HOME/.omp/agent/agents;agents:$HOME/.omp/profiles/*/agent/agents;config:$HOME/.omp/agent::$REPO_ROOT/harness/omp;config:$PI_AGENT_DIR/intercom::$REPO_ROOT/harness/pi/extensions/pi-intercom;omp-plugin-manifest:$REPO_ROOT/harness/omp/plugins/pi-intercom.txt;omp-plugin-manifest:$REPO_ROOT/harness/omp/plugins/pi-jev.txt;omp-status-line:$REPO_ROOT/harness/omp/status-line/apply.sh"
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

# Config files are copied (not symlinked) because the harness may rewrite them
# locally (e.g. pi updates lastChangelogVersion). Copies the top-level files of
# src_dir into dest_dir, skipping dotfiles and subdirs. Reports ok|copy|update.
copy_one() {
  local dest="$1" src="$2"
  if [ -e "$dest" ] && cmp -s "$dest" "$src"; then echo ok
  elif [ -e "$dest" ]; then cp "$src" "$dest"; echo update
  else cp "$src" "$dest"; echo copy; fi
}

install_config() {
  local dest_dir="$1" src_dir="$2"
  if [ ! -d "$src_dir" ]; then echo "  [config] no source $src_dir, skipping"; return; fi
  mkdir -p "$dest_dir"
  local ok=0 copied=0 updated=0
  while IFS= read -r f; do
    [ -n "$f" ] || continue
    case "$(copy_one "$dest_dir/$(basename "$f")" "$f")" in
      ok)     ok=$((ok+1)) ;;
      copy)   copied=$((copied+1)) ;;
      update) updated=$((updated+1)) ;;
    esac
  done < <(find "$src_dir" -maxdepth 1 -type f -not -name '.*')
  local summary="$ok ok"
  [ "$copied" -gt 0 ] && summary="$summary, $copied copied"
  [ "$updated" -gt 0 ] && summary="$summary, $updated updated"
  echo "  [config] -> $dest_dir ($summary)"
}

# OMP's config CLI performs schema-aware updates. Apply the shared status
# settings to the default config and every existing profile config while leaving
# profile-local choices, such as composer shape and model roles, untouched.
install_omp_status_line() {
  local applicator="$1" agent_dir
  local -a agent_dirs=("$HOME/.omp/agent")
  if [ ! -f "$applicator" ]; then
    echo "  [status-line] no source $applicator, skipping"
    return
  fi
  if [ -d "$HOME/.omp/profiles" ]; then
    shopt -s nullglob
    agent_dirs+=("$HOME"/.omp/profiles/*/agent)
    shopt -u nullglob
  fi
  for agent_dir in "${agent_dirs[@]}"; do
    [ -d "$agent_dir" ] || continue
    (cd "$REPO_ROOT" && bash "$applicator" "$agent_dir")
  done
}

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

# Installed OMP npm plugins as "name@version" lines, read from omp's JSON
# listing. Whitespace is stripped so each entry's adjacent name/version keys
# match as one token; names and versions never contain whitespace.
omp_installed_plugins() {
  omp plugin list --json 2>/dev/null | tr -d ' \n\t' \
    | grep -o '"name":"[^"]*","version":"[^"]*"' \
    | sed 's/"name":"\([^"]*\)","version":"\([^"]*\)"/\1@\2/' \
    || true
}

# OMP delegates package installation to bun. Standalone OMP installations may
# not have bun on PATH, so use the official npm bun package through npx without
# permanently installing another global runtime.
omp_install_package() {
  local package="$1" npx_path tmp rc
  if command -v bun >/dev/null 2>&1; then
    omp install "$package"
    return
  fi
  npx_path="$(command -v npx || true)"
  if [ -z "$npx_path" ]; then
    echo "  [omp-plugin-manifest] cannot install $package: bun and npx are both unavailable" >&2
    return 1
  fi
  tmp="$(mktemp -d)"
  trap 'rm -rf "$tmp"' RETURN
  printf '#!/usr/bin/env bash\nexec "%s" --yes bun "$@"\n' "$npx_path" > "$tmp/bun"
  chmod 700 "$tmp/bun"
  if PATH="$tmp:$PATH" omp install "$package"; then rc=0; else rc=$?; fi
  rm -rf "$tmp"
  trap - RETURN
  return "$rc"
}

# Install each uncommented package specification in an OMP plugin manifest using
# OMP's native installer. The manifest is repository metadata, not runtime config.
# An npm:<name>@<version> spec already present at that exact version is skipped:
# `omp install` shells out to bun even for a no-op reinstall, and bun need not be
# on the machine once the plugin is in place. Git specs always reinstall.
install_omp_plugin_manifest() {
  local manifest="$1" package installed=0 uptodate=0 have
  if ! command -v omp >/dev/null 2>&1; then
    echo "  [omp-plugin-manifest] omp not on PATH, skipping"
    return
  fi
  if [ ! -f "$manifest" ]; then
    echo "  [omp-plugin-manifest] no source $manifest, skipping"
    return
  fi
  have="$(omp_installed_plugins)"
  while IFS= read -r package || [ -n "$package" ]; do
    package="${package#"${package%%[![:space:]]*}"}"
    package="${package%"${package##*[![:space:]]}"}"
    case "$package" in
      ''|\#*) continue ;;
      npm:*@*)
        if grep -qxF "${package#npm:}" <<<"$have"; then
          uptodate=$((uptodate+1)); continue
        fi ;;
    esac
    if ! omp_install_package "$package"; then
      echo "  [omp-plugin-manifest] failed to install $package" >&2
      return 1
    fi
    installed=$((installed+1))
  done < "$manifest"
  echo "  [omp-plugin-manifest] -> $manifest ($installed installed, $uptodate up to date)"
}

# Present if the home dir exists or any listed binary is on PATH.
present() {
  [ -d "$1" ] && return 0
  local IFS=','; for b in $2; do command -v "$b" >/dev/null 2>&1 && return 0; done
  return 1
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

install_typesafe_secret

for entry in "${HARNESSES[@]}"; do
  IFS='|' read -r name detect_dir bins typemap <<<"$entry"
  if ! present "$detect_dir" "$bins"; then echo "skip $name (not installed)"; continue; fi
  echo "== $name"
  IFS=';' read -ra pairs <<<"$typemap"
  for pair in "${pairs[@]}"; do
    type="${pair%%:*}"; pattern="${pair#*:}"
    # config pairs encode both destination and source as DEST::SRC and are
    # copied rather than symlinked, so they bypass the shared linker loop.
    if [ "$type" = "config" ]; then
      install_config "${pattern%%::*}" "${pattern##*::}"; continue
    fi
    # The OMP status-line applicator follows its config copy so it can merge its
    # managed schema keys without copying a partial config.yml into the agent dir.
    if [ "$type" = "omp-status-line" ]; then
      install_omp_status_line "$pattern"
      continue
    fi
    # hoist pairs encode NPMDIR::SETTINGS; they bypass the linker loop too.
    if [ "$type" = "hoist" ]; then
      install_pnpm_hoist "${pattern%%::*}" "${pattern##*::}"; continue
    fi
    # OMP plugin manifests are repository metadata, not copied runtime config.
    if [ "$type" = "omp-plugin-manifest" ]; then
      install_omp_plugin_manifest "$pattern"; continue
    fi
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
      # One summary line per destination.
      summary="$ok ok"
      [ "$linked" -gt 0 ] && summary="$summary, $linked linked"
      [ "$repointed" -gt 0 ] && summary="$summary, $repointed repointed"
      [ "$overwritten" -gt 0 ] && summary="$summary, $overwritten overwritten"
      echo "  [$type] -> $dir ($summary)"
    done
  done
done

# Check and optionally install external tools
check_tools() {
  local tools_dir; tools_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/tools" && pwd)"
  if [ ! -f "$tools_dir/install.sh" ]; then
    echo "  [tools] no installer found at $tools_dir/install.sh, skipping"
    return 0
  fi
  
  echo "== Tools"
  
  # Just check; don't auto-install to respect idempotency and allow offline-first workflow
  if ! bash "$tools_dir/install.sh" --check 2>&1 | sed 's/^/  /'; then
    echo "  [tools] Some tools are missing. To install, run:"
    echo "    bash $tools_dir/install.sh --install-all"
    echo "  or install specific tools individually:"
    echo "    bash $tools_dir/install.sh --install gh"
    echo "    bash $tools_dir/install.sh --install playwright-cli"
    echo "  See $tools_dir/README.md for details."
  fi
}

check_tools
