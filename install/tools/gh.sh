#!/usr/bin/env bash
# Tool: gh
# Description: GitHub CLI — GitHub management from the command line
# Upstream: https://github.com/cli/cli
# Installation from repository root: ./install.sh --tool gh
# Verification: gh --version

set -euo pipefail

show_usage() {
  cat <<EOF
Install from the repository root:
  ./install.sh --tool gh

Internal adapter interface:
Usage: $0 [check|install]

Tool: gh
GitHub CLI — manage repositories, PRs, issues, and releases from the command line.

Commands:
  check       Verify if GitHub CLI is installed
  install     Install GitHub CLI (OS-dependent)

Supported OS:
  - Linux (Fedora, Ubuntu/Debian, Arch, etc.) — see detect_distro
  - macOS (via Homebrew)

The root installer selects the platform package manager.

Full docs: https://cli.github.com/manual/installation

EOF
}

# Detect Linux distribution
detect_distro() {
  if [ -f /etc/os-release ]; then
    . /etc/os-release
    echo "${ID:-unknown}"
  else
    echo "unknown"
  fi
}

# Check if gh is installed
check_installed() {
  if command -v gh >/dev/null 2>&1; then
    local version; version="$(gh --version 2>/dev/null | head -1)"
    echo "✓ GitHub CLI is installed ($version)"
    return 0
  else
    echo "✗ GitHub CLI is not installed"
    return 1
  fi
}

# Install GitHub CLI
install_tool() {
  echo "Installing GitHub CLI..."
  
  if check_installed; then
    echo "✓ GitHub CLI is already installed"
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
      echo "Installing gh via Homebrew..."
      brew install gh || {
        echo "✗ Failed to install GitHub CLI via Homebrew"
        return 1
      }
      ;;
    Linux)
      # Linux
      local distro; distro="$(detect_distro)"
      
      case "$distro" in
        fedora|rhel|centos)
          echo "Installing gh via dnf (Fedora/RHEL)..."
          sudo dnf install -y gh || {
            echo "✗ Failed to install GitHub CLI via dnf"
            return 1
          }
          ;;
        ubuntu|debian)
          echo "Installing gh via apt (Ubuntu/Debian)..."
          sudo apt-get update
          sudo apt-get install -y gh || {
            echo "✗ Failed to install GitHub CLI via apt"
            return 1
          }
          ;;
        arch|manjaro)
          echo "Installing gh via pacman (Arch Linux)..."
          sudo pacman -S --noconfirm github-cli || {
            echo "✗ Failed to install GitHub CLI via pacman"
            return 1
          }
          ;;
        alpine)
          echo "Installing gh via apk (Alpine Linux)..."
          sudo apk add github-cli || {
            echo "✗ Failed to install GitHub CLI via apk"
            return 1
          }
          ;;
        *)
          echo "✗ Unknown Linux distribution: $distro"
          echo "  No automatic GitHub CLI installation is available for this distribution."
          return 1
          ;;
      esac
      ;;
    *)
      echo "✗ Unsupported OS: $os"
      echo "  No automatic GitHub CLI installation is available for this OS."
      return 1
      ;;
  esac
  
  if check_installed; then
    echo "✓ GitHub CLI installation complete"
    return 0
  else
    echo "✗ GitHub CLI installation verification failed"
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
