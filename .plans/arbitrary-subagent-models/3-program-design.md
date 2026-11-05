# Program design: arbitrary subagent model dispatch

## Files and ownership

| Area | Change |
| --- | --- |
| `harness/pi/patches/pi-subagents-lite-agent-model-thinking.patch` | New unified patch for `pi-subagents-lite@1.17.1`: `src/registration.ts`, `src/agents/tool-execution.ts`, and `src/agents/restart-last-agents.ts`. |
| `harness/pi/patches/pi-fallback-models-scoped-fallback.patch` | New unified patch for quota-patched `pi-fallback-models@0.1.1/src/extension.ts` that filters fallback candidates by child scope and configured auth. |
| `install/modules/patches.sh` | Add Lite-specific and ordered fallback patch installers: quota first, then scope. |
| `install/main.sh` | Register the Lite patch and ordered quota-then-scope fallback lifecycle in the Pi install matrix. |
| `harness/pi/tests/fixtures/pi-subagents-lite-1.17.1/` | Pristine package manifest plus all three Lite patched sources. |
| `harness/pi/tests/fixtures/pi-fallback-models-0.1.1/` | Pristine package manifest and `extension.ts` state fixtures for pristine, quota-only, and both patches. |
| `harness/pi/tests/package-patches.test.sh` | Add lifecycle, composition, mismatch, all-file fixture, resolver/replay, fallback-scope, and migration-install coverage. |
| `agents/*.md` | Replace the tier matrix with five reserved `delegation-*` profiles after runtime support is proven. |
| `install/tests/agent-drift.test.sh` | Replace fixed 24-name expectations with the reserved-profile and routing-policy contract. |
| `harness/pi/APPEND_SYSTEM.md`, `harness/pi/README.md`, `README.md` | Rewrite routing, fallback, catalog, and patch documentation for dispatch-time selection. |
| `.agents/skills/make-agent/SKILL.md` and active dispatch/provenance references | Align authoring, policy, and provenance wording with reserved role profiles and completion metadata. |

## Patch contract

### Schema and nullable omission

In `src/registration.ts`, add `model` and `thinking` as optional fields. In constrained mode, add each to the required list as a nullable union, matching Lite's existing strict-schema convention. The runtime treats both `null` and `undefined` as omitted before all selection logic.

Contract tests cover both non-strict omission and strict legacy calls that carry required nullable `model: null` and `thinking: null`. They must prove these calls follow the same legacy defaults as calls without either field.

### One execution resolver

Add one resolver in `src/agents/tool-execution.ts`, used by normal execution and `src/agents/restart-last-agents.ts`. It accepts raw caller intent and context, normalizes nullable omission, and returns the requested and initial selection contract. The listener does not call this resolver. It preserves explicit caller values and only applies existing UI/default behavior for omitted values.

For an explicit model, the resolver must:

1. parse a `provider/model-id` key;
2. require it to be in `ctx.scopedModels` when that list is nonempty, otherwise in the active registry;
3. resolve it through `ctx.modelRegistry.find`;
4. require `ctx.modelRegistry.hasConfiguredAuth(model)`;
5. throw a stable, actionable error for malformed, unknown, out-of-scope, or unauthenticated input.

It must not call permissive `findModelInRegistry` for an explicit request. That helper may substitute a parent model and would make a typo look successful.

For explicit thinking, strictly parse supported literals, resolve against the initial model, and reject unsupported values before spawn. Remove all planned references to clamping as an acceptable explicit-request outcome. Omitted thinking retains existing profile/default/parent behavior.

`toolCallListener` must not overwrite an explicit non-null model or thinking. It normalizes nullable input, leaves strict resolution to the executor, and may set display-only state or calculate existing defaults only for an omitted value. `executeAgentTool` uses the resolver result for `SpawnOptions`, invocation metadata, and provenance. Restart/replay passes its historical raw intent to the same resolver, preserving an explicit request rather than re-running `modelFor` as though it were omitted.

### Fallback scope enforcement

Patch `pi-fallback-models@0.1.1/src/extension.ts` to thread the child session's scope into fallback candidate selection and filter candidates by both scope and `hasConfiguredAuth` before registry lookup/activation. Register the patch with the fallback extension lifecycle so it has the correct child scope during model-error handling. If lifecycle context cannot identify a restrictive child scope, explicitly disable fallback for that child scope and retain the initial failure.

This patch must compose with the existing `install_fallback_quota_patch`, which edits the same source. Generate the scope patch from the quota-patched `extension.ts`; the installer always runs quota first and scope second. The fallback lifecycle fixture contains pristine, quota-only, and both-patched states. Tests prove a pristine install reaches both-patched state, a quota-only installation upgrades to both-patched state, and re-running either fully patched installation reports `ok`. Tests also use stubbed registry, scope, and auth data to prove an eligible fallback is selected and out-of-scope or unauthenticated configured-chain candidates are rejected. Live provider failures are supplemental smoke only.

### Installer guard and fixtures

Do not use generic `apply_package_patch` for Lite. Add a Lite-specific guard that skips only when the `pi-subagents-lite` package directory is absent. When installed, it verifies `package.json` reports `1.17.1` and every expected patched source path exists before any dry run or write. An installed wrong version or a missing/moved path fails, even if `src/registration.ts` is absent.

The fallback scope patch receives the analogous package/version/path guard for `pi-fallback-models@0.1.1`, while preserving the quota-first composition order. The Lite fixture contains the exact pristine `package.json`, `src/registration.ts`, `src/agents/tool-execution.ts`, and `src/agents/restart-last-agents.ts`. Lifecycle tests apply, reapply, mismatch-check, and replay-check the complete Lite fixture, and exercise fallback pristine, quota-only, both-patched, quota-only-upgrade, and repeat-`ok` states.

### Provenance

Keep final details sourced from the settled child session, but add provider-qualified requested and initial model/thinking alongside final model/thinking. Requested fields appear only for explicit non-null input. Define stable detail names and test them from the resolver through background completion metadata. Do not expose credentials or internal paths.

## Policy and profile design

Keep a model/tier decision table in `APPEND_SYSTEM.md`, but render each choice as `{ agent: delegation-role, model, thinking }`. Do not put `primary -> fallback` values in the table. Fallback is global runtime behavior and remains documented separately.

Use five profiles:

- `delegation-scout` and `delegation-researcher`: read-only reconnaissance and research
- `delegation-planner`: plan-artifact authoring only
- `delegation-worker`: implementation writer
- `delegation-reviewer`: report-only, without `edit` or `write`

The `delegation-` prefix reserves installer-owned names. Migration must not create bare `scout.md`, `researcher.md`, `planner.md`, `worker.md`, or `reviewer.md`, because regular-file copying could overwrite user-owned files. Preserve the policy that a background completion record, not a transcript, supplies actual model provenance for current-session cross-family review.

## Test seams

1. **Patch lifecycle:** each package fixture applies once, reports `ok` on repeat, rejects changed source without partial changes, and fails for installed wrong versions or any missing expected patched source file. The fallback fixture additionally proves quota-first composition from pristine, quota-only upgrade, both-patched state, and repeat `ok`.
2. **Schema and omission contract:** schema admits both fields; strict nullable `null` and ordinary `undefined` preserve legacy default behavior; undeclared fields remain rejected.
3. **Resolution contract:** valid explicit model wins; omitted intent follows current `modelFor`; malformed, unknown, out-of-scope, and unauthenticated requests abort before spawn.
4. **Thinking contract:** valid explicit thinking reaches spawn; invalid or unsupported explicit thinking aborts, never becomes `undefined` or a clamped value.
5. **Replay contract:** restart uses the same resolver and retains an original explicit request; nullable historical values replay as omitted defaults.
6. **Fallback contract:** stubbed fallback lifecycle respects child scope and auth, with restrictive-scope fallback disabled if scope cannot be recovered.
7. **Provenance contract:** deterministic background-completion fixtures distinguish provider-qualified requested, initial, and final model selections and associated thinking levels. An optional authenticated smoke confirms a permitted alternate model. It does not claim fallback from an induced or flaky provider failure.
8. **Profile migration:** installer tests retire manifest-managed old tiers, install exactly five `delegation-*` files, and prove user-owned `scout.md` remains untouched.
9. **Migration inventory:** a zero-active-reference check covers policy, catalog, installer tests, and `harness/pi/tests/package-patches.test.sh`, which hard-codes current agent paths and counts. Old names may remain only in explicit retirement fixtures or migration assertions.

## Exclusions

The patches do not add models to Pi, modify auth profiles, make profiles write-capable, permit child-to-child delegation, or add a UI picker.
