#!/usr/bin/env bash
# Print the command that runs Lizard in this environment, or exit 3.
#   lizard            binary on PATH
#   python3 -I -m lizard module importable (isolated mode)
#   uvx lizard        uv, downloads on demand (off with COMPLEXITY_NO_FETCH=1)
#   pipx run lizard   pipx, downloads on demand (off with COMPLEXITY_NO_FETCH=1)
set -uo pipefail
if command -v lizard >/dev/null 2>&1; then echo "lizard"; exit 0; fi
# -I keeps the analyzed repo off sys.path, so a repo file named lizard.py never runs.
if python3 -I -c 'import lizard' >/dev/null 2>&1; then echo "python3 -I -m lizard"; exit 0; fi
# uvx/pipx download an unpinned package. Set COMPLEXITY_NO_FETCH=1 to disable.
if [ "${COMPLEXITY_NO_FETCH:-0}" != 1 ]; then
  if command -v uvx >/dev/null 2>&1; then echo "uvx lizard"; exit 0; fi
  if command -v pipx >/dev/null 2>&1; then echo "pipx run lizard"; exit 0; fi
fi
exit 3
