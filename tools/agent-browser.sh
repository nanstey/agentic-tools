#!/usr/bin/env bash
# Tool: agent-browser
# Description: Native browser automation CLI with a persistent daemon driving Chrome over CDP
# Upstream: https://github.com/vercel-labs/agent-browser
# Installation: npm install -g agent-browser@latest && agent-browser install
# Verification: agent-browser --version

set -euo pipefail

show_usage() {
  cat <<EOF
Usage: $0 [check|install|uninstall]

Tool: agent-browser
Native browser automation CLI with a persistent daemon driving Chrome over CDP.

Commands:
  check       Verify if agent-browser is installed
  install     Install or upgrade agent-browser
  uninstall   Uninstall agent-browser

Prerequisites:
  - Node.js 20 or newer (npm)
  - Chrome/Chromium, or allow agent-browser install to download Chrome for Testing

EOF
}

# Check if agent-browser is available
check_installed() {
  if command -v agent-browser >/dev/null 2>&1; then
    local version; version="$(agent-browser --version 2>/dev/null || echo 'unknown')"
    echo "✓ agent-browser is installed ($version)"
    return 0
  else
    echo "✗ agent-browser is not installed"
    return 1
  fi
}

# Install or upgrade agent-browser
install_tool() {
  echo "Installing agent-browser..."
  
  # Verify npm is available
  if ! command -v npm >/dev/null 2>&1; then
    echo "✗ Error: npm is not installed. Please install Node.js and npm first."
    return 1
  fi
  
  npm install -g agent-browser@latest || {
    echo "✗ Failed to install agent-browser"
    return 1
  }

  local npm_binary="$(npm prefix -g)/bin/agent-browser"
  local resolved_path="$(command -v agent-browser || true)"
  if [ -n "$resolved_path" ] && [ "$resolved_path" != "$npm_binary" ]; then
    echo "⚠ Warning: another agent-browser on PATH is shadowing the npm-installed binary: $resolved_path"
  fi
  
  agent-browser install || {
    echo "✗ Failed to provision Chrome for agent-browser. For Linux system dependencies, run: agent-browser install --with-deps"
    return 1
  }
  
  if check_installed; then
    echo "✓ agent-browser installation complete"
    return 0
  else
    echo "✗ agent-browser installation verification failed"
    return 1
  fi
}

# Uninstall agent-browser
uninstall_tool() {
  echo "Uninstalling agent-browser..."
  
  if ! command -v npm >/dev/null 2>&1; then
    echo "✗ Error: npm is not installed"
    return 1
  fi
  
  npm uninstall -g agent-browser || {
    echo "✗ Failed to uninstall agent-browser"
    return 1
  }
  
  echo "✓ agent-browser uninstalled"
  return 0
}

# Main
if [ $# -eq 0 ]; then
  show_usage
  exit 0
fi

case "${1:-}" in
  check)
    check_installed
    ;;
  install)
    install_tool
    ;;
  uninstall)
    uninstall_tool
    ;;
  *)
    show_usage
    exit 1
    ;;
esac
