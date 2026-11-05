# Slice 02: Role-profile migration

## Objective

Replace the 24 model-tier Pi Lite profiles with five reserved capability profiles and make routing choose `agent`, `model`, and `thinking` at dispatch time.

## Preconditions

Slice 01 is merged and validated on a fresh Pi session. The patched `Agent` tool must reject invalid explicit choices, preserve nullable omission, constrain fallback, and record requested, initial, and final provenance.

## Scope

- `agents/*.md`
- `README.md`
- `harness/pi/APPEND_SYSTEM.md`
- `harness/pi/README.md`
- `harness/pi/tests/package-patches.test.sh`
- `install/tests/agent-drift.test.sh`
- `install/tests/install.test.sh` where profile-install fixtures require updates
- `.agents/skills/make-agent/SKILL.md`
- `skills/workflow/review-code/` and every active dispatch/provenance reference

## Checklist

1. Define exactly five reserved steady-state profiles: `delegation-scout`, `delegation-researcher`, `delegation-planner`, `delegation-worker`, and `delegation-reviewer`. Do not create bare generic names such as `scout.md`; the installer copies regular files and could overwrite user-owned files.
2. Move each shared role prompt into its reserved profile. Remove model and thinking frontmatter from all five. Keep explicit tools, extensions, skills, context settings, and transcript policy. Ensure `delegation-reviewer` remains report-only without `edit` or `write`.
3. Remove the 24 `<role>-<tier>` files. Let the managed-agent manifest retire only those names managed by a previous installer. Test that a pre-existing user-owned `scout.md` remains byte-for-byte untouched while managed old tier files retire.
4. Rewrite `APPEND_SYSTEM.md` delegation policy so tiering chooses model and thinking data, then calls `Agent` with a `delegation-*` role, model, and thinking. Keep role selection, Jev tier classification, scope/auth constraints, fallback caveat, and background provenance requirements. Remove all language that permits clamping unsupported explicit thinking.
5. Replace non-binding `primary -> fallback` cells with one explicit model/thinking routing table. Document fallback separately as global behavior constrained by child scope and auth, not as a selected table value.
6. Rewrite cross-family verification: choose `delegation-reviewer` with the opposite-family model from the routing policy and verify provider-qualified final completion metadata. For current-session claims, retain requested and initial metadata when final fallback differs. Never infer third-party provenance.
7. Update the README catalog and `harness/pi/README.md` to list the five reserved capabilities without claiming model/thinking is profile-pinned. Document the two managed package patches and optional authenticated smoke limits.
8. Rewrite `install/tests/agent-drift.test.sh` around the new contract: expected five reserved names, role-specific tool restrictions, no pinned model/thinking fields, required Pi-Jev exclusion where still intended, and documentation/policy consistency. Do not retain tests that require copied role bodies across retired tiers.
9. Update `install/tests/install.test.sh` and `harness/pi/tests/package-patches.test.sh`. The latter has sandboxed old paths and hard-coded profile counts, so migrate its fixture setup, expected installer output, copied names, and retirement assertions. Both tests run twice against an isolated agent directory, verify only five copied reserved profiles, verify old manifest-managed tiers are removed, and preserve user-owned `scout.md`.
10. Update `make-agent` installation/grouping/description guidance for copied reserved role profiles and dispatch-time routing. Update every active review-code provenance reference to distinguish requested, initial, and final model/thinking selections.
11. Perform a migration inventory before completion. `rg` must find no active `<role>-<tier>`, `reviewer-anthropic-*`, or `reviewer-openai-*` references in policy, catalogs, installer tests, package-patch tests, agents, or skills. Explicit historical retirement fixtures and migration assertions may retain old names only when labeled as such.
12. Run the full installer twice, restart Pi, verify the Agent schema lists five reserved role types, and perform an optional background cross-family review smoke with explicit model/thinking values.

## Definition of done

- Exactly five harness-managed `delegation-*` profiles are installed after a clean install.
- Routing performs model/tier selection through Agent arguments, not profile frontmatter.
- User-owned generic profiles are preserved and old harness-managed tier files are retired.
- Catalog, authoring guide, harness documentation, package-patch tests, installer tests, and dispatch policies agree.
- The migration inventory has zero active obsolete profile references outside explicit historical migration coverage.
- `bash install/tests/agent-drift.test.sh`, `bash install/tests/install.test.sh`, and `bash harness/pi/tests/package-patches.test.sh` pass.

## Risk controls

- Do not start this slice before Slice 01 is usable in a new Pi session.
- Do not preserve old aliases unless a concrete external caller requires them. If aliases are required, make them temporary and test their retirement date.
- Validate that a model override cannot widen reviewer permissions or bypass model scope/auth checks, including fallback.
- Keep final-model evidence local to coordination artifacts and user reports, never published PR comments.

## Out of scope

Changing model providers, creating a model-picker UI, changing the global fallback order, or widening scope to a generic provider API.
