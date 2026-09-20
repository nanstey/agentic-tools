# Set Up Jev Ultrafast

- Status: building
- Summary: Integrate browser-use/jev-ultrafast into the repository as a managed, documented agent skill with reproducible installation and end-to-end verification.

## Design
| Stage | Doc | Status |
| --- | --- | --- |
| Proposal | [proposal](./proposal.md) | done |

## Slices
| # | Slice | Spec | PR | Status |
| --- | --- | --- | --- | --- |
| 01 | Add the Jev Ultrafast skill | [01-add-jev-ultrafast-skill](./specs/01-add-jev-ultrafast-skill.md) | [#72](https://github.com/nanstey/agentic-tools/pull/72) | verified |

## Decision log

2026-09-19 — Implementation completed; slice moved to runtime verification.
2026-09-19 — Runtime verification passed: pinned install/reinstall/uninstall, scripted import, loopback API/UI smoke, and idempotent repository linking.
2026-09-19 — Opened pull request [#72](https://github.com/nanstey/agentic-tools/pull/72) after verification passed.
