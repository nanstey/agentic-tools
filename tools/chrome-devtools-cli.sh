#!/usr/bin/env bash
# Tool: chrome-devtools-cli
# Description: Automate browser tasks and use Chrome DevTools from the CLI
# Upstream: https://github.com/ChromeDevTools/chrome-devtools-mcp
# Installation: npm install -g chrome-devtools-mcp@latest
# Verification: chrome-devtools status

set -euo pipefail

show_usage() {
  cat <<EOF
Usage: $0 [check|install|uninstall]

Tool: chrome-devtools-cli
Automate browser tasks and use Chrome DevTools from the CLI for debugging and automation.

Commands:
  check       Verify if chrome-devtools-cli is installed
  install     Install or upgrade chrome-devtools-cli
  uninstall   Uninstall chrome-devtools-cli

Prerequisites:
  - Node.js v20.19 or newer (npm)
  - Chrome browser (current stable or newer)

EOF
}

# Check if chrome-devtools-cli is available
check_installed() {
  if command -v chrome-devtools >/dev/null 2>&1; then
    local status; status="$(chrome-devtools status 2>/dev/null || echo 'status check failed')"
    echo "✓ chrome-devtools-cli is installed"
    echo "  Status: $status"
    return 0
  else
    echo "✗ chrome-devtools-cli is not installed"
    return 1
  fi
}

# Install or upgrade chrome-devtools-cli
install_tool() {
  echo "Installing chrome-devtools-cli..."
  
  # Verify npm is available
  if ! command -v npm >/dev/null 2>&1; then
    echo "✗ Error: npm is not installed. Please install Node.js and npm first."
    return 1
  fi
  
  # Check for Chrome/Chromium
  if ! command -v google-chrome >/dev/null 2>&1 && \
     ! command -v google-chrome-stable >/dev/null 2>&1 && \
     ! command -v chromium >/dev/null 2>&1 && \
     ! command -v chromium-browser >/dev/null 2>&1; then
    echo "⚠ Warning: Chrome/Chromium browser not found in PATH"
    echo "  The CLI requires a Chrome browser to be installed separately"
  fi
  
  npm install -g chrome-devtools-mcp@latest || {
    echo "✗ Failed to install chrome-devtools-cli"
    return 1
  }
  
  if check_installed; then
    echo "✓ chrome-devtools-cli installation complete"
    return 0
  else
    echo "✗ chrome-devtools-cli installation verification failed"
    return 1
  fi
}

# Uninstall chrome-devtools-cli
uninstall_tool() {
  echo "Uninstalling chrome-devtools-cli..."
  
  if ! command -v npm >/dev/null 2>&1; then
    echo "✗ Error: npm is not installed"
    return 1
  fi
  
  npm uninstall -g chrome-devtools-mcp || {
    echo "✗ Failed to uninstall chrome-devtools-cli"
    return 1
  }
  
  echo "✓ chrome-devtools-cli uninstalled"
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
