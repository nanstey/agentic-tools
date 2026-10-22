#!/usr/bin/env bash
# Tool: lizard
# Description: Cyclomatic complexity, function length, and parameter count for many languages
# Upstream: https://github.com/terryyin/lizard
# Installation from repository root: ./install.sh --tool lizard
# Verification: lizard --version

set -euo pipefail

show_usage() {
  cat <<EOF
Install from the repository root:
  ./install.sh --tool lizard

Internal adapter interface:
Usage: $0 [check|install|uninstall]

Tool: lizard
Code complexity analyzer used by the complexity skill.

Commands:
  check       Verify if lizard is installed
  install     Install or upgrade lizard
  uninstall   Uninstall lizard

Prerequisites:
  - uv, pipx, or Python 3 with pip

EOF
}

check_installed() {
  if command -v lizard >/dev/null 2>&1; then
    echo "✓ lizard is installed ($(lizard --version 2>/dev/null || echo unknown))"
    return 0
  fi
  echo "✗ lizard is not installed"
  return 1
}

install_tool() {
  echo "Installing lizard..."
  if command -v uv >/dev/null 2>&1; then
    uv tool install --upgrade lizard || { echo "✗ Failed to install lizard"; return 1; }
  elif command -v pipx >/dev/null 2>&1; then
    pipx install --force lizard || { echo "✗ Failed to install lizard"; return 1; }
  elif command -v pip3 >/dev/null 2>&1; then
    pip3 install --user --upgrade lizard || { echo "✗ Failed to install lizard"; return 1; }
  else
    echo "✗ Error: none of uv, pipx, or pip3 is available."
    return 1
  fi
  if check_installed; then
    echo "✓ lizard installation complete"
    return 0
  fi
  echo "✗ lizard installation verification failed (check that the install directory is on PATH)"
  return 1
}

uninstall_tool() {
  echo "Uninstalling lizard..."
  if command -v uv >/dev/null 2>&1 && uv tool list 2>/dev/null | grep -q '^lizard'; then
    uv tool uninstall lizard
  elif command -v pipx >/dev/null 2>&1 && pipx list 2>/dev/null | grep -q lizard; then
    pipx uninstall lizard
  elif command -v pip3 >/dev/null 2>&1; then
    pip3 uninstall -y lizard
  else
    echo "✗ Error: none of uv, pipx, or pip3 is available"
    return 1
  fi
  echo "✓ lizard uninstalled"
}

if [ $# -eq 0 ]; then show_usage; exit 0; fi
case "${1:-}" in
  check) check_installed ;;
  install) install_tool ;;
  uninstall) uninstall_tool ;;
  *) show_usage; exit 1 ;;
esac
