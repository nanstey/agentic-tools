# Proposal: foreground-only Pi subagents

## Outcome
Pi's managed subagent policy permits only foreground calls. Background execution and scheduling are unavailable through configuration, managed role profiles, and the extension invocation path, including resume.

## Acceptance
- **A1** Given the installed managed Pi configuration, when a subagent is invoked without an execution-mode override, then it runs in the foreground. **Check (code):** `bash install/tests/agent-drift.test.sh` passes with `backgroundByDefault: false` and all five profiles set to `run_in_background: false`.
- **A2** Given any `Agent` invocation, including a resume, when it requests `run_in_background: true` or a schedule, then the extension refuses it and does not start detached work. **Check (code):** foreground-only assertions added to `bash harness/pi/tests/package-patches.test.sh` pass against the patched package.
- **A3** Given a clean package installation, when `bash install.sh` runs twice, then the foreground-only patch reports applied on the first run and already applied on the second. **Check (code):** `bash install/tests/install.test.sh` passes and the real-install check records `patched`, then `ok`.
- **A4** Given installed Pi policy documentation and prompt guidance, when a coordinator reads it, then it directs foreground-only execution and does not recommend background dispatch, scheduling, polling, or steering. **Check (code):** targeted repository searches for foreground-only policy conflicts return no active instruction to set `run_in_background: true`, use background execution, or schedule work.
- **A5** Given existing managed-profile and installer behavior, when the change is applied, then current package patches and installer regression tests remain valid. **Check (code):** `git diff --check`, `bash harness/pi/tests/package-patches.test.sh`, and `bash install/tests/install.test.sh` pass.

## Decisions
- **2026-02-06:** Enforce the policy at the extension boundary as well as in JSON and profiles. The resolver permits an explicit background request on resume because no managed profile is resolved, so settings alone are insufficient.
- **2026-02-06:** Disable scheduling. Scheduled execution is detached by design, and the extension already hides and rejects schedule requests when `schedulingEnabled` is false.
- **2026-02-06:** Use a new version-pinned patch and a separate idempotent installer registration. Repository policy forbids local-only Pi modifications and requires new patches rather than changing installed third-party files or existing patch artifacts.

## Assumptions
- The `/agents` session UI does not need a separate hardening patch because the portable global configuration and extension invocation checks provide the required execution policy.
- Cross-extension RPC is out of scope because it is not a model-callable `Agent` path.

## Evidence
- `harness/pi/subagents.json` currently enables background-by-default and scheduling.
- `~/.pi/agent/npm/node_modules/@tintinweb/pi-subagents/src/invocation-config.ts` resolves `params.run_in_background` when a profile is absent.
- `~/.pi/agent/npm/node_modules/@tintinweb/pi-subagents/src/index.ts` skips fresh-spawn type validation for resume calls, allowing that resolver gap.
- `src/index.ts` already hides and rejects `schedule` when scheduling is disabled.
- `install/tests/agent-drift.test.sh` asserts the current profile foreground setting and needs updated expectations.

## Approach
Add the portable foreground settings and set every managed profile's `run_in_background` to false. Add a narrow patch to the installed subagents extension that rejects explicit background or schedule requests before invocation and makes the resolved invocation foreground, including resume. Register it through a new idempotent installer function after existing subagents policy patches.

Extend the package-patch fixture tests with direct invocation checks for background and schedule rejection plus patch idempotency. Update installer drift tests and the Pi managed-file table. Revise subagent policy and affected skill/prompt guidance so it describes synchronous completion and removes background-only coordination instructions.

## Risks and unknowns
- Patch hunk context can conflict with existing strict-dispatch and project-settings patches. The package-patch suite and real install twice check patch ordering and idempotency.
- Foreground calls serialize coordinator work, so instructions that require concurrent background fan-out must be removed or rewritten.
- Installed source is version-pinned at `@tintinweb/pi-subagents@0.22.1`; an upstream version change requires a regenerated patch.

## Out of scope
- Changing Pi core's agent tool API.
- Blocking non-model-callable cross-extension RPC spawn paths.
- Re-enabling fleet, widgets, or unrelated subagent capabilities.

## Open questions
None.
