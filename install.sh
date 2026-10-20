#!/usr/bin/env bash
set -euo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/install/main.sh"

# Keep this additional patch after the modular installer's existing Jev patches.
# Target router construction, not pi-jev.patch's flag default, so all three
# patches remain independently reversible on subsequent installs.
install_jev_self_improve_thinking_patch() {
  apply_package_patch "$1" patch-jev-self-improve-thinking "$REPO_ROOT/harness/pi/patches/pi-jev-self-improve-thinking.patch" extensions/index.ts
}

install_main "$@"

# Help must not perform installation. Normal runs initialize these helpers and
# paths in install_main. Match its Pi detection before applying the final patch.
if [ "${1:-}" != --help ] && present "$PI_AGENT_DIR" pi; then
  install_jev_self_improve_thinking_patch "$PI_AGENT_DIR/npm/node_modules/pi-jev"
fi
