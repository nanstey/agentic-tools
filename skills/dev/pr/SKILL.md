---
name: pr
description: Acts on one pull request from its branch or worktree: creates, publishes, describes, rebases or restacks, fixes and reruns CI, handles review threads, reviews and publishes reviews, marks ready, merges, and manages stacks. Use when working on a specific PR or when asked to run a `/pr` command.
argument-hint: "[info|create|push|description|screenshots|rebase|restack|split|stack|ci|review|comments|verification|ready|merge|automerge] [PR-URL-or-number] [fix|comment|report] [force]"
user-invocable: true
disable-model-invocation: false
---
# PR
Route each action to its reference. Bare `/pr` runs the lifecycle; `/pr automerge [target]` also merges. Grammar: `/pr [action] [target] [mode] [force]`. Use one action, one target URL or number, an optional supported mode, and optional `force` where accepted.

### Actions

Each action runs one lifecycle phase (see `00-lifecycle.md`), or stands alone where the phase is `—`.

| Phase | Action | Reference | Purpose |
| --- | --- | --- | --- |
| 0–9 | bare `/pr` | `00-lifecycle.md` | Run the lifecycle |
| 0–10 | `automerge` | `00-lifecycle.md`, `10-merge.md` | Run the lifecycle, then merge |
| — | `info` | `info.md` | Resolve PR facts |
| 1 Create | `create` | `01-create.md` | Open a PR |
| 2 Publish | `push` | `02-push.md` | Commit and publish |
| 3 Describe | `description` | `03-description.md` | Update PR body |
| 3 Describe | `screenshots` | `03-screenshots.md` | Add visual evidence |
| 4 Sync | `rebase` | `04-rebase.md` | Sync a branch |
| 4 Sync | `restack` | `04-restack.md` | Sync a dependent stack |
| 4 Sync | `stack` | `04-stack.md` | Manage a native stack |
| — | `split` | `split.md` | Split a PR |
| 5 CI | `ci` | `05-ci.md` | Fix or rerun checks |
| 6 Review | `review` | `06-review.md` | Review and publish findings |
| 7 Threads | `comments` | `07-comments.md` | Address review threads |
| 8 Verify | `verification` | `08-verification.md` | Verify PR claims |
| 9 Ready | `ready` | `09-ready.md` | Mark ready |
| 10 Merge | `merge` | `10-merge.md` | Merge |

### Shared rules and state

These references are not actions; actions cite them for shared rules.

| Reference | Purpose |
| --- | --- |
| `00-lifecycle.md` | Phase order, entry tests, transitions, and completion states |
| `_policy.md` | Mutation guards, force, round limit, review depth, required checks, blocked form, and disclosure |
| `_state.md` | Stored run state, packet identity, and invalidation |

Reject an unknown action, more than one action word, an unsupported mode, extra mode words, or legacy `--` action flags. The only lifecycle skip word is `review`: it reuses an exact-matching packet and skips redundant self-review, never missing coverage. A target omitted by the invocation resolves from the current branch. Follow `CLAUDE.md`/`AGENTS.md` on conflict. The default tool is `gh`.

## Authorization
Delegated phases authorize against the lifecycle row, or the automerge row for an automerge run.

| Action | Mode | Own | Other | Fork |
| --- | --- | --- | --- | --- |
| lifecycle | none | create-pr, convert-draft, convert-ready, rerun-check, rerequest, attach, edit-body, push, resolve-threads, post-comment, react | react | react |
| lifecycle | fix | — | — | — |
| lifecycle | comment | — | — | — |
| lifecycle | report | — | — | — |
| lifecycle | force | create-pr, convert-draft, convert-ready, rerun-check, rerequest, attach, edit-body, push, resolve-threads, post-comment, react | react | react |
| info | none | — | — | — |
| info | fix | — | — | — |
| info | comment | — | — | — |
| info | report | — | — | — |
| info | force | — | — | — |
| create | none | create-pr, edit-body | — | — |
| create | fix | — | — | — |
| create | comment | — | — | — |
| create | report | — | — | — |
| create | force | — | — | — |
| push | none | push, edit-body, convert-draft | — | — |
| push | fix | — | — | — |
| push | comment | — | — | — |
| push | report | — | — | — |
| push | force | — | — | — |
| description | none | edit-body, convert-draft | — | — |
| description | fix | — | — | — |
| description | comment | — | — | — |
| description | report | — | — | — |
| description | force | — | — | — |
| screenshots | none | edit-body, attach, convert-draft | — | — |
| screenshots | fix | — | — | — |
| screenshots | comment | — | — | — |
| screenshots | report | — | — | — |
| screenshots | force | — | — | — |
| rebase | none | push, edit-body, convert-draft | — | — |
| rebase | fix | — | — | — |
| rebase | comment | — | — | — |
| rebase | report | — | — | — |
| rebase | force | — | — | — |
| restack | none | push, edit-body, convert-draft | — | — |
| restack | fix | — | — | — |
| restack | comment | — | — | — |
| restack | report | — | — | — |
| restack | force | — | — | — |
| split | none | push, edit-body, create-pr, convert-draft | — | — |
| split | fix | — | — | — |
| split | comment | — | — | — |
| split | report | — | — | — |
| split | force | — | — | — |
| stack | none | push, edit-body, create-pr, stack-link, convert-draft | — | — |
| stack | fix | — | — | — |
| stack | comment | — | — | — |
| stack | report | — | — | — |
| stack | force | — | — | — |
| ci | none | push, edit-body, rerun-check, convert-draft | — | — |
| ci | fix | — | — | — |
| ci | comment | — | — | — |
| ci | report | — | — | — |
| ci | force | — | — | — |
| review | none | — | post-review, react | post-review, react |
| review | fix | push, edit-body, convert-draft | — | — |
| review | comment | — | post-review, react | post-review, react |
| review | report | — | — | — |
| review | force | — | — | — |
| comments | none | push, post-comment, resolve-threads, rerequest, edit-body, convert-draft | — | — |
| comments | fix | — | — | — |
| comments | comment | — | — | — |
| comments | report | — | — | — |
| comments | force | — | — | — |
| verification | none | — | — | — |
| verification | fix | edit-body, push, convert-draft | — | — |
| verification | comment | — | post-comment | post-comment |
| verification | report | — | — | — |
| verification | force | — | — | — |
| ready | none | convert-ready | — | — |
| ready | fix | — | — | — |
| ready | comment | — | — | — |
| ready | report | — | — | — |
| ready | force | convert-ready | — | — |
| merge | none | merge | — | — |
| merge | fix | — | — | — |
| merge | comment | — | — | — |
| merge | report | — | — | — |
| merge | force | merge | — | — |
| automerge | none | create-pr, convert-draft, convert-ready, rerun-check, rerequest, attach, edit-body, push, resolve-threads, post-comment, react, merge | — | — |
| automerge | fix | — | — | — |
| automerge | comment | — | — | — |
| automerge | report | — | — | — |
| automerge | force | create-pr, convert-draft, convert-ready, rerun-check, rerequest, attach, edit-body, push, resolve-threads, post-comment, react, merge | — | — |

## Decision ladder
Never ask the user a question or wait for approval. Choose explicit input, repository policy, documented default, then judgment:

1. Explicit invocation or user input.
2. Repository instructions, PR templates, and `CONTRIBUTING*` guidance.
3. The dispatched reference's documented default.
4. Reversible judgment that moves the PR toward merge. Record the choice.
5. Stop as `blocked` only when no workaround exists or the action is destructive or hard to reverse and the invocation did not name it.

An unmet gate is work to do. Run its phase instead of reporting and waiting. Destructive extras, including branch pruning, stack dissolution, and operation aborts, run only when named by the invocation. References that say stop mean report `blocked`, never ask. Follow the force and gate policy in `_policy.md`.

## Scripts and output
`pr` means `node <skill-dir>/scripts/pr.ts`. Run `pr <subcommand> [args]`. Begin each top-level invocation with `run start --pr <PR-URL-or-number> --action <action> [--mode <mode>] [--force]`. It returns a run id; pass `--run <id>` to the phases and delegates. Do not start a nested run. `run get`, `run update`, and `run end` inspect or update that run.

Other subcommands include `snapshot [target]`, `next [target] [--run <id>] [--judged <test>=pass|fail]` (without a PR, selects phase 1 Create), `authorize <action> [mode]`, `packet put|get`, `react add|remove <target> --run <id>`, `review post`, `thread reply <target> --thread <id> --body-file <file> --run <id>`, `thread resolve <target> --thread <id> --run <id>`, `checks inventory|rerun-cancelled|wait`, `stack probe --repo <owner/repo>|link|collapse-check`, `guard`, `draft`, `push`, `threads`, `rerequest`, `body`, `attach`, `merge [target] --run <id> --required <check...> [--no-required-checks --policy-proof <text>] [--force]`, `cleanup`, `marker`, `disclosure`, and `docs-only <base> <head> --run <id> --pr <target> --skill-dir <path>`. See the relevant reference for exact arguments.

Scripts return one JSON object, or a nonzero error with the blocked form. Mutations require the run id. Report the action, target, phases run, run id, outcome, remaining work, and overrides. Bare `/pr` and `automerge` also report the review verdict and head, plus required-CI state.
