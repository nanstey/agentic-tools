# Tintinweb Pi Subagents Migration Plan

## Status and first gate

**Status:** implementation is present in this working tree. It replaces Lite with five copied role-only profiles, candidate configuration, and a version-pinned two-file strict-dispatch patch. Deterministic offline coverage is the implementation gate; no installed Pi file was edited.

**Goal:** replace `pi-subagents-lite@1.17.1` with `@tintinweb/pi-subagents` while preserving least privilege, per-spawn exact model/thinking control, and main-agent model cycling.

**Decision:** published `@tintinweb/pi-subagents@0.22.1` is pinned. It accepts per-call `model` and `thinking` and exposes `Agent`, `get_subagent_result`, and `steer_subagent`. Its upstream source resolves models fuzzily and permits thinking clamping, so the managed two-file patch requires non-null exact caller values for `delegation-*`, checks a patch-owned routing allowlist and authenticated availability, rejects profile pins and unsupported thinking, and records requested, initial, and final/effective-at-start provenance. Child fallback is excluded rather than widened.

**Known gaps:** an authenticated isolated-Pi live smoke has not yet verified the candidate lifecycle or extension loading. On a first machine install, `install.sh` can only copy configuration before Pi installs the candidate; the strict patch is then skipped until Pi installs packages and `install.sh` runs again. The unpatched interval must not be used for managed delegation.

**Offline validation completed:** `install/tests/install.test.sh`, `install/tests/agent-drift.test.sh`, `install/tests/skill-links.test.sh`, `harness/pi/tests/package-patches.test.sh`, and `harness/pi/tests/pi-improve.test.sh`. The installed-package `package-extensions.test.mjs` smoke also passed against the local Pi SDK without modifying it.

## Outcome and scope

The coordinator selects a role, exact provider-qualified model, and supported thinking level for each child. The installed system keeps five capability-only `delegation-*` profiles instead of 24 model-tier profiles. It records requested, initial, and final model/thinking selections and permits only in-scope, authenticated fallback candidates.

The migration does not change the main-agent model policy. It does not enable terminal panes, tmux, visual dashboards, nested agents, scheduling, persistent memory, mentions, or package-provided agent types by default.

## Current state and evidence

Current integration includes `harness/pi/settings.json:20`, `harness/pi/APPEND_SYSTEM.md:35-150`, `install/main.sh`, `install/modules/{artifacts,patches,pi}.sh`, `harness/pi/tests/package-patches.test.sh`, and `install/tests/agent-drift.test.sh`. Lite currently needs a symlink-discovery patch because the installer exposes managed profiles as symlinks. Related policy and provenance assumptions also appear in `harness/pi/README.md`, `.agents/skills/make-agent/SKILL.md`, review skills, and agent-drift tests.

The earlier plan at `arbitrary-subagent-models@e771f43` supplies the desired five role-only profiles, strict-thinking rule, provenance fields, scoped/auth-safe fallback, and test-first approach. Its four Lite package-file patch and Lite lifecycle tests are superseded only after equivalent candidate behavior is proven. The existing quota patch stays. The earlier `pi-fallback-models` scope patch stays or is revised after the quota patch.

Reconnaissance of `@tintinweb/pi-subagents@0.23.1` suggests that `Agent` accepts `subagent_type`, `model`, and `thinking`; profile model/thinking can take precedence; model resolution may be fuzzy; scope is opt-in through `enabledModels`; thinking can clamp; background is default; and completion notifications may lack model/thinking. These are hypotheses from [the upstream README](https://github.com/tintinweb/pi-subagents/blob/master/README.md), [source tree](https://github.com/tintinweb/pi-subagents/tree/master/src), and [npm manifest](https://registry.npmjs.org/@tintinweb/pi-subagents/latest). The spike must compare the published `0.23.1` tarball or tag before relying on them.

## Required policy

- Profiles define durable capabilities and prohibitions. They never pin `model` or `thinking`.
- Invalid, fuzzy, unauthenticated, unsupported-thinking, or out-of-scope explicit requests fail before a child session starts.
- Unsupported or malformed explicit thinking fails before spawn. Thinking clamping is a no-go unless the user explicitly approves a policy change.
- The caller can use only the policy-computed model set. Prompt text cannot bypass scope, authentication, provider-family review separation, `pi-jev` policy, or nesting restrictions.
- Fallback receives the effective child scope and authentication set before selection. It records requested, initial, and final provider-qualified model/thinking values.
- Default configuration keeps visual/widget and Fleet views, conversation browsing, workflows, schedules, memory, mention-created agents, nesting, worktree isolation, and package-provided agent types off unless the spike proves they are absent or inert.
- A candidate patch is allowed only after a verified package gap cannot be resolved with configuration or a public adapter. It must be version-pinned, idempotent, fixture-tested, and affect no more than two candidate-package files. This is compared with the earlier baseline of four Lite package files plus the separate fallback-scope patch.

## Target design

```text
APPEND_SYSTEM routing policy
  -> Agent(model, thinking, role-only agent type, scope)
  -> @tintinweb/pi-subagents validates request and starts child
  -> child extensions / skills / context policy
  -> completion metadata
  -> provenance adapter or fallback extension records requested -> initial -> final

install.sh + modules
  -> settings / profiles / patches / tests
  -> local Pi runtime
```

`APPEND_SYSTEM.md` owns role selection and routing. The runtime extension owns child lifecycle. `pi-fallback-models`, if retained, owns only provider-failure replacement and cannot expand scope or authentication.

After a successful spike, the changed file set is expected to include:

```text
harness/pi/settings.json
harness/pi/APPEND_SYSTEM.md
harness/pi/README.md
harness/pi/patches/<only-if-verified>.patch
harness/pi/tests/package-patches.test.sh
harness/pi/tests/<candidate-contract>.test.mjs|sh
agents/delegation-{scout,researcher,planner,worker,reviewer}.md
install/modules/{pi,patches,artifacts}.sh
install/tests/{agent-drift,install}.test.sh
skills/workflow/review-code/SKILL.md
.agents/skills/make-agent/SKILL.md
README.md
AGENTS.md
harness/omp/README.md
```

Profile names remain provisional until the spike confirms candidate discovery and type naming. The roles retain existing capability boundaries: scout and reviewer are read-only, planner is artifact-limited, researcher is web-only, and worker is write-capable. Child configuration must prove the required `pi-intercom`, codemode, `pi-fallback-models`, and `pi-jev` exclusion behavior, plus extensions, excluded extensions, skills, transcript, context-file, and system-prompt equivalents.

## Disposable compatibility spike

Run the spike in a temporary directory with a throwaway `PI_CODING_AGENT_DIR`, a minimal settings file pinned to the candidate version, disposable profiles, and a test-only provider/model registry. Do not edit `~/.pi/agent/`, repository-managed runtime files, or installed Pi runtime files. Save package/Pi versions, commands, fixtures, stdout/stderr, structured events, schemas, and pass/fail results in an ignored evidence location. Commit only the resulting go/no-go record and concise evidence links in this plan directory.

### Fixtures

- `delegation-probe`: no `model` or `thinking`, minimal safe tools, with extension/skill/context controls varied individually.
- `pinned-probe`: a known model and thinking setting to test precedence and scope handling.
- `missing-model-probe`: no pinned selection for parent/default behavior.
- Settings variants: strict unknown-type mode (`fallbackSubagent: none` if supported), `scopeModels` off/on, exact `enabledModels`, one registered model with no authentication, restrictive parent scope, two concurrent child scopes, and routing-table/allowlist drift.
- Minimal-extras settings must test equivalents of `widgetMode: "off"`, `fleetView: false`, `agentMentions: "off"`, `workflowsEnabled: false`, `schedulingEnabled: false`, `disableDefaultAgents: true`, and `worktreeIsolation: false`.
- A local child task emits a deterministic marker and stays steerable. Provider-failure evidence cannot rely only on a real quota failure.

### Required probes

| ID | Probe | Pass criterion | Decision impact |
| --- | --- | --- | --- |
| S1 | Inspect the live `Agent` schema. Spawn with role, exact model, and thinking. Repeat with `null` and omitted values, then resume or replay an explicit request. | Inputs are accepted, null omission is documented, and replay preserves explicit intent. | Block if per-call control is absent or replay changes selection. |
| S2 | Try unknown, fuzzy/bare typo, out-of-scope, unauthenticated, unknown-type, restrictive-parent-scope, and concurrent-scope inputs. Record session creation and whether `enabledModels` changes main-agent cycling. | Every invalid request fails before spawn. Scope matches routing policy without changing main-agent policy. | Go only with deterministic pre-spawn enforcement. |
| S3 | Send malformed, unsupported, and too-high thinking values to models with different limits. | Exact strict rejection is stable and observable. | Reject if strict thinking cannot be preserved. |
| S4 | Capture Lite 1.17.1 and candidate minimal-config schemas. Toggle widget, FleetView, conversation viewer, workflows, schedules, memory, mentions, nesting, package agents, and worktree isolation. | Heavy extras can be disabled without losing lifecycle controls. Candidate Agent-schema overhead is at most 25% above Lite, unless the user approves an exception. | Block if a heavy default cannot be disabled. |
| S5 | Launch a background child. Receive completion, obtain result, steer, resume/restart, and find stop/cancel behavior. | Interrogation works without terminal panes. Completion/result has stable child identity and status. | Block if steering/result is missing. The coordinator decides stop/cancel policy before migration if no equivalent exists. |
| S6 | Capture completion records, results, session records, and package events before and after a controlled effective-model change. | A supported source or small adapter records requested, initial, and final provider-qualified model/thinking without secrets. | Block if it needs an unjustified broad patch. |
| S7 | Test frontmatter combinations for `pi-intercom`, codemode, `pi-fallback-models`, `pi-jev` exclusion, extensions, excluded extensions, skills, transcripts, context files, system prompt, `inherit_context`, and `prompt_mode`. | Required policy is representable and extension precedence is documented. | Block or cost a minimal compatibility change. |
| S8 | Place copied and symlinked fixture profiles in the candidate discovery directory and restart Pi for each. | Candidate discovers the installer-selected form. | Prefer copied files. Do not patch discovery without a demonstrated gap. |
| S9 | Use a fake provider or package seam for allowed/disallowed fallback, allowlist drift, and parent-scope propagation. | Fallback stays in authenticated scope and final provenance is accurate. | Retain/revise the fallback-scope patch after quota patch, or disable fallback for restricted children. |

### Decision record

| Requirement | Result | Evidence path/version | Resolution |
| --- | --- | --- | --- |
| Patch-cost comparison against four Lite files plus fallback-scope patch | pass | Managed patch changes `src/index.ts` and `src/types.ts` only | Two-file version-pinned patch; child fallback disabled. |
| S1 caller controls | pass, offline | Strict patch fixture behavior tests | Live candidate smoke remains open. |
| S2 strict pre-spawn validation and scope | pass, offline | Exact allowlist, null, availability, profile-pin fixture checks | Patch-owned list avoids `enabledModels`. |
| S3 strict thinking | pass, offline | `getSupportedThinkingLevels` strict branch | Live model capability smoke remains open. |
| S4 extras and schema overhead | partial | Managed `subagents.json` disables extras | Schema overhead was not live-measured. |
| S5 lifecycle and interrogation | partial | Candidate source/API inspection | Fresh isolated-Pi smoke remains open. |
| S6 provenance | partial | Patch returns requested/initial/final provenance | Final is effective-at-start only, not completion proof. |
| S7 child policy | pass, offline | Canonical `ext:` selector and drift coverage | Live extension load remains open. |
| S8 discovery | pass, offline | Installer copies regular profiles and twice-run sandbox coverage | Fresh-install discovery smoke remains open. |
| S9 fallback containment | pass by policy | Child profiles exclude fallback; `fallbackSubagent: false` | No child fallback path is permitted. |

Go only if S1, S2, S5, S7, and S8 pass; S3 preserves strict thinking; S4 meets the schema threshold; and S6/S9 fit the patch budget. Choose no-go if model resolution can silently change an explicit request, any invalid request starts a child, lifecycle controls are unavailable, strict thinking cannot be preserved, or provenance/fallback containment exceeds the patch budget.

## Migration delivery

### Slice 1: Decision record

Completed from published `0.22.1` source, managed fixtures, and deterministic package tests. The remaining live checks are explicitly recorded above; they do not authorize use during the first-install unpatched interval.

### Slices 2 and 3: One atomic migration change

Implemented as one working-tree remediation batch. It does not activate a local runtime or alter `~/.pi/agent`. Do not treat lifecycle provenance as completion proof, and do not leave mixed Lite/candidate tools or weakened review provenance.

1. Replace the Lite package pin with the spike-approved candidate version. Add only verified minimal settings and a managed candidate settings file only where required.
2. Add exactly five role-only `delegation-*` profiles. Omit model/thinking, preserve least privilege, disable nesting, and apply spike-verified extensions, skills, context, prompt, and transcript policy.
3. Update `install/main.sh` and `install/modules/{pi,patches,artifacts}.sh` for idempotent Lite retirement, candidate installation, copied/symlinked discovery behavior, and any verified patch. Keep the quota patch and retain/revise the fallback-scope patch after it.
4. Rewrite `APPEND_SYSTEM.md` for role-only `subagent_type`, per-call model/thinking, strict unknown types, exact scope, extras-off settings, child policy, and only verified lifecycle APIs. Keep main-agent model policy unchanged.
5. Implement the smallest provenance path, preferring a public event/result adapter. Record requested, initial, and final provider-qualified model/thinking without credentials or local paths.
6. Prove fallback behavior under effective scope and authentication. If it cannot be constrained, disable it for restricted children rather than widening access.
7. Replace Lite tool names and completion-schema references in `APPEND_SYSTEM.md`, `skills/workflow/review-code/SKILL.md`, review references, and `.agents/skills/make-agent/SKILL.md`.
8. Update root/harness documentation, catalogs, and managed-file tables. Ensure `harness/pi/README.md` still documents fixed-tier `pi-jev` exclusion and the self-improve thinking patch accurately.
9. Retire obsolete Lite profiles, tests, labels, and operational references. Preserve user-owned `scout.md` during profile retirement.

## Verification

Run deterministic, offline tests for:

- clean and repeated installation, Lite-present and partial-retirement states, candidate-present state, candidate-patch state, and preservation of `scout.md`;
- five profiles with no model/thinking pins, role capability boundaries, discovery behavior, strict settings, and no stale 24-profile state;
- exact model/thinking, null/omitted values, replay, strict invalid-input rejection before child creation, parent and concurrent scopes, and routing-table/allowlist drift;
- extras-off behavior, schema overhead, extensions, skills, `pi-jev` exclusion, nesting, and context/prompt/transcript controls;
- lifecycle completion, result, steer, resume, stop/cancel policy, provenance, allowed fallback, rejected out-of-scope fallback, and rejected unauthenticated fallback;
- review workflow consumption of candidate provenance without Lite `subagent-result` fields; and
- absence of operational Lite package, tool, profile, or schema references after migration.

Run `bash harness/pi/tests/package-patches.test.sh`, `bash install/tests/agent-drift.test.sh`, `bash install/tests/install.test.sh`, and CI-equivalent Pi checks. An authenticated smoke test can supplement these tests but cannot be the only proof.

## Publication gate

Before publishing the migration PR, obtain user review if it adds a package patch, disables a previously enabled fallback path, or changes the proven provenance surface.
