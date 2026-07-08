---
name: pi-sync
description: Captures the portable, non-secret pi config from a live ~/.pi/agent into this repo's pi/ directory and commits it, without reading or copying secrets. Use when live pi config or extensions have drifted from the repo and need to be synced back.
user-invocable: true
disable-model-invocation: true
---

# Pi Sync

## Core Contract

Capture the **portable, non-secret** pi config from a live `~/.pi/agent` into
this repo's `pi/` directory and commit it. This is the reverse of `install.sh`:
`install.sh` copies `pi/` out to `~/.pi/agent`; this skill pulls the live state
back for review and commit.

Config is **copied, not symlinked** (pi rewrites some files locally), so live
changes never flow back on their own. Operate strictly on the allowlist below
and never read, copy, or stage secret/credential files.
Follow `CLAUDE.md` / `AGENTS.md` on conflict.

## Required Inputs

1. Path to the live agent dir (default `${PI_CODING_AGENT_DIR:-$HOME/.pi/agent}`).
2. Optional: confirmation to commit vs. stage-only.

## Allowlist and denylist

### Denylist — never read, copy, or stage

Secrets or machine-local state:

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

`.gitignore` already blocks the committable-looking ones; the denylist is the
first line of defense, `.gitignore` is the backstop.

### Allowlist — portable config to sync

| Source (`~/.pi/agent`) | Dest (`pi/`) | Notes |
| --- | --- | --- |
| `settings.json` | `pi/settings.json` | Strip volatile key `lastChangelogVersion`. |
| `extensions/*.json` | `pi/extensions/` | Per-extension config. |
| `command-shortcuts.json` | `pi/command-shortcuts.json` | Optional; copy if present. |
| `keybindings.json` | `pi/keybindings.json` | Optional; copy if present. |

`skills/` and `agents/` are **symlinked** by `install.sh`, so edits there
already live in the repo — this skill does not touch them.

## Workflow

1. Resolve the live agent dir and confirm it exists.
2. Copy allowlisted files by exact name (no recursion/globs into secret dirs).
3. Diff every copied file; confirm no secret values leaked in.
4. Run the secret guard; abort if any denylisted path is staged.
5. Commit only after the guard passes.

Stop and ask if a new top-level config file appears that is not on either list,
or if a diff shows an unexpected value that could be a secret.

## Bash Implementation Notes

Run from the repo root.

```sh
PI="${PI_CODING_AGENT_DIR:-$HOME/.pi/agent}"

# 1. settings.json — strip only the volatile, locally-rewritten key.
jq 'del(.lastChangelogVersion)' "$PI/settings.json" > pi/settings.json

# 2. extensions/*.json — copy each config by name (no recursion).
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

Verify, then guard:

```sh
git status --short pi/
git diff -- pi/

git status --porcelain pi/ | grep -E \
  'auth\.json|auth-profiles/|web-search\.json|trust\.json|sessions/|run-history|observability/|node_modules/' \
  && { echo 'ABORT: secret/state file staged'; exit 1; } || echo 'clean: no secrets staged'
```

Commit only after the guard passes:

```sh
git add pi/
git commit -m "chore(pi): sync portable config from live ~/.pi/agent"
```

Note new package names in the commit body. If a new extension config was added,
confirm the extension is listed under `settings.json` `packages`.

## Safety Rules

- Never read, `cat`, copy, or stage denylisted secret/state files.
- Never use recursive copies or wildcards that could sweep in unvetted state.
- Never commit before the secret guard passes.
- Never strip curated keys from `settings.json` beyond the volatile
  `lastChangelogVersion`.

## Output Style

Report the files synced, the settings keys changed (added/removed packages,
stripped volatile keys), the secret-guard result, and the commit made (or that
changes were left staged for review).
