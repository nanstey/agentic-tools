#!/usr/bin/env bash
# Tool: orca
# Description: Orca IDE CLI — orchestration layer for coding agents
# Upstream: https://github.com/orca-cli/orca
# Installation: Varies by OS (brew, from source)
# Verification: orca --version

set -euo pipefail

show_usage() {
  cat <<EOF
Usage: $0 [check|install]

Tool: orca
Orca IDE CLI — orchestration layer for coding agents (Claude Code, Codex, Aider).
Run agents in parallel, isolated in their own git worktrees, with a unified review queue.

Commands:
  check       Verify if Orca CLI is installed
  install     Install Orca CLI (OS-dependent)

Supported OS:
  - Linux: Install from source (requires Go)
  - macOS: Install via Homebrew

macOS Installation:
  brew install orca-cli/tap/orca

Linux Installation (from source):
  Requires Go 1.18+ installed
  git clone https://github.com/orca-cli/orca
  cd orca && go install ./cmd/orca

Full docs: https://github.com/orca-cli/orca

EOF
}

# Check if orca is installed
check_installed() {
  if command -v orca >/dev/null 2>&1; then
    local version; version="$(orca --version 2>/dev/null || echo 'unknown')"
    echo "✓ Orca CLI is installed ($version)"
    return 0
  else
    echo "✗ Orca CLI is not installed"
    return 1
  fi
}

# Install Orca CLI
install_tool() {
  echo "Installing Orca CLI..."
  
  if check_installed; then
    echo "✓ Orca CLI is already installed"
    return 0
  fi
  
  local os; os="$(uname -s)"
  
  case "$os" in
    Darwin)
      # macOS
      if ! command -v brew >/dev/null 2>&1; then
        echo "✗ Error: Homebrew is required on macOS"
        echo "  Install Homebrew from: https://brew.sh"
        return 1
      fi
      echo "Installing Orca CLI via Homebrew..."
      brew install orca-cli/tap/orca || {
        echo "✗ Failed to install Orca CLI via Homebrew"
        return 1
      }
      ;;
    Linux)
      # Linux — build from source
      if ! command -v go >/dev/null 2>&1; then
        echo "✗ Error: Go 1.18+ is required to build Orca CLI from source"
        echo "  Install Go from: https://golang.org/doc/install"
        return 1
      fi
      
      echo "Building Orca CLI from source..."
      local tmpdir; tmpdir="$(mktemp -d)"
      trap 'rm -rf "$tmpdir"' RETURN
      
      git clone https://github.com/orca-cli/orca "$tmpdir" || {
        echo "✗ Failed to clone Orca repository"
        return 1
      }
      
      cd "$tmpdir"
      go install ./cmd/orca || {
        echo "✗ Failed to build Orca CLI"
        return 1
      }
      
      echo "✓ Orca CLI built and installed"
      ;;
    *)
      echo "✗ Unsupported OS: $os"
      echo "  Please install Orca CLI manually from: https://github.com/orca-cli/orca"
      return 1
      ;;
  esac
  
  if check_installed; then
    echo "✓ Orca CLI installation complete"
    return 0
  else
    echo "✗ Orca CLI installation verification failed"
    return 1
  fi
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
  *)
    show_usage
    exit 1
    ;;
esac
