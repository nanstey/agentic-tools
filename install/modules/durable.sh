#!/usr/bin/env bash
# Definitions only; initialized and called by main.sh.

# Install only production dependencies when the package metadata changes. The
# stamp lives in the pinned clone so a new commit naturally gets a fresh check.
install_durable_deps() {
  local clone_dir="$1" stamp="$1/.durable-deps.sha256" hash
  if ! command -v pnpm >/dev/null 2>&1; then
    echo "  [durable] pnpm not on PATH, skipping dependencies"
    return 0
  fi
  if [ ! -f "$clone_dir/package.json" ] || [ ! -f "$clone_dir/pnpm-lock.yaml" ]; then
    echo "  [durable] $clone_dir has no package.json or pnpm-lock.yaml, skipping dependencies" >&2
    return 1
  fi
  hash="$(sha256sum "$clone_dir/package.json" "$clone_dir/pnpm-lock.yaml" | sha256sum | awk '{print $1}')" || return 1
  if [ -f "$stamp" ] && [ "$(cat "$stamp")" = "$hash" ]; then
    echo "  [durable] dependencies -> $clone_dir (ok)"
    return 0
  fi
  if pnpm --dir "$clone_dir" install --frozen-lockfile --prod --ignore-scripts; then
    printf '%s\n' "$hash" >"$stamp"
    echo "  [durable] dependencies -> $clone_dir (installed)"
  else
    echo "  [durable] dependency install failed" >&2
    return 1
  fi
}

install_durable_cli_link() {
  local clone_dir="$1" cli="$1/bin/durable"
  # The initial pinned durable commit exposes the Node entrypoint as durable.ts;
  # later releases may provide the executable extensionless wrapper.
  if [ ! -e "$cli" ] && [ -f "$cli.ts" ]; then
    cli="$cli.ts"
  fi
  if [ ! -f "$cli" ]; then
    echo "  [durable] no CLI entrypoint in $clone_dir/bin, skipping CLI link" >&2
    return 1
  fi
  chmod u+x "$cli"
  mkdir -p "$HOME/.local/bin"
  echo "  [link] durable: $(link_one "$HOME/.local/bin/durable" "$cli")"
}

install_durable() {
  local vendor_dir="$1" manifest_dir="$2" clone_dir="$1/github.com/nanstey/durable"
  install_vendor_git "$vendor_dir" "$manifest_dir" || return 1
  install_durable_deps "$clone_dir" || return 1
  install_durable_cli_link "$clone_dir"
}
