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

Master tool installer for agentic-tools dependencies.

Options:
  --help              Show this help message
  --check             Check which tools are installed (dry run)
  --install-all       Install all recommended tools
  --install TOOL      Install a specific tool (gh, gh-stack, playwright-cli, chrome-devtools-cli, agent-browser, orca)
  --tool-help TOOL    Show help for a specific tool installer

Environment:
  TOOLS_SKIP          Comma-separated tools to skip (e.g., TOOLS_SKIP=orca,gh-stack)
  TOOLS_INTERACTIVE   Set to 0 to suppress interactive prompts (default: interactive if TTY)

Examples:
  # Check all tools
  $0 --check

  # Install all tools
  $0 --install-all

  # Skip orca CLI when installing all
  TOOLS_SKIP=orca $0 --install-all

  # Install specific tool
  $0 --install gh
  $0 --install playwright-cli

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

# Install a specific tool
install_specific() {
  local tool; tool="$(normalize_tool_name "$1")"
  
  # Validate tool name
  if ! printf '%s\n' "${TOOLS[@]}" | grep -qx "$tool"; then
    echo "✗ Unknown tool: $tool"
    echo "Available tools: $(IFS=, ; echo "${TOOLS[*]}")"
    return 1
  fi
  
  echo "Installing $tool..."
  run_tool_installer "$tool" install
}

# Show help for a specific tool
tool_help() {
  local tool; tool="$(normalize_tool_name "$1")"
  
  # Validate tool name
  if ! printf '%s\n' "${TOOLS[@]}" | grep -qx "$tool"; then
    echo "✗ Unknown tool: $tool"
    echo "Available tools: $(IFS=, ; echo "${TOOLS[*]}")"
    return 1
  fi
  
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
  --install-all)
    install_all
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
