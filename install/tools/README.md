# External Tools

Install tools through the root installer. Run these commands from the repository root, not from this directory:

```bash
./install.sh                         # Normal repository installation and tool report
./install.sh --tools                 # Normal installation, all tools, then report
./install.sh --tool gh               # Normal installation, selected tool, then report
TOOLS_SKIP=orca ./install.sh --tools  # Skip Orca during all-tool installation and reporting
./install.sh --help                  # Help without checks or writes
```

The default reports missing tools but does not install them or fail because of them.
A report suggests one root `--tools` command only when non-skipped tools are missing.

## Managed Tools

All installation commands below run from the repository root.

| Tool | Installation | Prerequisites | Upstream |
| --- | --- | --- | --- |
| GitHub CLI | `./install.sh --tool gh` | Supported OS package manager. | [cli/cli](https://github.com/cli/cli) |
| gh-stack | `./install.sh --tool gh-stack` | GitHub CLI v2.0+ and authentication. | [github/gh-stack](https://github.com/github/gh-stack) |
| Playwright CLI | `./install.sh --tool playwright-cli` | Node.js 20+ and npm. | [microsoft/playwright-cli](https://github.com/microsoft/playwright-cli) |
| Agent Browser | `./install.sh --tool agent-browser` | Node.js 20+, npm and browser dependencies. | [vercel-labs/agent-browser](https://github.com/vercel-labs/agent-browser) |
| Chrome DevTools CLI | `./install.sh --tool chrome-devtools-cli` | Node.js v20.19+, npm and Chrome/Chromium. | [ChromeDevTools/chrome-devtools-mcp](https://github.com/ChromeDevTools/chrome-devtools-mcp) |
| Orca CLI | `./install.sh --tool orca` | Homebrew on macOS or Go 1.18+ on Linux. | [orca-cli/orca](https://github.com/orca-cli/orca) |
| Lizard | `./install.sh --tool lizard` | uv, pipx, or Python 3 with pip. | [terryyin/lizard](https://github.com/terryyin/lizard) |

## Root Contract

Root accepts only no arguments, `--tools`, `--tool TOOL` or sole `--help`.
It rejects malformed arguments and unknown tool names before `.env`, bootstrap or writes.
Tool names accept underscore aliases, such as `gh_stack`. Obsolete long root flags are not aliases.

Normal repository work and the Pi postlude precede explicit tool installation. The existing tool report follows installation.
Explicit failures remain nonzero after reporting. Deferred patch failure retains status 1.
Immediate repository failure stops before tool installation and reporting.
Explicit stdout and stderr remain separate.

Root forwards `TOOLS_SKIP` and `TOOLS_INTERACTIVE`. Skip rules affect all-tool actions and reports, not an explicitly selected install.
Existing substring skip behavior remains unchanged. Set `TOOLS_INTERACTIVE=0` to suppress supported prompts.
Installation can need network access, privileges or interactive input. Adapters retain their existing install/reinstall behavior.

See the [Tool Installation guide](../TOOL_INSTALLATION.md) for requirements, failures and troubleshooting.

## Internal Layout

The public entrypoint is root `install.sh`. This directory contains the master tool CLI and seven adapters.
The master owns the only runtime registry and normalization implementation.
Root invokes its install actions internally. Direct interfaces remain available for compatibility and tests, not as recommended installation commands.

The internal validation action is silent on success and never invokes an adapter.
Internal `--check` remains non-failing for missing tools. Internal `--check-status` returns 1 when non-skipped tools are missing.
Both actions share the same report and probe count. Skipped tools are not missing tools.

Add a tool by creating its adapter and adding its name to `TOOLS` in `install/tools/install.sh`.
Update this README and the guide. Keep help and error advice directed to the root installer.
Run `bash install/tests/install.test.sh` from the repository root for offline coverage.
