#!/usr/bin/env bash
# Definitions only; initialized and called by main.sh.

# Report tools and suggest root installation when tools are missing.
check_tools() {
  local tools_dir; tools_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../tools" && pwd)"
  if [ ! -f "$tools_dir/install.sh" ]; then
    echo "  [tools] no installer found at $tools_dir/install.sh, skipping"
    return 0
  fi

  echo "== Tools"

  # Just check; don't auto-install to respect idempotency and allow offline-first workflow
  if ! bash "$tools_dir/install.sh" --check-status 2>&1 | sed 's/^/  /'; then
    local root_dir; root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
    echo "  [tools] Some tools are missing. To install, run:"
    printf '    bash %q --tools\n' "$root_dir/install.sh"
    echo "  See $root_dir/install/TOOL_INSTALLATION.md for details."
  fi
}
