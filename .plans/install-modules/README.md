# Modular installer and explicit tool installation

- Status: implemented and locally tested; draft publication authorized; independent review pending after Anthropic quota failure
- Summary: Extract cohesive installer modules under install/ and add explicit root CLI actions for tools.
- Mode: idea-to-pr autopilot
- Base: main at 37200468608b0b4bea916567d4985ee5253cd0bb
- Branch: install-modules (existing isolated worktree)

## Design
| Stage | Doc | Status |
| --- | --- | --- |
| Discovery and extraction | [discovery](./discovery.md) | done |
| Proposal | [proposal](./proposal.md) | updated for accepted layout and CLI changes |
| Root CLI extension | [cli-plan](./cli-plan.md) | implemented and locally tested |
| Separate plan review | [plan-review](./plan-review.md) | pass, cross-provider verification blocked by quota |

## Slices
| # | Slice | Spec | PR | Status |
| --- | --- | --- | --- | --- |
| 1 | Unified installer and explicit tool CLI | [01-install-modules](./specs/01-install-modules.md) | draft publication authorized | independent review pending |

## Assignments
- Discovery: scout, write discovery.md and proposal.md. Use refactor and extract with DRY/SRP evidence.
- Baseline: worker wrote [baseline](./baseline.md). Both package tests passed. All five patches report patched then ok. Fixture rerun manifests match.
- Implementation: worker owns source changes and implementation checkboxes. Write implementation.md. Parent owns this index.
- Layout revision: resumed worker moves all runtime installer code into install/. Only main.sh is a direct file.
- CLI planning: planner wrote cli-plan.md. Worker implemented it after layout completion.
- Local verification: parent repeated all nine offline regression groups, all four patch assertions, root help and both diff checks successfully.
- Exact baseline: 27/33 records match. Requested root-directed advice, missing-tool suggestions and tool-help changes account for six stdout differences. Statuses, stderr and manifests match.
- Evidence and limits: [implementation](./implementation.md). Reviewer-owned acceptance remains pending; no cross-provider acceptance is claimed.
- Commit/PR setup: authorized as one atomic commit and a draft against main. Runtime moves, source-coupled tests and five skill/reference updates share the public root installer path/CLI contract.
- Follow-up: parent owns cross-provider review/fixes and PR monitoring. Draft publication does not establish reviewer acceptance.
- Plan review: reviewer wrote plan-review.md. Both production and review used OpenAI after Anthropic quota failure. Do not claim cross-provider verification.

## Decision log
- Use one behavior-preserving slice. Use the existing worktree and branch.
- Use .plans/ because the repository already contains this planning directory.
- User replaces src/ layout with root install/{main.sh,modules/,tools/,tests/}. Root install.sh remains the entrypoint.
- User authorizes explicit tool installation from root CLI. Default still installs repository artifacts and reports tools.
- Latest CLI uses --tools, --tool TOOL and side-effect-free --help. Obsolete flag names fail before bootstrap.
- User moves the guide to install/TOOL_INSTALLATION.md. This is the documentation exception to the root-directory file rule.
- Installation instructions use the root installer. Missing non-skipped tools produce one shell-safe root --tools command without failing default installation.
- Keep real HOME and installed packages unchanged. Verify only in temporary fixtures.
