#!/usr/bin/env bash
# Definitions only; initialized and called by main.sh.

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
