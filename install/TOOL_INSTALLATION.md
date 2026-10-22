# Tool Installation

Use the root installer for external CLI installation. Run the following commands from the repository root, not from `install/`.

```bash
./install.sh                   # Install repository content and report tool status
./install.sh --tools           # Normal installation, all tools, then report
./install.sh --tool gh         # Normal installation, one tool, then report
./install.sh --tool gh_stack   # Underscore alias for gh-stack
./install.sh --help            # Help without bootstrap, checks or writes
```

Tools are optional. Choose the tools required by the skills you use.
The default does not install external tools. Normal repository installation still includes existing harness provisioning.

## Root Installer Integration

Root accepts no arguments or exactly one of `--tools`, `--tool TOOL` and `--help`.
It rejects unknown options/names, missing or empty operands, extra arguments and repeated/conflicting actions with status 1 on stderr.
It rejects them before `.env`, bootstrap or installation. Help must appear alone and returns 0 without side effects.
Root does not accept alternate flag spellings.

Normal work installs skills, agents and harness configuration, including existing Pi/OMP provisioning.
An explicit action installs all tools or the selected tool after normal work and the Pi postlude.
The tool-status report runs last. Missing tools alone do not make root fail.

When non-skipped tools are missing, the report prints one shell-safe root command with `--tools`.
All-present or all-skipped reports do not print installation advice.
A selected-tool command always uses the same root entrypoint:

```bash
./install.sh --tool playwright-cli
```

Explicit installation keeps stdout and stderr separate. A selected installer failure retains its status after the report.
An all-tool failure returns 1. A deferred patch failure keeps its diagnostic and status 1, even if tool installation also fails.
An immediate repository failure stops before external-tool installation and reporting.

Installation can require network access, privileges or interactive input.
Each adapter retains its existing install/reinstall behavior. Do not assume every explicit action skips an installed tool.

## Environment

Root forwards the environment to the internal tools CLI.

| Variable | Behavior |
| --- | --- |
| `TOOLS_SKIP` | Existing substring-based skip rules for all-tool installation and reports. |
| `TOOLS_INTERACTIVE` | Existing prompt policy. Set to `0` to suppress supported prompts. |

```bash
TOOLS_SKIP=orca,gh-stack TOOLS_INTERACTIVE=0 ./install.sh --tools
```

Skip rules do not cancel an explicitly selected tool. The substring rule also means `TOOLS_SKIP=gh-stack` skips `gh` during all-tool actions and reports.

## Tool Reference

All installation commands below run from the repository root.

| Tool | Install | Verify | Requirements |
| --- | --- | --- | --- |
| GitHub CLI | `./install.sh --tool gh` | `gh --version` | Homebrew on macOS or a supported Linux package manager. |
| gh-stack | `./install.sh --tool gh-stack` | `gh stack --version` | GitHub CLI v2.0+ and GitHub authentication. |
| Playwright CLI | `./install.sh --tool playwright-cli` | `playwright-cli --version` | Node.js 20+ and npm. |
| Agent Browser | `./install.sh --tool agent-browser` | `agent-browser --version` | Node.js 20+, npm and browser system dependencies. |
| Chrome DevTools CLI | `./install.sh --tool chrome-devtools-cli` | `chrome-devtools status` | Node.js v20.19+, npm and Chrome/Chromium. |
| Orca CLI | `./install.sh --tool orca` | `orca --version` | Homebrew on macOS or Go 1.18+ on Linux. |
| Lizard | `./install.sh --tool lizard` | `lizard --version` | uv, pipx, or Python 3 with pip. |

GitHub CLI supports PRs, issues and repository management. gh-stack adds stacked-PR workflows.
Playwright CLI, Agent Browser and Chrome DevTools CLI support browser skills.
Orca supports agent orchestration and is optional.
Lizard supports the `complexity` skill. The skill also runs it through `uvx` or `pipx run` without installation.

The root installer uses npm for the browser CLIs. Agent Browser also provisions a browser.
Chrome DevTools CLI requires a separately available browser. Linux browser dependencies can require separate system setup.
Orca uses Homebrew on macOS and a source build on Linux.

### Platform Support

| Tool | Linux | macOS |
| --- | --- | --- |
| `gh` | apt/dnf/pacman/apk | Homebrew |
| `gh-stack` | GitHub CLI extension | GitHub CLI extension |
| `playwright-cli` | npm | npm |
| `agent-browser` | npm | npm |
| `chrome-devtools-cli` | npm | npm |
| `orca` | Source build with Go | Homebrew |
| `lizard` | uv, pipx, or pip | uv, pipx, or pip |

## Troubleshooting

### Command not found

Check that the installed binary directory is on `PATH`.
For npm tools, inspect the global prefix with `npm config get prefix` and add its `bin` directory to your shell configuration.
For Go-built Orca, inspect `go env GOPATH` and use its `bin` directory.
Restart the terminal or reload its configuration after a PATH change.

### Permission errors

Use a Node version manager or a writable npm prefix rather than running npm as root.
Platform package managers can still require privileges. Check the reported adapter error before retrying.
Retry installation through `./install.sh --tool TOOL`, not a separate tool installer.

### Missing prerequisites or old binaries

Install required runtimes or browsers for your platform. They are separate prerequisites, not tool aliases.
For gh-stack, ensure GitHub CLI is available and authenticated before retrying `./install.sh --tool gh-stack`.
Check `command -v <tool>` for a binary that shadows the installed version.
For Chrome DevTools, stop the running service with `chrome-devtools stop` before retrying `./install.sh --tool chrome-devtools-cli`.

## Internal Interfaces

`install/tools/install.sh` owns the tool registry and underscore normalization.
Root calls its existing install actions internally. Direct master and adapter interfaces remain supported for compatibility and tests.
They are not the recommended user installation entrypoints.

The internal `--validate TOOL` action validates one nonempty literal name without output on success.
It does not inspect installed state or invoke an adapter. It returns 1 for invalid input.
Internal `--check` retains status 0 for missing tools. Internal `--check-status` uses the same report and returns 1 for non-skipped missing tools.
Both use the same checks. The status mode does not add probes or parse human-readable output.

## Development and Tests

Add adapters under `install/tools/` and register their names once in the master `TOOLS` array.
Keep user installation advice directed to root `--tools` or `--tool TOOL`.
Update this guide and the [tools README](tools/README.md) for tool requirements.
Run safe regression tests from the repository root:

```bash
bash install/tests/install.test.sh
bash harness/pi/tests/package-patches.test.sh
```

`install/main.sh` is the only runtime file directly under `install/`.
This guide is the explicit documentation exception. Modules, tools and tests retain their subdirectories.

## Related Files

- [Root README](../README.md): catalog and quick start.
- [Repository guidance](../AGENTS.md): authoring and ownership rules.
- [Root installer](../install.sh): public entrypoint.
- [Installer main](main.sh): parsing and orchestration.
- [Tool adapters](tools/README.md): managed tools and internal layout.
