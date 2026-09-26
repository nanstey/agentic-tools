#!/usr/bin/env bash
# Tool: gh-stack
# Description: GitHub CLI extension for stacked PRs
# Upstream: https://github.com/github/gh-stack
# Installation: gh extension install github/gh-stack
# Verification: gh stack --version

set -euo pipefail

show_usage() {
  cat <<EOF
Usage: $0 [check|install|upgrade|uninstall]

Tool: gh-stack
GitHub CLI extension for managing stacked pull requests.

Commands:
  check       Verify if gh-stack is installed
  install     Install gh-stack extension
  upgrade     Upgrade gh-stack to latest version
  uninstall   Uninstall gh-stack extension

Prerequisites:
  - GitHub CLI (gh) v2.0 or newer
  - GitHub authentication configured (gh auth login)

EOF
}

# Check if gh is available
check_gh() {
  if ! command -v gh >/dev/null 2>&1; then
    echo "✗ Error: GitHub CLI (gh) is not installed"
    echo "  Install it from: https://cli.github.com"
    return 1
  fi
  return 0
}

# Check if gh-stack is installed
check_installed() {
  if ! check_gh; then
    return 1
  fi
  
  if gh extension list 2>/dev/null | grep -q "github/gh-stack"; then
    local version; version="$(gh stack --version 2>/dev/null || echo 'unknown')"
    echo "✓ gh-stack is installed ($version)"
    return 0
  else
    echo "✗ gh-stack is not installed"
    return 1
  fi
}

# Install gh-stack
install_tool() {
  echo "Installing gh-stack..."
  
  if ! check_gh; then
    return 1
  fi
  
  # Check if already installed
  if gh extension list 2>/dev/null | grep -q "github/gh-stack"; then
    echo "✓ gh-stack is already installed"
    return 0
  fi
  
  gh extension install github/gh-stack || {
    echo "✗ Failed to install gh-stack"
    return 1
  }
  
  if check_installed; then
    echo "✓ gh-stack installation complete"
    return 0
  else
    echo "✗ gh-stack installation verification failed"
    return 1
  fi
}

# Upgrade gh-stack
upgrade_tool() {
  echo "Upgrading gh-stack..."
  
  if ! check_gh; then
    return 1
  fi
  
  if ! gh extension list 2>/dev/null | grep -q "github/gh-stack"; then
    echo "✗ gh-stack is not installed. Use 'install' command first."
    return 1
  fi
  
  gh extension upgrade github/gh-stack || {
    echo "✗ Failed to upgrade gh-stack"
    return 1
  }
  
  if check_installed; then
    echo "✓ gh-stack upgrade complete"
    return 0
  else
    echo "✗ gh-stack upgrade verification failed"
    return 1
  fi
}

# Uninstall gh-stack
uninstall_tool() {
  echo "Uninstalling gh-stack..."
  
  if ! check_gh; then
    return 1
  fi
  
  if ! gh extension list 2>/dev/null | grep -q "github/gh-stack"; then
    echo "✓ gh-stack is not installed"
    return 0
  fi
  
  gh extension remove github/gh-stack || {
    echo "✗ Failed to uninstall gh-stack"
    return 1
  }
  
  echo "✓ gh-stack uninstalled"
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
  upgrade)
    upgrade_tool
    ;;
  uninstall)
    uninstall_tool
    ;;
  *)
    show_usage
    exit 1
    ;;
esac
