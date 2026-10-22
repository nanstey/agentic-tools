# Proposal: PR lifecycle review completion + per-invocation review/fix limit

Status: planned. No skill files edited by this plan.

## Goal

Bare `/pr` ends only with (a) an exact-match completed review packet for the final head plus monitor's returned result, or (b) a documented `gates.md` blocked state. It never offers the user a next command. A missing packet starts review immediately. `/pr review <target> fix` runs up to three review/fix rounds **per invocation**.

## Evidence (current files)

| Finding | Location |
| --- | --- |
| Lifecycle step 5 says "Do not advance quality/security … until outcome and independent required CI pass", then step 6 "Reuse … matching … packet. Otherwise invoke `/pr review <PR> fix`". Nothing says the run cannot end after step 5, and no end-state definition exists. | `skills/dev/pr/references/lifecycle.md` L27-28 |
| Step 6: "If `review` is skipped without matching evidence, report missing coverage rather than waive the gate". That is a report-and-stop path with no blocked form. | `lifecycle.md` L28 |
| Step 10 and Output Style report "setup, review and engine outcomes" without requiring a final-head packet or monitor result. | `lifecycle.md` L36, L46 |
| Blocked form: "report the blocker, and give the exact input or command that unblocks it". It is not distinguished from an offer, and no template exists. | `skills/dev/pr/SKILL.md` Non-Interactive step 5; `gates.md` Findings and convergence |
| Subagent-dispatch-unavailable text exists only in review-code: `blocked: needs a coordinator with subagent dispatch`. It is absent from `/pr`. | `skills/workflow/review-code/SKILL.md` L13; `review.md` L38 (requires main-session coordinator) |
| Budget is one shared limit across lifecycle, review, monitor, CI, comments, push, ready, merge. Resume must "recover" state and never "reset by dispatching another action". This contradicts the new requirement. | `gates.md` L42-52; `SKILL.md` L46; `lifecycle.md` L6, L22, L43; `review.md` L5, L20, L41, L70; `monitor.md` L5, L15, L25, L59; `ci.md` L7; `comments.md` L7, L21; `push.md` L20; `ready.md` L25-26; `merge.md` L71 |
| review-code inherits or initializes state. Callers own the limit. | `review-code/SKILL.md` L23-25; `references/caller-contract.md` L7, L11; `risk-review/references/packet.md` L23, L76-78 |
| `build` and `idea-to-pr` pass caller-owned state to `/pr` ("do not reset the budget on publication"). | `workflow/idea-to-pr/SKILL.md` L33, L63, L108-111; `workflow/build/SKILL.md` L34 |

No existing recon result was accessible, so this plan rests on the files above.

## Decisions

1. **Round definition is unchanged.** Round 1 is the initial review. Each changed fix head consumes the next round. A fix head must be reserved a review round, so a call yields at most 3 reviews and 2 fix heads. Rationale: "never create an unreviewable fix head" stays intact.
2. **Budget scope is the invocation, not the session.**
   - An invocation of `/pr review <target> fix` initializes `limit: 3, round: 1` when it starts. It ignores any earlier round counters, including those from earlier `/pr` actions, earlier sessions, and a `build`/`idea-to-pr` prepublication state.
   - It keeps the prior packet and findings for exact-match reuse and deduplication. Resolved or rejected findings are not repeated without new facts.
   - It never resets mid-invocation: pushes, `/pr push`, `/pr description` and `review-code` calls inside the invocation share the one state.
   - No nested or recursive `/pr review`.
3. **Other remediating actions get the same rule.** Each invocation of `monitor`, `ci` or `comments` owns its own `limit: 3, round: 1` for heads it publishes. A nested delegate in the same invocation inherits it (for example monitor → ci/comments/rebase). Monitor `monitor` mode keeps one budget across all its polling cycles.
4. **Lifecycle owns no remediation budget.** Bare `/pr` dispatches `/pr review fix` once and `/pr monitor` once. Each is a separate action invocation with its own limit, so the worst case is bounded at 3 + 3 rounds. See Risks.
5. **Blocked form.** Add one shared blocked-state form to `gates.md`:
   `blocked: <gate> — <exact missing evidence or failed check>; unblock requires: <input/state>`.
   - It states a condition, not an offer: no "run X", "would you like", "next you can" or other next-command phrasing.
   - Use it only for a blocking cause: a failed prerequisite, unresolved verified requests, exhausted rounds, product or risky-scope decision, unfixable or no-progress work, failed reviewer, unavailable access, or unavailable subagent dispatch.
   - Dispatch unavailable uses the fixed text `blocked: needs a coordinator with subagent dispatch` (matches review-code).
   - A missing packet is never a blocker. It is the trigger to start review now.
6. **Lifecycle completion gate (new).** A bare `/pr` or `auto-merge` run may end only in one of:
   - `complete`: the packet for the final authoritative base/head/policy/scope/coverage/evidence snapshot is exact-match and complete (`clean`), **and** monitor returned its result (`clean`, or `pending` under `mode: once`, with the reason) for the same head. `auto-merge` additionally needs a `clean` monitor result before `/pr merge`.
   - `blocked`, in the form above. Setup completion or green CI is never a terminal state.
   - Packet `changes_required` or `incomplete`, or monitor `blocked`, becomes lifecycle `blocked`.

## Intended semantic replacements

### `skills/dev/pr/references/gates.md`
- Retitle "One shared three-round budget" to **"Per-invocation three-round review/fix limit"**.
- Replace L44 ("caller carries … through review, lifecycle, monitor, CI, and comment fixes. Recover this state … never reset it by dispatching another action … If inherited state is missing … blocked") with the following.
  - Decision 2: a `/pr review fix` invocation initializes its own state.
  - Decision 3: other remediating action invocations own their own state.
  - Same-invocation delegates inherit that state.
  - The budget is never carried across invocations or sessions.
  - Never reset within an invocation, never nest.
  - Missing state when a delegate is *inside* an invocation is a defect → `blocked`. Missing state at invocation start is normal (initialize).
- Edit the bullets, keeping the content, so they speak of "the invocation's state":
  - "CI, comment, remote, rebase … inherit the same budget" → "inherit the invoking action's state".
  - "Monitor consumes current review state … " → "Monitor requests only missing coverage; its remediation heads use monitor's own invocation limit".
- Keep L46 (back-to-back rounds, no user confirmation) and L48 (round-3 unresolved → blocked, no extra fix head).
- Add the **Blocked report form** section (Decision 5) plus the "never offer a next command" rule.
- Add the **Lifecycle completion gate** (Decision 6) as the authoritative definition that `lifecycle.md` and `monitor.md` reference.
- "Snapshot and evidence": keep packet exact-match reuse unchanged.

### `skills/dev/pr/SKILL.md`
- L46: replace "one caller-owned three-round review/fix budget including initial review. Carry that state across dispatches; never reset it or start nested review loops." with "a per-invocation three-round review/fix limit owned by the invoked remediating action (initial review is round 1). Delegates inside an invocation share it; separate invocations do not carry it. Never reset mid-invocation or start nested review loops."
- Non-Interactive step 5: reference the `gates.md` blocked form. Add: "A blocked report states the unblocking condition; it never offers or suggests the user run a next command or asks whether to continue."
- Output Behavior: add "Bare `/pr` and `auto-merge` report packet verdict/head and monitor result, or the blocked form".
- Dispatch table row for `/pr review [target] [fix|comment]`: keep. Optional: note `fix` loops ≤3 rounds per invocation.
- `argument-hint` and `description` frontmatter stay unchanged, so no README catalog change.

### `skills/dev/pr/references/lifecycle.md`
- Core Contract L6: replace "pass … single three-round budget through every delegate" with "pass packet and retained findings; each delegate invocation (`/pr review fix`, `/pr monitor`) owns its own three-round limit".
- Add the **Completion gate** paragraph (Decision 6) to Core Contract.
- Step 1: "recover the inherited packet/round state before any remediation commit; do not treat resumed work as a new allowance" → "recover the prior packet/findings only. Round limits are per invocation, not inherited".
- Step 5: "Establish … recover or initialize the caller-owned review state" → "recover the prior packet/findings". Add: "Passing step 5 is not an end state. Continue to step 6 in the same run."
- Step 6 rewrite: exact matching complete packet → reuse. **Otherwise, start `/pr review <PR> fix` now (own PR) or report-only review (other's PR), in this run.** Remove "report missing coverage rather than waive". Replace with "`review` skip never waives; a missing packet starts review." If dispatch is unavailable, use `blocked: needs a coordinator with subagent dispatch`. Keep the automatic round-to-round continuation; the delegate's limit is its own three rounds.
- Step 7: monitor runs only after a matching `clean` packet, and always runs; the lifecycle cannot return before the monitor result. Pass the packet and evidence, not round counters.
- Step 10 and Output Style: report the final packet verdict and head and monitor's result per the completion gate, or the blocked form. Remove the possibility of "report outcomes" without these.
- Safety Rules: replace "Never reset the shared review budget" with "Never reset or nest within an invocation". Add "Never end after setup/green CI without the completion gate" and "Never offer, suggest or ask for a next command (including `/pr review`, `/pr monitor`); start it or report blocked".

### `skills/dev/pr/references/review.md`
- Core Contract L5 and Inputs item 4: "round-state inheritance" → "A `fix` invocation initializes `limit: 3, round: 1`; `report` and `comment` are single-snapshot and consume no budget". Keep prior packet/findings as inputs; drop inherited round state.
- Workflow 3.4: "PR owns subsequent calls and passes returned state unchanged" → "within this invocation".
- Own PR fix steps 3, 4, 6: tie "continue" to "this invocation's three rounds", add "Stop at convergence or blocked at round 3 with the blocked form". Keep the no-extra-head rule.
- Step 7: return the updated packet and this invocation's final state to the caller, with the caller not treating it as carry-over budget.
- Subagent dispatch unavailable → `blocked: needs a coordinator with subagent dispatch`, no offer.
- Safety Rules L70: "budget limits" → "round limit".

### `skills/dev/pr/references/monitor.md`
- Core Contract L5, L15 and Required Inputs item 5: inherit packet/findings from the caller, **not** round counters; remediation within a monitor invocation uses monitor's own `limit: 3` (one budget across all `monitor` cycles).
- Step 5, 8, Safety Rules L59: "shared budget" → "this invocation's budget".
- Cycle step 9 / Output: `clean`, `pending` or `blocked` remain; add that lifecycle reports whichever is returned per the completion gate.
- L5 "requests only missing/invalidated source coverage": a missing complete packet is requested through review-code report coverage, and the lifecycle completion gate still applies.

### Minimal wording edits (shared-budget phrases only)
- `ci.md` L7, `comments.md` L7 and L21, `push.md` L20, `ready.md` L25-26, `merge.md` L71: "shared/inherited three-round budget" → "the invoking action's per-invocation round state". No behavior change otherwise.

### Callers outside `pr/` (contract reconciliation)
- `skills/workflow/review-code/SKILL.md` L23, L25 and `references/caller-contract.md` L7: say the caller owns `limit: 3` for its own loop. For `/pr review fix` invocations, the caller is that invocation. Callers `build` and `idea-to-pr` own their local pre-publication loop separately. When they hand off to `/pr`, they pass the packet, findings and evidence. `/pr review fix` starts its own limit (Decision 2), so the "pass the state to `/pr`" bullet in `caller-contract.md` becomes "pass packet/evidence; `/pr` limits are per `/pr` invocation". Remove "never reset the budget" in caller-contract L7 and replace with "never reset within one invocation". Add the leaf-subagent `blocked` text to the PR dispatch note, since review-code already has it.
- `skills/workflow/idea-to-pr/SKILL.md` L33, L63, L109 and `skills/workflow/build/SKILL.md` L34: replace "do not reset the budget on publication" with "pass the packet/evidence to `/pr`; its review/fix loop has its own per-invocation three-round limit". Keep the L111 autopilot stop conditions.
- `skills/code-quality/risk-review/references/packet.md` L23, L76-78: reword `round_state` as "invocation-scoped, caller-supplied". Keep "never initialize a nested loop".

## Affected files (all edits are doc-only)

- `skills/dev/pr/SKILL.md`
- `skills/dev/pr/references/{lifecycle,review,gates,monitor}.md`
- `skills/dev/pr/references/{ci,comments,push,ready,merge}.md` (one-line wording)
- `skills/workflow/review-code/SKILL.md`, `skills/workflow/review-code/references/caller-contract.md`
- `skills/workflow/{idea-to-pr,build}/SKILL.md`
- `skills/code-quality/risk-review/references/packet.md`
- `README.md` catalog: no change (no add/rename/remove, frontmatter `description` unchanged). Confirm.

## Validation

1. `grep -rniE "recover this state|never reset it by dispatching|one caller-owned three-round|shared three-round|single three-round|same budget|inherit.*round state|do not reset the budget on publication" skills/` finds no stale cross-invocation wording. Any hit must be reworded or justified.
2. `grep -rniE "would you like|want me to|you can (now )?run|next (step|command)|offer" skills/dev/pr/references/{lifecycle,review,monitor,gates}.md skills/dev/pr/SKILL.md` finds no next-command offer phrasing. Existing "offer a narrow fix/split/revert" in `gates.md` L40 and `merge.md`/`stack` text concern PR content, not a user next command. Reword L40 to "Propose" to avoid confusion.
3. Read-through traces against the edited docs:
   - (a) bare `/pr`, green CI, no packet → review starts in the same run, then monitor, then the completion gate. No end state before it.
   - (b) dispatch unavailable → exact `blocked: needs a coordinator with subagent dispatch`; no offer text.
   - (c) `/pr review X fix` run twice in one session → each run starts at round 1; each stops at round 3 `blocked` with the blocked form.
   - (d) lifecycle → review (3 rounds) → monitor remediation head → monitor's own round 1, bounded.
   - (e) `monitor` mode across several `pending` cycles keeps one budget.
4. Check for internal consistency: every `gates.md` link anchor still resolves. Check that "three-round" occurrences refer to the same scoping. `idea-to-pr`/`build`/`review-code` text agrees with `gates.md`.
5. Run `bash install/tests/install.test.sh` if present (offline regression; docs-only change should be a no-op). Confirm frontmatter `name:` matches the directory for each edited skill, and that `README.md` row descriptions are unchanged.
6. Verify `git diff --stat` touches only the files listed above.

## Risks

- **Budget semantics decision.** Per-invocation limits let lifecycle run review (3) and monitor (3). Loops are bounded, but total fix heads can exceed three across a bare `/pr`. Alternative: monitor inherits the lifecycle's remaining rounds (stricter, but contradicts "not across separate `/pr` action invocations" if monitor counts as one). The plan chose the independent reading. The parent should confirm.
- **"Three rounds" meaning.** The plan keeps "3 reviews, ≤2 fix heads". If the user means 3 *fix* rounds plus a final review, `gates.md` round arithmetic changes (reserve round ≤ 4). Confirm if unsure.
- **Spin across invocations.** A fresh budget per invocation means a user or autopilot re-invoking `/pr review fix` repeatedly on a no-progress finding could loop forever. Keep the no-progress / unchanged-feedback stop (`monitor.md` L57, `gates.md` L48) active, using retained findings from the prior packet as the evidence.
- **Blocked vs offer wording.** The blocked form states the unblock *condition*. Reviewers must check the wording never reads as a prompt or suggestion.
- **Wide wording edits.** About 14 files carry the "shared budget" wording. Missing one leaves a contradiction. Validation step 1 guards this.
- **Commit granularity** (`AGENTS.md`): files are lock-step coupled (shared contract change), so one commit for the slice is justified. State that in the commit body.

## Slice recommendation

One slice, **`slice-1-per-invocation-review-completion`** (spec `.plans/pr-lifecycle-review-completion/slice-1-per-invocation-review-completion.md`), because the budget scope, blocked form and completion gate cross-reference each other and cannot ship partially. Vertical order inside the slice:
1. `gates.md` contract: per-invocation limit, blocked form, completion gate.
2. `lifecycle.md` + `SKILL.md`: end-state rules and no-offer rule.
3. `review.md` + `monitor.md`: invocation-owned state.
4. One-line sweeps (`ci`, `comments`, `push`, `ready`, `merge`).
5. Caller contract: `review-code`, `caller-contract`, `idea-to-pr`, `build`, `packet.md`.
6. Run the validation greps and traces.

Acceptance: validation 1-6 pass and a reader following only `lifecycle.md` + `gates.md` cannot terminate a bare `/pr` except via the completion gate or the blocked form.
