# OMP harness

`install.sh` links shared skills and agents into `~/.omp/agent` and each existing
OMP profile's `~/.omp/profiles/*/agent` directory, copies portable OMP config,
applies the versioned status-line settings, and installs the packages
below with OMP's native `omp install` command:

| Repository path | Install destination | Purpose |
| --- | --- | --- |
| [`harness/omp/APPEND_SYSTEM.md`](APPEND_SYSTEM.md) | `~/.omp/agent/APPEND_SYSTEM.md` | Adds session lifecycle, bounded delegation, collision-safe scratch-artifact guidance, and browser-tool routing that defaults to headless `agent-browser` over the user's real browser. |
| [`harness/omp/plugins/pi-jev.txt`](plugins/pi-jev.txt) | Not copied; passed to `omp install` | Installs `npm:pi-jev@0.4.0`. OMP loads its legacy `pi.extensions` manifest through the Pi compatibility layer. |
| [`harness/omp/README.md`](README.md) | Not copied | This document. `install.sh` skips `README.md` when it copies config. |
| [`harness/omp/status-line/apply.sh`](status-line/apply.sh) | Default and existing profile `config.yml` files (via `omp config`) | Selectively merges the versioned Nerd Font status-line schema. |

The installer copies each top-level, non-dot file under `harness/omp/` as a whole
file. Nested files such as the plugin manifest and status-line applicator are not
copied. A differing destination file is replaced, so local edits to a managed
file such as `APPEND_SYSTEM.md` are clobbered the next time `install.sh` runs.
Native OMP package installation failure exits the installer with an error. OMP
normally delegates installs to `bun`; when `bun` is absent, `install.sh` runs
the official npm `bun` package through `npx` for that installation only.

OMP can run `pi-jev` because its extension loader accepts legacy
`pi.extensions` manifests and rewrites `@earendil-works/*` imports to OMP's
host packages. Configure `TYPESAFE_API_KEY` through the repository `.env` as
described in the [Pi harness](../pi/README.md#per-profile-secrets-pi-secret) docs; `install.sh` writes the extension's shared secret-file fallback
and the user-session environment file. The
Jev tools and `/jev` commands are supported, while behavior that depends on
Pi-specific third-party extensions, such as `pi-subagents` orchestration,
still requires those dependencies to be installed and compatible.

After copying OMP artifacts for a detected OMP harness, `install.sh` runs the
status-line applicator against `~/.omp/agent/config.yml` and each existing
`~/.omp/profiles/*/agent/config.yml`. It compares every managed schema value with
`omp config get` and calls `omp config set` only for differences. Unrelated and
profile-local settings—including `composer.shape`, `modelRoles`,
`webSearchOrder`, and `setupVersion`—remain untouched; reruns are idempotent.
There is no copied `harness/omp/config.yml`.

The custom Nerd Font line uses each profile's chosen composer. It groups model,
compact context usage such as `39.0%/272K`, Git state, and session name on the
left, with elapsed time right-aligned. OMP keeps the status on one adaptive row
and drops trailing segments as width narrows.

To cap subagents at one delegation level, create or edit the machine-local file:

```yaml
task:
  maxRecursionDepth: 1
```
