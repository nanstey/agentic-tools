# Provides pristine_subagents_dir: prints a cached, unmodified copy of the
# published @tintinweb/pi-subagents package that the strict-dispatch patch targets.
# Tests copy from it and never modify it. Set PI_SUBAGENTS_PRISTINE_DIR to use a
# local copy instead of downloading.
PI_SUBAGENTS_VERSION=0.22.1

pristine_subagents_dir() {
  if [ -n "${PI_SUBAGENTS_PRISTINE_DIR:-}" ]; then
    printf '%s\n' "$PI_SUBAGENTS_PRISTINE_DIR"
    return
  fi
  local cache="${XDG_CACHE_HOME:-$HOME/.cache}/skills-tests/pi-subagents-$PI_SUBAGENTS_VERSION"
  if [ ! -f "$cache/package.json" ] || [ ! -f "$cache/src/settings.ts" ]; then
    local tmp
    tmp="$(mktemp -d)"
    (cd "$tmp" && npm pack "@tintinweb/pi-subagents@$PI_SUBAGENTS_VERSION" --silent >/dev/null && tar xzf ./*.tgz) \
      || { rm -rf "$tmp"; echo "cannot download @tintinweb/pi-subagents@$PI_SUBAGENTS_VERSION (set PI_SUBAGENTS_PRISTINE_DIR for offline use)" >&2; return 1; }
    mkdir -p "$(dirname "$cache")"
    rm -rf "$cache"
    # Keep only what the patch touches; the full package is large and copied often.
    mkdir -p "$cache/src"
    cp "$tmp/package/package.json" "$tmp/package/LICENSE" "$cache/"
    cp "$tmp/package/src/index.ts" "$tmp/package/src/settings.ts" "$tmp/package/src/types.ts" "$cache/src/"
    rm -rf "$tmp"
  fi
  printf '%s\n' "$cache"
}
