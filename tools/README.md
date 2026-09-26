# External Tools

This directory manages installation of external CLI tools required by various skills in this repository.

## Quick Start

```bash
# Check which tools are installed
./install.sh --check

# Install all recommended tools
./install.sh --install-all

# Install a specific tool
./install.sh --install gh
./install.sh --install playwright-cli

# Skip tools during installation
TOOLS_SKIP=orca,gh-stack ./install.sh --install-all
```

## Tools

Each tool has its own installer script with consistent interface.

### `gh` (GitHub CLI)

**What:** Command-line tool for GitHub management  
**Docs:** https://cli.github.com  
**Required by:** `gh-stack`, `pr-*` skills  
**Prerequisites:** None  

```bash
./install.sh --install gh
./install.sh --tool-help gh
```

### `gh-stack`

**What:** GitHub CLI extension for stacked pull requests  
**Docs:** https://github.com/github/gh-stack  
**Required by:** `gh-stack` skill  
**Prerequisites:** GitHub CLI v2.0+  

```bash
./install.sh --install gh-stack
./install.sh --tool-help gh-stack
```

### `playwright-cli`

**What:** Browser automation from the CLI  
**Docs:** https://playwright.dev  
**Required by:** `playwright-cli`, `visual-capture` skills  
**Prerequisites:** Node.js 20+  

```bash
./install.sh --install playwright-cli
./install.sh --tool-help playwright-cli
```

### `chrome-devtools-cli`

**What:** Chrome DevTools from the CLI  
**Docs:** https://github.com/ChromeDevTools/chrome-devtools-mcp  
**Required by:** `chrome-devtools-cli` skill  
**Prerequisites:** Node.js v20.19+, Chrome browser  

```bash
./install.sh --install chrome-devtools-cli
./install.sh --tool-help chrome-devtools-cli
```

### `agent-browser`

**What:** Native browser automation CLI with a persistent daemon driving Chrome over CDP  
**Docs:** https://github.com/vercel-labs/agent-browser  
**Required by:** `agent-browser` skill  
**Prerequisites:** Node.js 20+, Chrome/Chromium or Chrome for Testing  

```bash
./install.sh --install agent-browser
./install.sh --tool-help agent-browser
```

### `orca`

**What:** Orca IDE CLI for agent orchestration  
**Docs:** https://github.com/orca-cli/orca  
**Required by:** `worktree`, `worktree-env` skills (optional)  
**Prerequisites:** Go 1.18+ (Linux), Homebrew (macOS)  

```bash
./install.sh --install orca
./install.sh --tool-help orca
```

## Individual Tool Scripts

Each tool has a dedicated installer script with the same interface:

```bash
tools/<tool-name>.sh [check|install|upgrade|uninstall]
```

### Commands

- **check** — Verify tool is installed and report version
- **install** — Install or upgrade tool
- **upgrade** — Upgrade to latest version (gh-stack only)
- **uninstall** — Uninstall tool

### Examples

```bash
# Check if playground-cli is installed
tools/playwright-cli.sh check

# Install chrome-devtools-cli
tools/chrome-devtools-cli.sh install

# Upgrade gh-stack
tools/gh-stack.sh upgrade

# Uninstall orca
tools/orca.sh uninstall
```

## Integration with Root Installer

The root `install.sh` calls `tools/install.sh --check` after installing harness configuration. If tools are missing, it prints guidance but does not block the harness installation.

To include tool installation in the root workflow:

```bash
# From project root
bash tools/install.sh --install-all
```

## Idempotency

All tool installers are idempotent:
- Checking an already-installed tool succeeds and reports its version
- Installing an already-installed tool skips the install (checks are quick)
- Re-running the master installer is safe

## Platform Support

| Tool | Linux | macOS | Notes |
|------|-------|-------|-------|
| `gh` | ✓ (apt/dnf/pacman/apk) | ✓ (brew) | Auto-detects distro |
| `gh-stack` | ✓ (requires gh) | ✓ (requires gh) | Extension |
| `playwright-cli` | ✓ (npm) | ✓ (npm) | Requires Node.js 20+ |
| `chrome-devtools-cli` | ✓ (npm) | ✓ (npm) | Requires Node.js v20.19+, Chrome |
| `agent-browser` | ✓ (npm) | ✓ (npm) | Requires Node.js 20+, Chrome/Chromium or Chrome for Testing |
| `orca` | ✓ (from source) | ✓ (brew) | Requires Go 1.18+ on Linux |

## Troubleshooting

### "Command not found" after installation

After installing npm packages globally, ensure your npm `bin` directory is in `PATH`:

```bash
npm config get prefix
# Add $(npm config get prefix)/bin to your ~/.bashrc or ~/.zshrc if needed
```

### Permission denied installing globally

Avoid `sudo` for npm installs. Instead, use a node version manager:

```bash
# Install nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install --lts
npm install -g <package>
```

### Chrome/Chromium not found

For `chrome-devtools-cli`, install a Chromium-based browser separately:

```bash
# Linux
sudo apt-get install google-chrome-stable  # Ubuntu/Debian
sudo dnf install chromium  # Fedora

# macOS
brew install chromium
```

## Adding New Tools

To add a new tool:

1. Create `tools/<tool-name>.sh` with:
   - `check`, `install`, `uninstall` commands
   - Consistent help text and output format
   - Error handling and verification

2. Add the tool name to `TOOLS=()` array in `tools/install.sh`

3. Update this README with tool details

4. Re-run root `install.sh` to verify integration

## Related Files

- `install.sh` — Master tool installer (orchestration)
- `README.md` — This file (tool docs)
- `<tool>.sh` — Individual tool installers
- Root `install.sh` — Calls `tools/install.sh --check`
