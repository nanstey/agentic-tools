#!/usr/bin/env bash
# Tool: playwright-cli
# Description: Browser automation from the CLI — navigate, interact, screenshot, record video, mock network
# Upstream: https://github.com/microsoft/playwright
# Installation: npm install -g @playwright/cli@latest
# Verification: playwright-cli --version

set -euo pipefail

show_usage() {
  cat <<EOF
Usage: $0 [check|install|uninstall]

Tool: playwright-cli
Browser automation from the CLI for UI testing, screenshots, video recording, and network mocking.

Commands:
  check       Verify if playwright-cli is installed
  install     Install or upgrade playwright-cli
  uninstall   Uninstall playwright-cli

Prerequisites:
  - Node.js 20 or newer (npm)

EOF
}

# Check if playwright-cli is available
check_installed() {
  if command -v playwright-cli >/dev/null 2>&1; then
    local version; version="$(playwright-cli --version 2>/dev/null || echo 'unknown')"
    echo "✓ playwright-cli is installed ($version)"
    return 0
  else
    echo "✗ playwright-cli is not installed"
    return 1
  fi
}

# Install or upgrade playwright-cli
install_tool() {
  echo "Installing playwright-cli..."
  
  # Verify npm is available
  if ! command -v npm >/dev/null 2>&1; then
    echo "✗ Error: npm is not installed. Please install Node.js and npm first."
    return 1
  fi
  
  npm install -g @playwright/cli@latest || {
    echo "✗ Failed to install playwright-cli"
    return 1
  }
  
  if check_installed; then
    echo "✓ playwright-cli installation complete"
    return 0
  else
    echo "✗ playwright-cli installation verification failed"
    return 1
  fi
}

# Uninstall playwright-cli
uninstall_tool() {
  echo "Uninstalling playwright-cli..."
  
  if ! command -v npm >/dev/null 2>&1; then
    echo "✗ Error: npm is not installed"
    return 1
  fi
  
  npm uninstall -g @playwright/cli || {
    echo "✗ Failed to uninstall playwright-cli"
    return 1
  }
  
  echo "✓ playwright-cli uninstalled"
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
