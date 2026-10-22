#!/usr/bin/env bash
# Print the command that runs Lizard in this environment, or exit 3.
#   lizard            binary on PATH
#   uvx lizard        uv, no install needed
#   pipx run lizard   pipx, no install needed
#   python3 -m lizard module importable
set -uo pipefail
if command -v lizard >/dev/null 2>&1; then echo "lizard"; exit 0; fi
if command -v uvx >/dev/null 2>&1; then echo "uvx lizard"; exit 0; fi
if command -v pipx >/dev/null 2>&1; then echo "pipx run lizard"; exit 0; fi
if python3 -c 'import lizard' >/dev/null 2>&1; then echo "python3 -m lizard"; exit 0; fi
exit 3
