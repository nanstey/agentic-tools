# Review layers: product review

Status: draft for approval. Extends the approved refactor work. For this scope it takes precedence over earlier proposal text that says `/pr review` calls `risk-review` directly. No implementation is approved.

Provisional names follow the user's words: `/security` (code-quality) and `/code-review` (workflow). **`code-review` is an exact reserved name** (`names.claude`, list dated 2026-06-01), so the check verdict is CONFLICT; `security` is exact-clear but a near-match of reserved `security-review` (RISKY). See [discovery](./evidence/review-layers-discovery.md#name-check-check-mode-read-only). Nothing is scaffolded until the user picks names the check marks CLEAR.

## Problem

Review is spread over callers. `/pr review`, `idea-to-pr` and `build` each pick which review work to ask for, and security depth sits inside `risk-review` with no standalone way to investigate or fix a security issue. Scrutiny has no way to contribute a read-only opinion. Users cannot ask "review this change with every quality lens" in one command, and callers can disagree about what "reviewed" covered.

## Desired outcome

Three layers, each with one job:

1. **Quality skills** (`refactor`, `security`, `scrutiny`, `risk-review`) each investigate one perspective. Run directly, `refactor` and `security` fix what is safe; every skill also has a `--report` mode that changes nothing.
2. **`/code-review`** (workflow) runs every registered quality skill, each in its own separate context in report mode, over one shared snapshot. It merges the results into one review packet and never fixes, tests, posts, approves or declares readiness.
3. **`/pr review`** is the PR adapter. It gets the PR source, calls the orchestrator, and owns what happens at the PR: default report, `fix` on your own PR, `comment` on another's, the three-round budget and readiness checks. `idea-to-pr` and `build` call the same orchestrator, not a second review.

## Success signals (observable)

- One `/code-review` run on a local change returns one packet showing, per quality skill, what ran, what it covered, and what failed or was missing. A missing or failed skill makes the verdict `incomplete`, never `clean`.
- The packet separates a quality view and a security view, so the existing quality-then-security PR gates still apply.
- `/security` on a change reports concrete attacker paths and either fixes safe issues or lists them as proposals with the reason they were not auto-fixed.
- `/pr review` and `idea-to-pr` produce no review that skips the orchestrator. A publication step does not rerun a matching review.
- Repository checks prove wiring and wording only. Runtime enforcement is claimed only after it is observed.

## Scope

In: new `security` skill; new `code-review` skill; report modes for `scrutiny` and `risk-review`; PR, idea-to-pr and build handoffs; catalog rows; static and temporary-fixture tests; labeled unexecuted runtime scenarios.

Not in: changing refactor's methods or protected datasets; changing PR gate order or the three-round budget; changing installer, harness or generic workflow behavior; new numeric risk tiers; making Jev authoritative; auto-fixing from `/code-review`; touching earlier proposal, spec or evidence files; publishing, merging or declaring PR #114 ready.

## Settled by the user

Three layers and responsibilities above; `/code-review` is a workflow skill; it uses separate processes in report mode and synthesizes.

## Proposed defaults (not yet approved)

| # | Default | Why |
| --- | --- | --- |
| P1 | `/security` fixes only issues that meet the autofix gate (see architecture); everything else is a proposal with reasons. | Matches refactor's direct-fix default without allowing breaking or risky changes. |
| P2 | Bare `/security` and `/code-review` review the current local change plus needed context. With no change they stop and ask for an explicit scope. | Avoids a silent whole-repository scan or autofix. |
| P3 | `scrutiny` gains a short local `--report` section; all question, pack, grade, reference and license bytes stay unchanged. | The vendored body builds by default. Fallback: scrutiny is reported `unsupported`, packet `incomplete`. |
| P4 | A child that cannot run in its own context is reported blocked. The orchestrator never reasons in its place. | Satisfies "separate processes". Costs completeness in depth-capped runtimes. |
| P5 | `build` changes with `idea-to-pr` because it has the same direct handoff. | Avoids two review paths. |

## Open question

Orchestrator name (CONFLICT) and whether `security` is acceptable as a near-match. Suggested CLEAR-on-exact alternatives, for the user to choose: `code-audit`, `quality-review`, `review-quality` for the orchestrator; `appsec` or `threat-review` for security. A rename changes paths, `name:`, links and one test constant only.

## Handoff to architecture

Settle: process and report-mode contract per child; ownership split to avoid duplicate scans; one packet with two views; scrutiny report mode; autofix gate; caller wiring that keeps gates and budget intact.
