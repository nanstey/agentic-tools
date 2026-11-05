# System architecture: arbitrary subagent model dispatch

## Intent

Replace model- and thinking-pinned role variants with one reserved capability profile per role while preserving per-spawn selection of a model family and reasoning level.

"Arbitrary" means a model registered in the active Pi registry, authenticated by the active profile, and allowed by the active child scope. It does not mean accepting an unregistered provider/model string, changing credentials, bypassing scope, or adding a model-picker UI.

## Current boundary

`pi-subagents-lite` already carries `params.model` and `params.thinking` through child-session creation, but `src/registration.ts` rejects both fields in the strict `Agent` schema. Its listener overwrites model selection with configured/frontmatter/parent defaults. In strict mode, optional schema properties are nullable required fields, so a legacy omitted value arrives as `null`. `src/agents/restart-last-agents.ts` separately reconstructs a model through `modelFor`.

`pi-fallback-models/src/extension.ts` currently selects fallback candidates with `modelRegistry.find` without applying a child `scopedModels` restriction. A fallback can therefore escape a restrictive child scope unless the extension is patched.

## Proposed boundary and data contract

Extend the pinned packages through version-pinned, idempotent harness patches. `Agent` accepts these caller-intent fields:

```ts
model?: string       // registered `provider/model-id`
thinking?: ThinkingLevel
```

For strict/constrained calls, `model: null` and `thinking: null` have the same meaning as absent properties. Normalize both `null` and `undefined` to omitted before listener default behavior, execution resolution, and restart/replay. Do not persist a generated default as though the caller explicitly requested it.

The execution-path resolver is the sole strict validator and resolver. It receives preserved caller intent plus the normal profile/config/default context and returns a single spawn contract:

```ts
{
  requested: { model?: ProviderQualifiedModel; thinking?: ThinkingLevel },
  initial: { model: ProviderQualifiedModel; thinking?: ThinkingLevel },
}
```

`requested` exists only for explicit non-null input. `initial` is the model and thinking supplied to child creation after explicit-or-legacy resolution. The listener only normalizes omission, preserves explicit values, and supplies UI/default display behavior. It must not independently validate or fully resolve a request. The executor and restart/replay both call the resolver, so a replay preserves explicit intent and applies the same strict rules.

The existing agent type, prompt, tools, extension filters, context behavior, turn limits, and worktree behavior remain profile-owned. A dispatch override changes only child model selection and reasoning level.

### Resolution order

1. Normalize `null` and `undefined` to omitted.
2. For an explicit model, the execution resolver parses `provider/model-id`, verifies membership in nonempty `scopedModels` when present, resolves the registered model, and requires configured authentication.
3. For an omitted model, use the existing session-per-type, session-default, config-per-type, config-default, profile-frontmatter, and parent-model precedence.
4. For explicit thinking, validate supported literals and the selected model capability. An unsupported value fails before spawn with a clear error. It is never clamped.
5. For omitted thinking, retain existing profile/default/parent resolution.

## Fallback boundary

Patch `pi-fallback-models@0.1.1/src/extension.ts` so every candidate is filtered through the spawning child session's scope and configured authentication before `modelRegistry.find` or activation. The fallback extension receives or captures the child scope at session lifecycle registration, not just the parent registry. If that API cannot provide a restrictive child scope reliably, disable fallback for restrictive child scopes rather than widening scope.

The scope patch composes with the existing quota-text patch on the same file: generate it against the quota-patched source, run `install_fallback_quota_patch` first, then run the scope patch. Register both in that deterministic order in `install/modules/patches.sh` and the `patch-fallback` branch of `install/main.sh`. A pristine package therefore receives quota then scope; a pre-existing quota-only installation receives only the scope upgrade; a both-patched installation reports `ok` on repeat. Fixtures and lifecycle tests cover pristine, quota-only, both-patched, quota-only upgrade, and repeat `ok`. Regression coverage must also prove an out-of-scope or unauthenticated fallback candidate is not selected. A provider failure smoke is optional and cannot be the sole fallback test.

## Data flow

```text
parent routing policy
  -> Agent({ agent: delegation-role, model?, thinking?, prompt })
  -> Lite strict schema (nullable fields normalized as omitted)
  -> listener preserves caller intent and display/default behavior
  -> sole execution-path resolver
  -> profile discovery (prompt + tools only)
  -> active scope, registry, and auth checks
  -> child session with initial model/thinking
  -> scope- and auth-filtered fallback extension, if provider failure
  -> background completion with requested, initial, and final provenance
```

## Provenance

Completion metadata carries provider-qualified model identifiers and thinking levels for all three stages:

| Stage | Meaning |
| --- | --- |
| Requested | Explicit non-null caller selection, if supplied. |
| Initial | Resolved model and thinking passed to child creation. |
| Final | Model and thinking actually used when the run completes, including an eligible fallback. |

The user-facing result does not expose credentials or internal session paths. Deterministic contract tests verify this data contract. An authenticated live smoke can confirm a permitted alternate model, but flaky provider failure does not prove fallback behavior.

## Compatibility and migration

- Calls omitting model and thinking, including constrained `null` fields, retain current behavior.
- The steady state has five reserved profiles: `delegation-scout`, `delegation-researcher`, `delegation-planner`, `delegation-worker`, and report-only `delegation-reviewer`.
- The delegation policy keeps its role/tier routing matrix, but supplies selected model and thinking in the `Agent` call instead of encoding them in profile files.
- Profile tools stay least-privilege. A model override never makes a reviewer a writer.
- The installer removes only manifest-managed old tier files. The reserved prefix prevents a migration from overwriting user-owned generic names such as `scout.md`.

## Failure behavior

| Condition | Required behavior |
| --- | --- |
| Model/thinking omitted or `null` | Existing profile/config/default resolution |
| Unknown, out-of-scope, or unauthenticated explicit model | Clear failure before child creation |
| Invalid or unsupported explicit thinking | Clear strict failure before child creation, never clamping |
| Provider failure after spawn | Only a scoped, authenticated fallback may run; completion records final selection |
| Lite package absent | Lite-specific installer guard skips |
| Installed wrong Lite version or missing/moved patched path | Installer fails without partial patching |
| Package source changed | Installer fails without partial patching |

## Out of scope

- Changing the main session model.
- Adding credentials, providers, a generic provider API, or a model-discovery UI.
- Relaxing active scope or authentication during fallback.
- Letting delegated agents spawn further agents.
