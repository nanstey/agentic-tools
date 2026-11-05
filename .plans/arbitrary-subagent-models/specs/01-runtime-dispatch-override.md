# Slice 01: Runtime dispatch override

## Objective

Make installed `pi-subagents-lite@1.17.1` `Agent` calls accept strict per-spawn `model` and `thinking` arguments while preserving legacy behavior when they are omitted or represented as strict-mode `null` values. Ensure fallback never escapes a child model scope.

## Scope

- `harness/pi/patches/pi-subagents-lite-agent-model-thinking.patch`
- `harness/pi/patches/pi-fallback-models-scoped-fallback.patch`
- `install/modules/patches.sh`
- `install/main.sh`
- `harness/pi/tests/fixtures/pi-subagents-lite-1.17.1/`
- `harness/pi/tests/fixtures/pi-fallback-models-0.1.1/`
- `harness/pi/tests/package-patches.test.sh`
- `harness/pi/README.md`

Do not change the 24 role/tier profile files, routing policy, credentials, fallback order, or main-agent model policy in this slice.

## Checklist

1. Copy pristine pinned Lite package metadata and these exact source files into a versioned fixture: `src/registration.ts`, `src/agents/tool-execution.ts`, and `src/agents/restart-last-agents.ts`. Copy the `pi-fallback-models@0.1.1` package metadata and `src/extension.ts` into a fixture with explicit pristine, quota-only, and both-patched expected states. Record source provenance in fixture setup.
2. Create the Lite patch with narrow hunks that:
   - expose nullable optional `model` and `thinking` fields in the strict Agent schema and add strict-mode required entries as Lite requires;
   - normalize `null` and `undefined` to omitted consistently in listener/default behavior, executor, and restart/replay;
   - establish one execution-path resolver as the only strict validator and resolver;
   - resolve explicit `provider/model-id` only through active scope, registry, and configured-auth checks;
   - reject malformed, unknown, out-of-scope, and unauthenticated models before spawn;
   - reject invalid or unsupported explicit thinking before spawn, never clamp it;
   - preserve explicit intent in the listener without duplicate resolution and use the resolver output for spawn/invocation metadata;
   - prevent permissive parent-model fallback from handling explicit input;
   - replay preserved explicit intent through the same resolver.
3. Define and propagate the completion contract: provider-qualified requested, initial, and final model selections, each with its applicable thinking level. Requested fields appear only for explicit non-null input. Keep credentials and internal paths out of results.
4. Create the fallback scope patch for `pi-fallback-models@0.1.1/src/extension.ts` that registers child-session scope at extension lifecycle time and filters fallback candidates by that scope and configured auth before lookup/activation. It is generated against the source after the existing quota-text patch, not pristine source. If reliable restrictive scope is unavailable, disable fallback for that child rather than widening it.
5. Keep `install_fallback_quota_patch` first and install the scope patch second in `install/modules/patches.sh` and the `patch-fallback` branch of `install/main.sh`. This order takes a pristine fixture through quota-only to both-patched, takes an existing quota-only installation to both-patched, and returns `ok` when both patches are already installed.
6. Add a Lite-specific `install_subagents_lite_agent_model_thinking_patch` guard. It skips only when the Lite package directory is absent. When installed, it verifies `package.json` is exactly `1.17.1` and verifies all three patched source paths before dry-run or patch application. A wrong version, missing/moved path, or changed source fails with no partial writes. Add an analogous pinned guard for the fallback scope patch while preserving quota-first ordering.
7. Register the Lite patch and both ordered fallback patch labels and installed package locations in `install/main.sh`. Preserve the current aggregate `PATCH_FAILED` behavior so unrelated managed actions continue but installation exits nonzero.
8. Extend `harness/pi/tests/package-patches.test.sh` to prove for each patch:
   - Lite pristine fixture becomes patched and reports `ok` on repeat;
   - fallback pristine fixture receives quota then scope and reaches the both-patched fixture;
   - fallback quota-only fixture upgrades to both-patched, while a both-patched fixture reports `ok` on repeat;
   - changing any patched source context rejects safely and causes installer failure;
   - wrong installed package version and each missing expected source path fail;
   - an absent package alone skips;
   - patched source contains schema, nullable normalization, strict validation, replay, provenance, quota behavior, and fallback-scope behavior rather than cosmetic text.
9. Add a focused executable harness without widening runtime API that proves:
   - valid explicit model selection;
   - ordinary omitted and constrained nullable legacy calls retain `modelFor` and thinking defaults;
   - malformed, unknown, scoped-out, and missing-auth model rejection before spawn;
   - valid thinking propagation and invalid/unsupported thinking rejection without clamping;
   - restart preservation of explicit intent and nullable replay omission;
   - fallback accepts only scoped, authenticated candidates or is disabled for an unrecoverable restrictive scope;
   - deterministic requested, initial, and final provider-qualified model/thinking completion metadata.
10. Run an optional isolated installed-Pi authenticated smoke: spawn a background agent with an alternate permitted model and inspect parent completion metadata. Do not treat an induced or flaky provider failure as fallback coverage.
11. Add managed-patch rows to `harness/pi/README.md`, including target package files, package/version guards, quota-then-scope composition order, idempotence, mismatch behavior, scope-preserving fallback, and the fact that Lite only exposes fields it already propagates.

## Definition of done

- The Agent schema accepts the two fields and rejects undeclared fields.
- `null` and omitted values preserve legacy default/profile behavior in constrained and non-constrained calls.
- A valid explicit selection reaches the child session unchanged.
- Invalid explicit selections never silently run on a parent/default model, and unsupported thinking never clamps.
- Fallback cannot select an out-of-scope or unauthenticated model.
- `bash harness/pi/tests/package-patches.test.sh` passes.
- Deterministic tests prove completion provenance. The optional smoke produces live completion provenance for a permitted child.

## Risk controls

- Patch only the pinned package versions. Reject changed upstream context rather than fuzzy-patching it.
- Verify all Lite patched paths and package metadata before patching. Do not allow the generic missing-entry success path to hide a wrong installed package.
- Never log API keys, auth details, or raw child-session paths.
- Preserve all old calls that omit or null both fields.

## Out of scope

Role-profile simplification and routing-policy changes belong to Slice 02.
