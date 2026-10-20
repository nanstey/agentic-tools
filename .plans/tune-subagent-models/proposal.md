# Conservative subagent model and thinking policy

## Purpose

The current Pi policy can turn uncertain work into expensive work. It raises Jev results on low confidence, permits unrestricted `xhigh`, and uses fixed profile models and premium self-improvement defaults.

The target policy starts ordinary work at a standard tier and medium thinking. It uses stronger models or `xhigh` only after explicit evidence. It preserves the main-agent model policy, provider fallback, and cross-family verification.

## Evidence

### Recent child-session sample

The redacted log analysis covers 39 usable child sessions from 41 launches. The window is 2026-10-13 01:23 UTC through 2026-10-20 01:23 UTC. Counts are distinct child sessions with a non-error request for the recorded combination. A session can appear in more than one row after a model or thinking change.

| Role | Recorded model | Thinking | Count |
| --- | --- | --- | ---: |
| planner | `openai-codex/gpt-6.1-sol` | medium | 1 |
| planner | `openai-codex/gpt-6.1-sol` | xhigh | 1 |
| reviewer | `anthropic/claude-opus-5-5` | high | 3 |
| reviewer | `anthropic/claude-opus-5-5` | medium | 1 |
| reviewer | `anthropic/claude-sonnet-5-5` | high | 1 |
| reviewer | `openai-codex/gpt-5.6-terra` | high | 1 |
| reviewer | `openai-codex/gpt-5.6-terra` | medium | 1 |
| reviewer | `openai-codex/gpt-6.1-sol` | high | 2 |
| reviewer | `openai-codex/gpt-6.1-sol` | medium | 5 |
| reviewer | `openai-codex/gpt-6.1-sol` | xhigh | 1 |
| scout | `anthropic/claude-haiku-5-5` | low | 4 |
| scout | `anthropic/claude-sonnet-5-5` | medium | 1 |
| scout | `openai-codex/gpt-6.1-sol` | medium | 2 |
| unspecified | `anthropic/claude-sonnet-5-5` | medium | 1 |
| worker | `openai-codex/gpt-5.6-terra` | medium | 5 |
| worker | `openai-codex/gpt-6-luna` | minimal | 1 |
| worker | `openai-codex/gpt-6.1-sol` | high | 6 |
| worker | `openai-codex/gpt-6.1-sol` | medium | 4 |
| worker | `openai-codex/gpt-6.1-sol` | xhigh | 2 |

The launch records explain the observed expensive levels:

- Three launches explicitly selected `gpt-6.1-sol:xhigh`.
- Nine launches explicitly selected `gpt-6.1-sol:high`.
- One `claude-opus-5-5:xhigh` launch failed, then used Sol at medium.
- Ten launches omitted a model and therefore used a profile or harness default.
- Anthropic errors preceded successful Sol requests in six observed sessions.

The sample does not measure tokens, task quality, or all headless self-improvement runs. It does prove that explicit dispatch, fixed profile models, and provider fallback all produce top-tier model use.

### Root causes

| Cause | Evidence | Effect |
| --- | --- | --- |
| Low-confidence upward rule | `harness/pi/APPEND_SYSTEM.md:97-110` raises either Jev choice when confidence is below 0.6 and also says to round up when unsure. | Ambiguity increases tier and thinking without task evidence. |
| Unbounded thinking output | The same section accepts `xhigh` directly. | A classifier can choose `xhigh` for ordinary wording. |
| Fixed profile models when the parent omits a model | Role profiles set a model in frontmatter. | Omitted selections inherit a role-specific model instead of the task selection. |
| Verification bypasses normal selection | `harness/pi/APPEND_SYSTEM.md:154-158` pins Sol for Anthropic output and does not select a thinking suffix. | Review can ignore task scale and the dispatch-suffix rule. |
| Global fallback starts at Sol | `harness/pi/extensions/pi-fallback.json:1-7` lists Sol before Sonnet. | A provider error can move a child to Sol. |
| Self-improvement policy starts high | `harness/pi/self-improve.json:4-10` sets Sol/high and cross-family Sol/high or Opus/high reviewers. | Unattended maintenance starts at expensive settings. |
| Automatic Jev thinking applies outside named subagents | `harness/pi/pi-jev-auto.conf:4` enables it. The installed patch only excludes `PI_SUBAGENT_NAME`. `pi-improve` sets `PI_SELF_IMPROVE_CHILD`. | Reflection and self-improvement sessions can override their intended thinking. |
| OMP delegates every multi-step task | `harness/omp/APPEND_SYSTEM.md:16-20` says every multi-step task should delegate. | It creates extra contexts even when one bounded session is enough. |

The installed Pi code confirms that a profile without `model` uses Pi's configured model and thinking defaults. Every dispatch must instead pass an explicit `model:thinking` suffix. The plan adds no profile `thinking:` frontmatter.

## User story and scenarios

As a harness user, I want ordinary delegated work to use economical models and bounded thinking. I still need strong models when task evidence shows they are necessary.

1. **Ordinary work**
   - Given a clear bounded task, when Jev reports low confidence, then the parent applies the evidence bounds and keeps the standard model and medium thinking.
   - Given a role dispatch, when the parent selects a task tier, then it passes the selected `model:thinking` suffix from the routing table.
2. **Exceptional work**
   - Given an irreversible or security-critical task, or an explicit user request, when the parent documents the reason, then it can select premium or `xhigh`.
   - Given a weak or failed result, when the parent has evidence, then it can retry once at a stronger level. It does not escalate only because the first classifier result was uncertain.
3. **Verification and fallback**
   - Given produced work, when a reviewer starts, then the parent selects an independent model family through the routing table and passes an explicit thinking suffix.
   - Given a provider failure, when automatic fallback runs, then it uses Terra, then Sonnet. It does not automatically select Sol. The parent still verifies the actual producer and reviewer families.
4. **Self-improvement**
   - Given an unattended self-improvement worker, when it starts without overrides, then it uses Terra at medium thinking and a Sonnet or Terra independent reviewer at medium thinking.
   - Given a self-improvement worker or reflection, when `PI_JEV_THINKING=1` is enabled, then automatic thinking does not override its selected or inherited level.

## Proposed changes

### 1. Make Pi routing economical by default

Edit `harness/pi/APPEND_SYSTEM.md`.

Replace automatic upward escalation with this policy:

```text
Use `quick` only for one bounded, mechanical task. Otherwise start at `standard`.
Use `high` only when the task has demonstrated cross-boundary complexity or a high blast radius.
Use `premium` only after an explicit user request, or for an indivisible irreversible or security-critical task. Record the reason.

Use low thinking for quick tasks, medium for standard tasks, and high for high tasks.
Before dispatch, cap every classifier result at high and high thinking unless the premium or `xhigh` exception has direct evidence. Do not use `xhigh` unless the user explicitly requests it, or an indivisible irreversible or security-critical task requires it. Record the reason.

If confidence is below 0.6, retain the returned tier and thinking level after applying those evidence bounds. Increase one level only when direct task evidence shows high blast radius. Never increase above high solely because confidence is low or Jev is unavailable.
If Jev fails, choose standard and medium unless direct task evidence meets the high rule. Use premium only when its exception rule applies.
Start with the least costly valid selection. Retry once at a stronger selection only after a failed, incomplete, or demonstrably low-quality result.
```

Keep the main-agent policy unchanged. Keep producer fallback, reviewer-family constraints, and actual-model log checks.

Change the routing table only where a high row currently selects a premium model:

| Role | Current high primary | Proposed high primary | Premium primary |
| --- | --- | --- | --- |
| planner | Fable | Sonnet | Fable |
| worker | Sol | Terra | Sol |
| reviewer of OpenAI work | Opus | Sonnet | Opus |
| reviewer of Anthropic work | Sol | Terra | Sol |

Keep existing quick and standard primary models. Replace the complete high reviewer cells with `sonnet-5-5 → fable-5-1` for OpenAI work and `gpt-5.6-terra → gpt-6-luna` for Anthropic work. Keep the fallback on the independent reviewer family and require it to differ from the primary. A provider-failure fallback need not be stronger than its primary.

Replace the verification model pin with a rule that selects the appropriate reviewer row at the same tier and passes `model:thinking`. Replace the generic retry text with a producer exception and a reviewer exception. A reviewer never changes to the producer family.

### 2. Remove role-profile model and thinking defaults

Edit the profile frontmatter only:

| File | Change |
| --- | --- |
| `agents/scout.md` | Remove `model`. |
| `agents/researcher.md` | Remove `model`. |
| `agents/planner.md` | Remove `model`. |
| `agents/worker.md` | Remove `model`. |
| `agents/reviewer.md` | Remove `model`. |

Do not add `thinking:` frontmatter. Role profiles define role and tool permissions, not model or thinking. The parent selects a task tier from the routing table and passes an explicit `model:thinking` suffix. Omission is a dispatch-policy failure that uses Pi's configured defaults, not a task selection.

### 3. Lower automatic fallback and self-improvement defaults

Edit `harness/pi/extensions/pi-fallback.json` so the fallback order is Terra, then Sonnet. This retains provider fallback while avoiding Sol as the first global fallback.

Edit `harness/pi/self-improve.json`:

```json
{
  "workerModel": "openai-codex/gpt-5.6-terra",
  "workerThinking": "medium",
  "reviewerModelByWorkerFamily": {
    "anthropic": "openai-codex/gpt-5.6-terra:medium",
    "openai": "anthropic/claude-sonnet-5-5:medium"
  }
}
```

Do not change the empty reflection model and thinking defaults. They inherit Pi's existing Sonnet/medium defaults after automatic thinking is excluded.

### 4. Prevent Jev from changing self-improvement thinking

Add a new patch file, not an edit to the already-installed `pi-jev.patch`. Do not modify the line installed by the existing patch. A later patch would make its reverse dry-run fail on the next installer run.

Instead, patch the independent router construction line from:

```ts
const autoThinking = new AutoThinkingRouter(pi, Boolean(pi.getFlag("jev-thinking")));
```

to:

```ts
const autoThinking = new AutoThinkingRouter(
  pi,
  Boolean(pi.getFlag("jev-thinking")) && !process.env.PI_SELF_IMPROVE_CHILD
);
```

This new patch applies after `pi-jev.patch` and `pi-jev-prompt-guard.patch` without changing either patch's target hunk. Add an idempotent `install.sh` hook for it. Keep `PI_JEV_THINKING=1` in `pi-jev-auto.conf`, so normal main sessions retain their existing automatic-thinking behavior.

### 5. Reduce unnecessary OMP worker use

Edit `harness/omp/APPEND_SYSTEM.md` to require a material benefit before delegation. A bounded cohesive multi-step task may stay inline. For a delegated task, use the least costly configured role and escalate only after evidence of a failed or weak result, an explicit request, or an indivisible high-risk task.

Do not introduce Pi model names into OMP. Do not alter profile-local OMP `modelRoles`.

Correct the unconditional depth-cap claim. State that the configured `task.maxRecursionDepth` enforces the cap. The parent must otherwise prevent nested delegation.

### 6. Documentation and tests

Replace all per-agent model values in the Agents table with a dynamic-selection label and update the routing prose in `README.md`.

Update `harness/pi/README.md` for the changed fallback order, self-improvement defaults, conservative routing, and the new Jev patch table row. Update the patch description to state that named subagents and self-improvement sessions keep their intended thinking.

Update `harness/omp/README.md` table text because the advertised delegation behavior changes.

Extend the offline patch regression test for sequential application of the existing Jev patch, the prompt-guard patch, and the new self-improvement-thinking patch. It must prove the first installer run reports `patched` and the second reports `ok` for pristine, already-existing-patch, and fully-patched fixtures.

## Expected effect and risks

| Change | Expected effect | Risk and control |
| --- | --- | --- |
| Bound tier and thinking escalation | Low confidence no longer causes automatic premium or `xhigh`. | A difficult task can start too cheaply. Escalate once after recorded weak-result evidence. |
| Lower high table rows and remove profile defaults | High-tier dispatches use Sonnet or Terra before Fable, Sol, or Opus. Every role dispatch selects its model and thinking from the table. | Some broad reviews or implementations may need stronger reasoning. Keep premium as an explicit exception. |
| Route verification through the table | Removes the Sol verification bypass and preserves family independence. | Parent must classify review scope. The final actual-model check remains mandatory. |
| Lower global fallback | Provider failures use Terra rather than Sol. | Main-session provider fallback also becomes less capable. This occurs only on provider failure and may be manually retried at a stronger level. |
| Lower self-improvement defaults | Unattended maintenance starts at Terra/Sonnet medium. | A maintenance change may need a stronger worker. The independent review gate and explicit CLI/environment overrides remain available. |
| New Jev patch | Self-improvement thinking stays at selected or inherited medium. | The patch targets a separate router-construction line. Fixture tests prove sequential application and idempotency for partial patch states. |
| OMP benefit-based delegation | Avoids needless worker contexts. | Less parallelism for low-value tasks. Independent and isolated work still delegates. |

## Architecture

The parent remains the sole model selector. It classifies each delegated assignment, applies a policy bound, then passes an explicit `model:thinking` value. All role profiles omit model and thinking. A missing suffix is a dispatch-policy failure and uses Pi's configured defaults, not a task selection.

Provider fallback remains separate from task routing. It can still alter the actual model, so the existing successful-assistant-message family check remains the enforcement point for independent review.

The new Pi patch narrows automatic reasoning changes only for child processes that use `PI_SELF_IMPROVE_CHILD`. It does not change the main-agent model policy or normal main-session Jev behavior.

## Affected areas

| Area | Files |
| --- | --- |
| Pi routing policy | `harness/pi/APPEND_SYSTEM.md`, `harness/pi/extensions/pi-fallback.json` |
| Agent role profiles | `agents/scout.md`, `agents/researcher.md`, `agents/planner.md`, `agents/worker.md`, `agents/reviewer.md` |
| Self-improvement defaults | `harness/pi/self-improve.json` |
| Jev installation patch | new `harness/pi/patches/pi-jev-self-improve-thinking.patch`, `install.sh`, `harness/pi/tests/package-patches.test.sh` |
| Pi documentation | `README.md`, `harness/pi/README.md` |
| OMP delegation policy | `harness/omp/APPEND_SYSTEM.md`, `harness/omp/README.md` |

No changes are proposed for `harness/pi/settings.json`, `harness/pi/pi-jev-auto.conf`, `harness/pi/bin/pi-improve`, `harness/pi/prompts/`, `skills/workflow/idea-to-pr/SKILL.md`, `skills/workflow/flow-design/SKILL.md`, or `skills/env/handoff/SKILL.md`.

## QA

1. Run `git diff --check`.
2. Validate edited JSON with `jq empty`.
3. Run `bash -n install.sh`.
4. Run `node --check harness/pi/bin/pi-improve`.
5. Run `bash harness/pi/tests/package-patches.test.sh` and `bash harness/pi/tests/pi-improve.test.sh`.
6. Exercise pristine, existing-patch-only, prompt-guard-only, and fully-patched fixtures. Run the sandboxed installer twice for each supported state. Confirm each missing patch reports `patched`, then all patches report `ok`.
7. Check routing examples in `APPEND_SYSTEM.md`:
   - clear task with low confidence remains standard/medium;
   - a classifier result of premium or `xhigh` without exception evidence is capped at high/high;
   - high blast-radius task can reach high/high;
   - premium and `xhigh` require an exception reason;
   - OpenAI and Anthropic producer reviews use different families;
   - complete high reviewer cells have distinct, same-family fallbacks;
   - a reviewer never uses the producer family after a retry.
8. Confirm every role profile under `agents/` omits `model:` and `thinking:`. Confirm each policy dispatch passes an explicit `model:thinking` suffix from the routing table.
9. Check the installed Jev fixture:
   - ordinary main session still has automatic thinking enabled;
   - named subagents retain the parent suffix;
   - `PI_SELF_IMPROVE_CHILD=worker` and `=reflect` retain selected or inherited thinking.
10. Check that installation preserves OMP profile-local `modelRoles` unchanged.
11. Re-run the redacted `jq` session aggregation. Confirm its command remains safe and its schema assumptions still hold.

## Implementation phases

1. **Conservative routing policy** — update the Pi and OMP policy, Pi profiles, fallback, self-improvement JSON, installer patch, tests, and documentation in one PR. Validate the policy matrix and a sandboxed twice-run installer gate before review and PR creation.

## Approval gate

This plan stops before implementation. It needs explicit user approval because this is a gated `idea-to-pr` run.
