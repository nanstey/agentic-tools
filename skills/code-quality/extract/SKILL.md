
---
name: extract
description: Identifies extraction opportunities from DRY and SRP findings and proposes reusable boundaries. Use when planning concrete code extractions in a chosen scope.
user-invocable: true
disable-model-invocation: false
---

# Goal

Extract code into reusable components.

# Inputs

1. Scope (optional)
  - User may provide specific context boundaries (single function, file, module, branch, PR, etc)
  - If no scope provided, call `scope`

# Workflow

1. Use provided scope or call `scope` to determine context boundaries.
2. Call `dry` to identify duplicated pieces of code.
3. Call `srp` to identify mixed responsibilities and propose cohesive boundaries.
4. Create a list of specific violations to DRY and SRP.
5. For each violation, propose a specific extraction.
6. For each extraction, determine an explicit placement decision:
  - `same file`
  - `other file`
  - `new file`

# Guidelines

- Non-exhaustive opportunities for extraction:
  - UI Components / subcomponents
  - Hooks
  - Helpers
  - Utilities
  - Functions
  - Modules
- Every extraction recommendation must include **one** destination decision:
  - `same file`
  - `other file`
  - `new file`
- Determine destination by evaluating:
  - Code type: UI component, hook, pure domain logic, adapter/integration, persistence, utility, framework glue.
  - Function/role: what responsibility the extracted unit owns.
  - Runtime: client/browser, server, shared/isomorphic, build/test/tooling.
  - Domain: business area, feature boundary, bounded context.
  - Related code and ownership: what units are most cohesive and change together.
  - Existing repo guidance and conventions for colocating similar code (follow `AGENTS.md` and any local patterns in scope).
- Placement decision rules:
  - Choose `same file` when cohesion is tight, extraction is local readability reuse, and broader reuse is unlikely.
  - Choose `other file` when a clearly appropriate module already owns this responsibility.
  - Choose `new file` when no existing owner is appropriate and the extracted unit is a stable, reusable concept.
- When recommending `other file` or `new file`, include the concrete target path (or best-fit path proposal) and why that location matches code type, role, runtime, and domain.

# Output

- Present a report with identified problems and corresponding fixes.
- This report should be immediately actionable.
- There should be enough detail to immediately apply the recommended extractions.
- For each recommendation include:
  - Extraction target (what to extract).
  - Destination decision (`same file` | `other file` | `new file`).
  - Location (current path, existing target path, or proposed new path).
  - Placement rationale tied to code type, role, runtime, domain, and repository colocation guidance.