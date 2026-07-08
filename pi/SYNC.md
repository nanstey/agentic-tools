# pi/SYNC.md

Runbook to reliably capture the **portable, non-secret** pi config from a live
`~/.pi/agent` into this repo's `pi/` directory and commit it.

Config is **copied, not symlinked** (pi rewrites some of these files locally),
so live changes never flow back on their own. This runbook is the reverse of
`install.sh`: it pulls the live state back for review and commit.

## Safety contract (read first)

- **Never read, `cat`, copy, or stage secret/credential files.** Operate only
  on the explicit allowlist below. Do not glob into secret directories.
- **Allowlist only.** Copy files by exact name. Do not use recursive copies or
  wildcards that could sweep in state you have not vetted.
- **Verify before commit.** Diff every copied file and confirm no secret values
  leaked in before staging.

### Denylist — never touch

These are secrets or machine-local state. Do not read or copy them:

| Path | Why |
| --- | --- |
| `auth.json` | Provider credentials/tokens (mode 600). |
| `auth-profiles/` | Stored auth profiles (mode 700). |
| `web-search.json` | Search provider API keys. |
| `trust.json` | Machine-local trusted paths. |
| `sessions/` | Local session transcripts. |
| `run-history.jsonl` | Local run history. |
| `observability/` | Local telemetry/history. |
| `tmp/` | Scratch (mode 700). |
| `bin/` | Machine-local binaries. |
| `npm/node_modules/` | Installed packages (restored from lockfile). |
| `local-extensions/` | Machine-local, unpublished extensions. |

`.gitignore` already blocks the committable-looking ones (`auth.json`,
`auth-profiles/`, `web-search.json`, `trust.json`, `sessions/`,
`run-history.jsonl`, `observability/`, `npm/node_modules/`). The denylist is the
first line of defense; `.gitignore` is the backstop.

### Allowlist — portable config to sync

| Source (`~/.pi/agent`) | Dest (`pi/`) | Notes |
| --- | --- | --- |
| `settings.json` | `pi/settings.json` | Strip volatile key `lastChangelogVersion`. |
| `extensions/*.json` | `pi/extensions/` | Per-extension config. |
| `command-shortcuts.json` | `pi/command-shortcuts.json` | Optional; copy if present. |
| `keybindings.json` | `pi/keybindings.json` | Optional; copy if present. |

`skills/` and `agents/` are **symlinked** by `install.sh`, so edits there
already live in the repo — this runbook does not touch them.

## Procedure

Run from the repo root. `PI="${PI_CODING_AGENT_DIR:-$HOME/.pi/agent}"`.

```sh
PI="${PI_CODING_AGENT_DIR:-$HOME/.pi/agent}"

# 1. settings.json — copy, stripping only the volatile, locally-rewritten key.
jq 'del(.lastChangelogVersion)' "$PI/settings.json" > pi/settings.json

# 2. extensions/*.json — copy each known extension config by name (no recursion).
mkdir -p pi/extensions
for f in "$PI"/extensions/*.json; do
  [ -e "$f" ] || continue
  cp "$f" "pi/extensions/$(basename "$f")"
done

# 3. Optional top-level config files — copy only if present.
for name in command-shortcuts.json keybindings.json; do
  [ -e "$PI/$name" ] && cp "$PI/$name" "pi/$name"
done
```

## Verify

```sh
# Review every change; confirm no secret values are present.
git status --short pi/
git diff -- pi/

# Guard: fail if any denylisted file slipped into the staging set.
git status --porcelain pi/ | grep -E \
  'auth\.json|auth-profiles/|web-search\.json|trust\.json|sessions/|run-history|observability/|node_modules/' \
  && { echo 'ABORT: secret/state file staged'; exit 1; } || echo 'clean: no secrets staged'
```

## Commit

Only after the verify step passes:

```sh
git add pi/
git commit -m "chore(pi): sync portable config from live ~/.pi/agent"
```

If new package names appeared in `settings.json`, note them in the commit body.
If a new extension config was added, confirm the extension is listed in
`settings.json` `packages`.
