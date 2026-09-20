# Jev Ultrafast Integration Proposal

## Purpose

### Goal
Make `browser-use/jev-ultrafast` available as a portable repository skill so agents can install and run the pinned browser agent without creating or maintaining a standalone clone.

### Current reality
The repository already links global skills into every supported harness. It provides `typesafe-ai` for Jev programming guidance and installs `pi-jev` for harness-level model features, but it has no workflow for the Jev Ultrafast browser agent. `install.sh` has no Python tool-management contract.

### Options
1. Add a focused `jev-ultrafast` tool skill that uses `uv` to install the upstream package from an immutable Git commit. Chosen: it matches existing CLI-backed skills and keeps the installer free of an unrelated Python package manager.
2. Extend `install.sh` with a Python-tool manifest. Rejected: it introduces a new managed artifact type, runtime prerequisite, and uninstall/update policy for one tool.
3. Vendor or clone the upstream project. Rejected: the request forbids a standalone clone/project, and vendoring would duplicate upstream maintenance.
4. Fold the workflow into `typesafe-ai`. Rejected: that skill covers application design with Jev, not operating a browser agent.

## User story & scenarios

As an agent, I can invoke `jev-ultrafast`, install the pinned upstream package through `uv` when needed, configure credentials locally, run the loopback inspector or Python agent, and verify prerequisites before a paid browser run.

### Scenario: first use

Given Python 3.12+, `uv`, Chrome, and local credentials, when the skill is invoked on a machine without the `jev` executable, then it installs `browser-use/jev-ultrafast` from the documented immutable commit with `uv tool install` and verifies the console entry point.

### Scenario: interactive inspector

Given the installed tool and Browser Harness connectivity, when the user requests an interactive run, then the workflow starts `jev`, reports the loopback URL, and directs interaction through the local inspector.

### Scenario: scripted task

Given a task URL and goal, when a reusable scripted run is more suitable, then the workflow uses the public `jev_ultrafast.Agent` API and preserves independent outcome verification rather than trusting `DONE`.

### Scenario: missing prerequisite

Given a missing runtime, browser connection, or credential, when preflight runs, then the workflow reports the exact missing prerequisite and does not claim a successful browser run.

## Behaviour

- The skill is named `jev-ultrafast` and lives at `skills/tools/jev-ultrafast/SKILL.md`.
- It records upstream commit `1231850a0bf1a0c0341fe408ef1668dbbfdfac46`, version `0.1.0`, and MIT provenance.
- Installation uses an immutable Git URL through `uv tool install`; it does not clone into this repository or modify `install.sh`.
- Credentials remain in process environment or a git-ignored local `.env`; the skill never writes or displays secret values.
- `TYPESAFE_API_KEY` is required for decisions. `TEXT_MODEL_API_KEY` is required only when the task may choose `TYPE_TEXT`; related model/base URL settings remain configurable.
- Browser setup uses `browser-harness --doctor` when connectivity fails.
- Runtime guidance distinguishes the local inspector from scripted `Agent` use and requires independent verification of the requested outcome.

## QA

1. Validate `SKILL.md` frontmatter, name/path alignment, provenance, immutable source reference, prerequisite handling, and catalog consistency.
2. In a private temporary workspace, install `uv`, then install the pinned upstream package into an isolated tool directory without cloning.
3. Start the actual `jev` console entry point on an unused loopback port and request `/api/state`; observe an idle JSON response. This exercises package resolution, installation, entry point, HTTP server, and bundled static/runtime resources without paid model calls.
4. Confirm the inspector page responds on loopback and contains the Jev Ultrafast UI.
5. Run the repository installer in a private HOME with fake harness directories and confirm the new skill is linked under its frontmatter name; rerun to prove idempotency.

A live model-driven browser action is not deterministic without user credentials and would incur external API calls. The integration's end-to-end gate therefore covers the installed executable and loopback application; the skill explicitly gates paid runs on credentials and Browser Harness readiness.

## Architecture

The repository owns only the operational skill and catalog entry. All executable code remains upstream and is resolved from the pinned commit by `uv`. Existing skill discovery and symlink installation make the workflow available to supported harnesses. No new installer artifact type or vendored Python project is introduced.

## Affected areas

- New: `skills/tools/jev-ultrafast/SKILL.md`.
- Updated: `README.md` Tools catalog.
- Planning state: `.plans/setup-jev-ultrafast/README.md`, this proposal, and one slice specification.

## Implementation phases

1. **Add the Jev Ultrafast skill** — author the pinned operational workflow and catalog row. Gate: policy review passes; isolated pinned install serves `/api/state` and the inspector page; private-HOME installer links the skill idempotently.
