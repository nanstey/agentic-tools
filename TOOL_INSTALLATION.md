# Tool Installation System

This document describes the external tool installation system for the agentic-tools repository.

## Overview

This repository depends on several external CLI tools for various skills:

- **GitHub CLI** (`gh`) — required for PR and GitHub operations
- **Stacked PRs extension** (`gh-stack`) — extends GitHub CLI for stacked PR support
- **Playwright CLI** (`playwright-cli`) — browser automation for UI testing and screenshots
- **Chrome DevTools CLI** (`chrome-devtools-cli`) — Chrome DevTools from the command line
- **Orca IDE CLI** (`orca`) — orchestration for coding agents (optional)

Tools are **optional and independent** — you only need to install those required by skills you use.
The installer is **idempotent**: re-running checks and installs is safe and will skip already-installed tools.

## Quick Start

### Check which tools are installed
```bash
cd /path/to/skills && bash tools/install.sh --check
```

### Install all recommended tools
```bash
cd /path/to/skills && bash tools/install.sh --install-all
```

### Install a specific tool
```bash
cd /path/to/skills && bash tools/install.sh --install gh
cd /path/to/skills && bash tools/install.sh --install playwright-cli
```

### Skip specific tools during installation
```bash
cd /path/to/skills && TOOLS_SKIP=orca,gh-stack bash tools/install.sh --install-all
```

## Tool Reference

### GitHub CLI (`gh`)

**Purpose:** Command-line management of GitHub repositories, pull requests, and issues

**Status:** Required for PR and GitHub operations  
**Installation:** OS-dependent (Homebrew on macOS, apt/dnf/pacman on Linux)  
**Prerequisites:** None  
**Verify:** `gh --version`

**Skills requiring gh:**
- `pr*` (all PR skills)
- `gh-stack`
- `issue-create`

**Install:**
```bash
bash tools/install.sh --install gh
```

**Manual installation:**
```bash
# macOS
brew install gh

# Linux (Ubuntu/Debian)
sudo apt-get update && sudo apt-get install -y gh

# Linux (Fedora)
sudo dnf install -y gh

# Linux (Arch)
sudo pacman -S github-cli

# Full docs: https://cli.github.com/manual/installation
```

### GitHub Stacked PRs Extension (`gh-stack`)

**Purpose:** Manage stacked pull requests on GitHub

**Status:** Optional, enhances PR workflows  
**Installation:** GitHub CLI extension  
**Prerequisites:** GitHub CLI v2.0+  
**Verify:** `gh stack --version`

**Skills requiring gh-stack:**
- `gh-stack`

**Install:**
```bash
bash tools/install.sh --install gh-stack
```

**Manual installation:**
```bash
gh extension install github/gh-stack
```

**Troubleshooting:** If `gh` is not installed, install it first (see above).

### Playwright CLI (`playwright-cli`)

**Purpose:** Browser automation from the CLI — navigate, interact, screenshot, record video

**Status:** Recommended for UI testing and visual capture skills  
**Installation:** npm package  
**Prerequisites:** Node.js 20+  
**Verify:** `playwright-cli --version`

**Skills requiring playwright-cli:**
- `playwright-cli`
- `visual-capture`
- `chrome-devtools-cli` (uses Playwright under the hood)

**Install:**
```bash
bash tools/install.sh --install playwright-cli
```

**Manual installation:**
```bash
npm install -g @playwright/cli@latest
```

**Troubleshooting:**
- "Command not found": Add npm's global `bin` directory to `PATH`
  ```bash
  # Find npm's global bin directory
  npm config get prefix
  
  # Add to ~/.bashrc or ~/.zshrc (example: ~/.npm-global/bin)
  export PATH="$(npm config get prefix)/bin:$PATH"
  source ~/.bashrc  # or ~/.zshrc
  ```

- Permission errors: Use a Node version manager instead of `sudo`
  ```bash
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
  nvm install --lts
  npm install -g @playwright/cli@latest
  ```

### Chrome DevTools CLI (`chrome-devtools-cli`)

**Purpose:** Browser automation and debugging with Chrome DevTools from the CLI

**Status:** Recommended for advanced browser automation  
**Installation:** npm package  
**Prerequisites:** Node.js v20.19+, Chrome/Chromium browser  
**Verify:** `chrome-devtools status`

**Skills requiring chrome-devtools-cli:**
- `chrome-devtools-cli`

**Install:**
```bash
bash tools/install.sh --install chrome-devtools-cli
```

**Manual installation:**
```bash
npm install -g chrome-devtools-mcp@latest
chrome-devtools status  # Verify installation
```

**Browser installation (if needed):**
```bash
# Linux (Ubuntu/Debian)
sudo apt-get install -y google-chrome-stable

# Linux (Fedora)
sudo dnf install -y chromium

# macOS
brew install chromium
```

**Troubleshooting:**
- "Chrome not found": Install a Chromium-based browser (see above)
- npm issues: Use a Node version manager (see Playwright section above)

### Orca IDE CLI (`orca`)

**Purpose:** Agent orchestration layer for running coding agents in parallel with isolated git worktrees

**Status:** Optional, enhances `worktree` and `worktree-env` skills  
**Installation:** Homebrew on macOS, built from source on Linux  
**Prerequisites:** Go 1.18+ on Linux  
**Verify:** `orca --version`

**Skills requiring orca:**
- `worktree` (automatically detects and uses when available)
- `worktree-env` (automatically detects and uses when available)
- `pr-merge` (uses for cleanup)

**Install:**
```bash
bash tools/install.sh --install orca
```

**Manual installation:**

```bash
# macOS (via Homebrew)
brew install orca-cli/tap/orca

# Linux (build from source — requires Go 1.18+)
git clone https://github.com/orca-cli/orca
cd orca
go install ./cmd/orca
```

**Troubleshooting:**
- "Go not found" on Linux: Install Go from https://golang.org/doc/install
- Build failures: Ensure Go version is 1.18+: `go version`

## Master Installer Interface

**File:** `tools/install.sh`

### Commands

```bash
tools/install.sh [options]
```

| Option | Effect |
|--------|--------|
| `--help` | Show help message |
| `--check` | Check which tools are installed (dry run) |
| `--install-all` | Install all recommended tools |
| `--install TOOL` | Install a specific tool |
| `--tool-help TOOL` | Show help for a specific tool installer |

### Environment Variables

| Variable | Effect |
|----------|--------|
| `TOOLS_SKIP` | Comma-separated tools to skip (e.g., `TOOLS_SKIP=orca,gh-stack`) |
| `TOOLS_INTERACTIVE` | Set to 0 to suppress interactive prompts (default: interactive if TTY) |

### Examples

```bash
# Check all tools
bash tools/install.sh --check

# Install all tools except orca
TOOLS_SKIP=orca bash tools/install.sh --install-all

# Install specific tool
bash tools/install.sh --install gh

# Show help for a tool
bash tools/install.sh --tool-help playwright-cli

# Get detailed help for the master installer
bash tools/install.sh --help
```

## Individual Tool Scripts

Each tool has its own dedicated installer script:

**File:** `tools/<tool-name>.sh`

### Interface

```bash
tools/<tool-name>.sh [check|install|upgrade|uninstall]
```

| Command | Effect |
|---------|--------|
| `check` | Verify tool is installed and report version |
| `install` | Install or upgrade tool |
| `upgrade` | Upgrade to latest version (not all tools) |
| `uninstall` | Uninstall tool |

### Examples

```bash
# Check if playwright-cli is installed
bash tools/playwright-cli.sh check

# Install chrome-devtools-cli
bash tools/chrome-devtools-cli.sh install

# Upgrade gh-stack
bash tools/gh-stack.sh upgrade

# Uninstall orca
bash tools/orca.sh uninstall
```

## Root Installer Integration

The root `install.sh` calls `tools/install.sh --check` after installing harness configuration.
If tools are missing, it prints guidance suggesting manual installation.

**Design:** Tools are not auto-installed by the root installer because:
- Some tools require `sudo` or interactive input
- Tools are optional by skill
- Respects offline-first and idempotent workflows

**To include tool installation in your setup:**

```bash
# From project root
bash install.sh          # Install harness config
bash tools/install.sh --install-all  # Install tools
```

## Platform Support Matrix

| Tool | Linux | macOS | Requirements |
|------|-------|-------|--------------|
| `gh` | ✓ | ✓ | None |
| `gh-stack` | ✓ | ✓ | GitHub CLI v2.0+ |
| `playwright-cli` | ✓ | ✓ | Node.js 20+ |
| `chrome-devtools-cli` | ✓ | ✓ | Node.js v20.19+, Chrome/Chromium |
| `orca` | ✓ (from source) | ✓ (brew) | Go 1.18+ (Linux only) |

### Linux Distribution Auto-Detection

On Linux, the `gh` installer automatically detects your distribution and uses the appropriate package manager:

- **Fedora/RHEL/CentOS:** `dnf install`
- **Ubuntu/Debian:** `apt-get install`
- **Arch/Manjaro:** `pacman -S`
- **Alpine:** `apk add`

## Troubleshooting

### Common Issues

#### "Command not found" after installation

npm packages are installed to a global directory that may not be in your `PATH`.

**Solution:**
```bash
# Find npm's global bin directory
npm config get prefix

# Add to your shell config (~/.bashrc, ~/.zshrc, ~/.config/fish/config.fish, etc.)
export PATH="$(npm config get prefix)/bin:$PATH"

# Reload your shell
exec $SHELL
```

#### Permission denied

Avoid using `sudo` with npm. Instead, use a Node version manager:

```bash
# Install nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
exec $SHELL

# Install Node
nvm install --lts

# Now npm install -g works without sudo
npm install -g <package>
```

#### Tool not found after installation

Ensure the tool's directory is in `PATH`. For npm packages, see "Command not found" above.

For Go-built tools like `orca`, ensure your Go binary directory is in `PATH`:

```bash
# Add to your shell config
export PATH="$PATH:$(go env GOPATH)/bin"
```

#### Browser not found (chrome-devtools-cli)

Install a Chromium-based browser:

```bash
# Linux
sudo apt-get install google-chrome-stable  # Ubuntu/Debian
sudo dnf install chromium  # Fedora

# macOS
brew install chromium
```

#### Old version of gh-stack running

Clear npm cache and reinstall:

```bash
npm uninstall -g github/gh-stack
npm cache clean -f
npm install -g github/gh-stack@latest
```

## Development

### Adding a New Tool

To add a new external tool to the installer system:

1. Create `tools/<tool-name>.sh` with:
   - Consistent interface: `check`, `install`, `uninstall` commands
   - Consistent help text and output format
   - Proper error handling and verification
   - Platform-specific installation logic if needed

2. Add the tool name to the `TOOLS=()` array in `tools/install.sh`

3. Update `tools/README.md` with:
   - Tool name and description
   - Installation command
   - Platform support
   - Prerequisites and troubleshooting

4. Update this file (TOOL_INSTALLATION.md) with:
   - Tool reference section
   - Manual installation commands
   - Troubleshooting tips

5. Update root `README.md` with an entry in the External Tools table

6. Re-run root `install.sh` to verify integration:
   ```bash
   bash install.sh
   bash tools/install.sh --check
   ```

### Testing

Test individual tool installers:

```bash
# Test check
bash tools/gh.sh check

# Test help
bash tools/gh-stack.sh --help

# Test master installer
bash tools/install.sh --check
bash tools/install.sh --help
```

Test idempotency (running multiple times should succeed):

```bash
bash tools/install.sh --install gh
bash tools/install.sh --install gh  # Should skip, already installed
```

## Related Files

- `tools/install.sh` — Master tool installer
- `tools/<tool>.sh` — Individual tool installers (5 tools)
- `tools/README.md` — Tool docs and references
- `TOOL_INSTALLATION.md` — This file
- `README.md` — Root catalog and quick start
- `install.sh` — Root installer (calls tools/install.sh --check)
- `AGENTS.md` — Context for all agents working on this repo
