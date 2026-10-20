#!/usr/bin/env bash
# Master tools installer — orchestrates all external tool installations
# Idempotent: safe to re-run; skips already-installed tools
# Part of the main install.sh workflow

set -euo pipefail

TOOLS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TOOLS=(
  "gh"
  "gh-stack"
  "playwright-cli"
  "chrome-devtools-cli"
  "agent-browser"
  "orca"
)

show_usage() {
  cat <<EOF
Usage: $0 [options]

Internal tool CLI for agentic-tools dependencies.
Install tools from the repository root with ./install.sh --tools or ./install.sh --tool TOOL.

Internal options:
  --help              Show this help message
  --check             Report installed tools (missing tools do not fail)
  --check-status      Internal report: return 1 for non-skipped missing tools
  --install-all       Internal action used by root --tools
  --install TOOL      Internal action used by root --tool TOOL
  --tool-help TOOL    Show help for a specific tool installer
  --validate TOOL     Validate a tool name without running its installer

Environment:
  TOOLS_SKIP          Comma-separated tools to skip (e.g., TOOLS_SKIP=orca,gh-stack)
  TOOLS_INTERACTIVE   Set to 0 to suppress interactive prompts (default: interactive if TTY)

Examples:
  # Check all tools
  $0 --check

  # Install tools from the repository root
  ./install.sh --tools

  # Skip orca CLI when installing all
  TOOLS_SKIP=orca ./install.sh --tools

  # Install specific tools from the repository root
  ./install.sh --tool gh
  ./install.sh --tool playwright-cli

  # See help for a tool
  $0 --tool-help orca

EOF
}

# Normalize tool names (underscores <-> hyphens)
normalize_tool_name() {
  echo "$1" | tr '_' '-'
}

# Check if a tool should be skipped
should_skip() {
  local tool="$1"
  local skip="${TOOLS_SKIP:-}"
  
  if [ -z "$skip" ]; then
    return 1
  fi
  
  echo "$skip" | grep -qF "$tool" || return 1
  return 0
}

# Run a tool's installer
run_tool_installer() {
  local tool="$1"
  local command="${2:-check}"
  local script="$TOOLS_DIR/${tool}.sh"
  
  if [ ! -f "$script" ]; then
    echo "✗ Tool installer not found: $script"
    return 1
  fi
  
  bash "$script" "$command"
}

# Check all tools
check_all() {
  echo "Checking tool status..."
  echo ""
  
  local ok=0 missing=0
  for tool in "${TOOLS[@]}"; do
    if should_skip "$tool"; then
      echo "⊘ $tool (skipped)"
      continue
    fi
    
    if run_tool_installer "$tool" check >/dev/null 2>&1; then
      run_tool_installer "$tool" check
      ok=$((ok+1))
    else
      run_tool_installer "$tool" check || true
      missing=$((missing+1))
    fi
    echo ""
  done
  
  local total=${#TOOLS[@]}
  echo "Summary: $ok/$total tools installed"
  if [ "${1:-}" = strict ] && [ "$missing" -gt 0 ]; then return 1; fi
  return 0
}

# Install all tools
install_all() {
  echo "Installing tools..."
  echo ""
  
  local installed=0 already=0 failed=0
  
  for tool in "${TOOLS[@]}"; do
    if should_skip "$tool"; then
      echo "⊘ $tool (skipped)"
      echo ""
      continue
    fi
    
    echo "Installing $tool..."
    if run_tool_installer "$tool" install; then
      installed=$((installed+1))
    else
      failed=$((failed+1))
    fi
    echo ""
  done
  
  local total=${#TOOLS[@]}
  local skipped=$((total - ${#TOOLS[@]} + ${#TOOLS[@]}))
  
  echo "Installation complete:"
  echo "  Installed: $installed"
  echo "  Already installed: $already"
  echo "  Failed: $failed"
  echo "  Skipped: ${TOOLS_SKIP:-0}"
  
  if [ $failed -gt 0 ]; then
    echo ""
    echo "⚠ Some tools failed to install. Check output above for details."
    return 1
  fi
  
  return 0
}

# Validate names literally after the existing underscore normalization.
validate_tool_name() {
  local tool registered; tool="$(normalize_tool_name "$1")"
  for registered in "${TOOLS[@]}"; do
    [ "$tool" = "$registered" ] && return 0
  done
  echo "✗ Unknown tool: $tool"
  echo "Available tools: $(IFS=, ; echo "${TOOLS[*]}")"
  return 1
}

# Install a specific tool
install_specific() {
  validate_tool_name "$1" || return 1
  local tool; tool="$(normalize_tool_name "$1")"

  echo "Installing $tool..."
  run_tool_installer "$tool" install
}

# Show help for a specific tool
tool_help() {
  validate_tool_name "$1" || return 1
  local tool; tool="$(normalize_tool_name "$1")"

  run_tool_installer "$tool" --help || run_tool_installer "$tool"
}

# Main
if [ $# -eq 0 ]; then
  show_usage
  exit 0
fi

case "${1:-}" in
  --help|-h)
    show_usage
    ;;
  --check)
    check_all
    ;;
  --check-status)
    check_all strict
    ;;
  --install-all)
    install_all
    ;;
  --validate)
    if [ $# -ne 2 ] || [ -z "$2" ]; then
      echo "Error: --validate requires exactly one nonempty tool name"
      echo "Available tools: $(IFS=, ; echo "${TOOLS[*]}")"
      exit 1
    fi
    validate_tool_name "$2"
    ;;
  --install)
    if [ $# -lt 2 ]; then
      echo "Error: --install requires a tool name"
      echo "Available tools: $(IFS=, ; echo "${TOOLS[*]}")"
      exit 1
    fi
    install_specific "$2"
    ;;
  --tool-help)
    if [ $# -lt 2 ]; then
      echo "Error: --tool-help requires a tool name"
      echo "Available tools: $(IFS=, ; echo "${TOOLS[*]}")"
      exit 1
    fi
    tool_help "$2"
    ;;
  *)
    echo "Unknown option: $1"
    show_usage
    exit 1
    ;;
esac
