# Extract

Prepare reusable, cohesive extractions under the caller's [execution context](../REFERENCE.md#execution-context), which controls fix/report mode, authority, scope, validation, and source protection. Follow `CLAUDE.md` / `AGENTS.md` and apply [finding reuse](../REFERENCE.md#finding-reuse) before checking.
Cover the resolved scope; a bare exhaustive review never falls back to sampling or skips valid issues because there are many.

## Workflow

1. Honor the caller's resolved scope, exclusions, source identity, and permissions. If unresolved, use repository guidance and maintained source/tests/config, not an implicit branch diff.
2. Run the [DRY procedure](#dry-procedure) to find duplicated code.
3. Run the [SRP procedure](#srp-procedure) to find mixed responsibilities and propose cohesive boundaries.
4. Create one list of violations with stable finding IDs. Reuse matching findings from focused or principles reviews. Count one underlying issue once, even when both procedures find it. Keep independent issues separate.
5. For each violation, propose a specific extraction and one placement decision: `same file`, `other file`, or `new file`.

## Placement

Candidates include UI components, hooks, helpers, utilities, functions, and modules. Decide the destination by weighing:

- Code type: UI component, hook, pure domain logic, adapter/integration, persistence, utility, framework glue.
- Role: what responsibility the extracted unit owns.
- Runtime: client, server, shared, build/test/tooling.
- Domain: business area, feature boundary, bounded context.
- Related code and ownership: what changes together.
- Repository guidance (`AGENTS.md`) and local colocation patterns.

Rules:

- `same file`: cohesion is tight, the extraction is local readability, and broader reuse is unlikely.
- `other file`: a clearly appropriate module already owns the responsibility.
- `new file`: no existing owner fits and the unit is a stable, reusable concept.
- For `other file` or `new file`, give the concrete target path (or best-fit proposal) and why it matches code type, role, runtime, and domain.

## DRY procedure

Find meaningful duplication and prepare the smallest useful consolidation. Prefer true shared concepts. Do not couple independent logic because it looks similar.

1. Gather candidates across the full resolved scope; use a diff only when that is the explicit scope. Inspect units not already covered.
2. Classify each as true duplication, near-duplication, or incidental similarity.
3. Propose the smallest consolidation: reuse a helper, extract a helper, or create a small focused file.
4. Score issue severity and improvement value (maintenance, testability, risk payoff). Group into High, Medium, Low.

Safety:

- In report mode, creating or moving source files is forbidden. A new file is only a proposal.
- False coupling is a regression. When in doubt, leave code separate and say why.
- No sprawling catch-all `utils`/`helpers` file. New files are narrow and named for one concept.
- Do not chase tiny repetitions over larger consolidations, but keep all material findings and mark nits Low.
- Rule of three is a guide: two copies can justify extraction when they must change together, and three near-copies can be fine when independent.

## SRP procedure

Find mixed responsibilities and prepare cohesive boundaries. Prefer clear ownership over cosmetic splitting.

1. Confirm scope, exclusions, and ownership context.
2. Examine units (file, module, class, function). Use frequent edits, broad APIs, and mixed concerns as evidence, not as a coverage cutoff.
3. Classify responsibilities: domain rules, orchestration, transport, persistence, formatting, framework glue.
4. Evaluate reasons to change using stakeholder ownership and change history.
5. Propose the smallest cohesive boundary change: split a unit, extract an adapter, isolate orchestration, or tighten an API.
6. Score severity and improvement value. Group into High, Medium, Low.

Safety:

- Source edits and follow-on implementation are forbidden in report mode.
- Do not fragment cohesive logic into tiny pieces. Do not extract when responsibilities are tightly coupled and change for the same business reason.
- Layering is not SRP: a small unit can still serve unrelated stakeholders.
- Prefer stable seams (domain vs adapters, policy vs IO) over speculative abstractions.
- Keep all material violations. Mark lower-impact items Low.

## Output

After the root summary, report scope/exclusions, then findings grouped `High`, `Medium`, `Low`. Make the report immediately actionable. For each finding give:

- `file:line` evidence, and for DRY the duplication type, for SRP the mixed responsibilities with ownership/change-pressure rationale.
- Issue severity and improvement value.
- Extraction target (what to extract).
- Destination decision (`same file` | `other file` | `new file`).
- Location (current path, existing target path, or proposed new path).
- Placement rationale tied to code type, role, runtime, domain, and repository colocation guidance.

Call out notable non-findings left separate and the highest-payoff next step.
