# Vertical slices: arbitrary subagent model dispatch

## Sequence

### 1. Runtime dispatch override

**Observable outcome:** A parent can call `Agent` with an existing role profile and an explicitly chosen registered, authenticated, scoped model and thinking level. The child runs with that initial selection. Invalid, unavailable, out-of-scope, unauthenticated, or unsupported requests fail before child creation. A constrained `null` model or thinking behaves exactly like omission.

**Boundary:** Lite and fallback package patches, including parent-scope propagation into child session lifecycle, installer hooks, complete pristine and composed fallback fixtures, static lifecycle coverage, and focused resolver, replay, fallback-scope, and provenance coverage. The fallback scope patch is based on the existing quota-patched source and installs after the quota patch. Existing profiles and policy remain unchanged in this slice.

**Why this comes first:** The profile migration depends on a real dispatch-time override. Keeping current profiles temporarily allows direct behavior tests without combining package compatibility work with configuration migration.

**Verification checkpoint:**

- Lite fixture covers pinned `1.17.1` package metadata and all patched files: `registration.ts`, `tool-execution.ts`, `restart-last-agents.ts`, and `agent-runner.ts`; focused tests prove restrictive parent scope reaches child fallback lifecycle.
- Lite-specific guard skips only an absent package and fails for wrong version or any missing expected patched file before a partial write.
- Lite applies to its pristine fixture. The fallback lifecycle applies quota then scope from pristine, upgrades a quota-only fixture to both-patched state, reports `ok` on repeat from both-patched state, and rejects changed source.
- Contract harness proves strict nullable omission, legacy omitted defaults, sole-resolver validation, strict thinking rejection, restart preservation, scope/auth-safe fallback, and requested/initial/final provenance.
- Optional authenticated smoke uses a permitted alternate model and inspects the parent completion record. Provider-failure behavior is not considered tested only because a provider failed.

### 2. Role-profile migration

**Observable outcome:** The installed `Agent` type list contains five reserved capability profiles instead of 24 model-tier variants: `delegation-scout`, `delegation-researcher`, `delegation-planner`, `delegation-worker`, and `delegation-reviewer`. Routing picks model and thinking in each `Agent` call and reports final completion provenance for current-session cross-family review.

**Boundary:** Replace tier profiles with reserved role-only profiles; update routing and fallback policy, catalog, authoring guidance, profile/install regression tests, managed-file docs, package-patch fixture tests, and provenance references. The existing agent-install manifest retires only managed old profile names.

**Verification checkpoint:**

- Policy calls use a reserved role plus explicit model and thinking from the retained routing table.
- Role prompts retain least-privilege tools, especially report-only reviewer restrictions.
- `harness/pi/tests/package-patches.test.sh` is migrated with every other active tier-profile reference. Its sandbox paths, profile count assertions, and managed-retirement expectations use the new names.
- A migration inventory reports zero active old tier-profile references outside explicit historical retirement/migration assertions.
- Two isolated installer runs copy only five `delegation-*` files, retire old manifest-managed tier files, and preserve a user-owned `scout.md` unchanged.
- A fresh Pi session exposes the five profiles and completes an own-work cross-family review with final-model evidence.

## Out of scope

- A model-picker UI or user-facing model catalog.
- New provider credentials or a generic provider API.
- Fallback access outside the active child scope.
- Changes to the main agent's selected model.
