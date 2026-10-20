# Make Pi-Jev Automatic Thinking-Level Selection Accurate and Conservative

- Status: in review
- Summary: Restrict automatic thinking selection to user-authored requests and apply conservative escalation bounds.

## Design
| Stage | Doc | Status |
| --- | --- | --- |
| Discovery | [discovery](./discovery.md) | done |
| Proposal | [proposal](./proposal.md) | done |

## Slices
| # | Slice | Spec | PR | Status |
| --- | --- | --- | --- | --- |
| 1 | Conservative user-text thinking patch, installer, tests, docs | [01-conservative-thinking](./specs/01-conservative-thinking.md) | [#116](https://github.com/nanstey/agentic-tools/pull/116) | in review |

## Decision log
- 2026-10-19 — Triage: one localized but cross-file harness change. Use one PR slice after discovery, planning, and specification.
- 2026-10-19 — Dispatch: use a standard-tier, medium-thinking scout. The task needs evidence across a patch, installer, fixtures, tests, and documentation. It does not show high blast radius or irreversible work.
- 2026-10-19 — Discovery: complete. Evidence: `discovery.md`.
- 2026-10-19 — Decision: the one-level cap above the user-selected baseline applies even to explicit xhigh requests. Explicit intent permits xhigh only when the baseline makes it one step away.
- 2026-10-19 — Planning: complete. Artifact: `proposal.md`. One slice, new patch `pi-jev-conservative-thinking.patch`, hunks kept clear of the prompt-guard lines in `thinking.ts`.
- 2026-10-19 — Specification: complete. Artifact: `specs/01-conservative-thinking.md`.
- 2026-10-20 — Implementation: complete and validated offline plus against the restored installed pi-jev package; PR [#116](https://github.com/nanstey/agentic-tools/pull/116) is in review.
- 2026-10-20 — Acceptance: complete. Two independent Anthropic reviews approved the OpenAI changes. The offline suite verifies 16 installer patch states and both prompt-guard/conservative patch orders.
