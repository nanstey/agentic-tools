# Scheduling prflow

prflow does not depend on any scheduler or agent. `prflow watch` is the whole
contract; any scheduler that can run a command on an interval and do something
with its stdout can drive it.

## The watch contract

```
node <skill-dir>/scripts/prflow.ts watch [--name <job>] [--config <path>] [scope flags]
```

| Result | stdout | Exit | State |
| --- | --- | --- | --- |
| Actionable set changed | Grouped report of non-`waiting` items | 0 | Saved |
| Unchanged, or nothing actionable | Empty | 0 | Unchanged |
| Scan error (any `warn:`) or bad config | Empty; details on stderr | 1 | Unchanged |

- **Notify on non-empty stdout. Alert on non-zero exit.** Nothing else is needed.
- State lives in `${XDG_STATE_HOME:-~/.local/state}/prflow/watch-<name>.txt`.
  Use a distinct `--name` per scheduled job; two jobs sharing a name would
  suppress each other's reports. `--state <path>` overrides the file.
- A scan error never updates state, so a partial scan cannot hide an item and
  announce it again later. The next successful run reports normally.
- A run holds `<state>.lock` while it scans. An overlapping run of the same job
  exits 0 silently; a lock older than 30 minutes is treated as stale. State is
  written atomically.
- Watch is read-only toward GitHub and Orca. It writes only its state and lock files.

## The tick contract

```
node <skill-dir>/scripts/prflow.ts tick [--state-dir <path>] [--config <path>] [scope flags]
```

`tick` is a superset of `watch`: the same scan and report, plus state, rails,
an event feed, the safe actions (see `references/state.md`), and Pi dispatch
(see `references/dispatch.md`). Actions stay dry runs until the config sets
`"actions": {"dryRun": false}`, and dispatch until it sets
`"dispatch": {"dryRun": false}`.

| Result | stdout | Exit |
| --- | --- | --- |
| New events, or the report changed | `## New events (n)` lines, then the grouped report | 0 |
| Nothing new | Empty | 0 |
| Backing off after a failure, or another tick running | Empty | 0 |
| Scan error, poll budget exceeded, or bad config | Empty; details on stderr | 1 |

Notify on non-empty stdout and alert on non-zero exit, as with `watch`. A
`watch` job keeps working unchanged; switch a job from `watch` to `tick` when
you want the state and feed.

## Set up a schedule (agent steps)

1. **Config.** Run `prflow config`. If it shows the wrong accounts, copy the
   repository's `config.example.json` to `<repo-root>/config.json` (git-ignored)
   or `${XDG_CONFIG_HOME:-~/.config}/agentic-tools/config.json` and edit it.
   Ask the user which accounts cover which owners or repos; do not guess.
2. **Auth.** Every configured login must pass `gh auth token -u <login>` in
   the scheduler's environment, not just the user's shell. On Linux, `gh`
   keyring storage needs the user session bus (`DBUS_SESSION_BUS_ADDRESS`);
   plain cron usually lacks it, while systemd user timers have it.
3. **Paths.** Schedulers run with a minimal `PATH`. Use absolute paths for
   `node` (`command -v node`) and the skill directory, and put the
   directories of `gh`, `git`, and `orca-ide` on `PATH` in the job. Without
   `orca-ide`, pass `--no-worktrees` or every run fails with a scan error.
   prflow runs `orca-ide`, never bare `orca`, which is the GNOME screen
   reader on some Linux desktops.
4. **HOME.** prflow reads config, state, and `gh` auth from the real home
   directory. If the scheduler changes `HOME`, set it back in the job or pass
   `--config` and `--state` explicitly.
5. **Dry run.** Run the exact job command twice by hand with a throwaway
   `--state`: the first run prints the report (or nothing), the second prints
   nothing and exits 0.
6. **Create the job** with the scheduler's own tooling, delivering stdout to
   the user and failures to wherever the user wants alerts. Pick an interval
   of 10 to 30 minutes unless the user says otherwise; each run makes about
   two GitHub searches per account scope plus one call per PR.
7. **Verify** with the scheduler's run history after the first scheduled run.

Never schedule anything that merges, approves, or comments. Turn off either
dry run for `tick` only when the user asks. A Pi dispatch can take longer than
one tick: the next tick watches it through its lease, so a 15-minute schedule
needs no change.

## Examples

Replace `<node>`, `<skill-dir>`, and `<path>` with the absolute values from
step 3.

### cron

```
MAILTO=you@example.com
PATH=<path>
*/15 * * * * <node> <skill-dir>/scripts/prflow.ts watch --name cron
```

cron mails any stdout or stderr and sends nothing for a silent run, so reports
and errors both arrive and quiet runs stay quiet. Requires a working local MTA.

### systemd user timer

`~/.config/systemd/user/prflow-watch.service`:

```
[Service]
Type=oneshot
Environment=PATH=<path>
ExecStart=<node> <skill-dir>/scripts/prflow.ts watch --name systemd
```

`~/.config/systemd/user/prflow-watch.timer`:

```
[Timer]
OnCalendar=*:0/15
Persistent=true

[Install]
WantedBy=timers.target
```

Enable with `systemctl --user enable --now prflow-watch.timer`. Output goes to
the journal; add an `ExecStartPost` or an `OnFailure=` unit to notify.

### Hermes

Hermes runs only scripts that resolve inside `~/.hermes/scripts/` (symlinks out
of it are blocked) and may point `HOME` at its profile directory, recording the
real one in `HERMES_REAL_HOME`. Write a shim there:

```bash
#!/usr/bin/env bash
# ~/.hermes/scripts/prflow-watch.sh
set -euo pipefail
export HOME="${HERMES_REAL_HOME:-$HOME}"
export PATH="<path>:$PATH"
exec <node> <skill-dir>/scripts/prflow.ts watch --name hermes
```

Then create a no-agent job, which delivers stdout verbatim and stays silent on
empty output:

```
hermes cron create --name prflow-watch --script prflow-watch.sh --no-agent --deliver <target> "every 15m"
```

Check it with `hermes cron run <id>`, `hermes cron tick`, and
`hermes cron runs <id>`.

### Other agent schedulers

Any scheduler that can run a command works the same way: run `prflow watch`
with a unique `--name`, forward non-empty stdout, alert on exit 1. If the
scheduler can only start an agent, give the agent the same command and tell it
to relay stdout verbatim and say nothing when stdout is empty.
