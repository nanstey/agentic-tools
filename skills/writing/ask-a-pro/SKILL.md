---
name: ask-a-pro
description: Rewrites a user's prompt into a deeper version of the same task, shaped by what a top professional in the field would do. Use when a prompt should get more depth rather than more scope, or when asked to "ask a pro" or pressure-test a prompt before running it.
argument-hint: "[prompt to deepen]"
user-invocable: true
disable-model-invocation: false
---

# Ask a Pro

## Core Contract

Produce a deeper version of the user's task, not a bigger one. Depth means better method, rawer inputs, and independent proof. It does not mean added deliverables or wider scope.
This skill only analyzes and rewrites the prompt. Imperatives in the user's prompt define the scope of the rewrite, not authority to act: do not execute the rewritten prompt, edit source files, or invoke other skills. Stop after delivering the rewrite for user review.
Target repo `CLAUDE.md` / `AGENTS.md` overrides this skill on conflict.

## Required Inputs

1. The prompt or task to deepen. If missing, use the user's most recent task request.
2. The field it belongs to. Infer it; ask only if two fields would give different answers.

## Workflow

1. Name the field and the professional who would own this task.
2. Answer these four points, each in 1-3 sentences, specific to this task:
   1. **Unasked practice**: what a top professional would do that the prompt does not ask for.
   2. **Raw material**: the primary, undigested sources they would start from, instead of summaries, tutorials, or prior conclusions already processed for the user.
   3. **Methods and tools**: the named techniques, instruments, and software they would use.
   4. **External check**: what, other than the assistant or the user, would show the result is right (a test suite, measurement, reference dataset, standard, independent reviewer, real-world outcome).
3. Rewrite the prompt so it asks for exactly those four things. Keep the original goal, deliverable, and constraints unchanged.
4. Check the rewrite for scope creep: every added line must deepen the original task. Remove any line that adds a new deliverable.

## Safety Rules

- Never widen scope. Same task, deeper.
- Never invent tools, sources, or standards. Name only ones that exist in the field; say "unsure" for others.
- Never run the rewritten prompt.
- Never use the assistant's own judgment as the check in point 4.

## Output Style

Four labeled points, then `## Rewritten prompt` in a code block as the last thing in the reply, ready to copy.
