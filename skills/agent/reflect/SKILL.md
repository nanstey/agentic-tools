---
name: reflect
description: Reviews the current session for problems and their eventual fixes, then proposes durable improvements to repo skills, scripts, or docs that prevent recurrence. Use when a session hit avoidable friction worth turning into a lasting fix.
user-invocable: true
disable-model-invocation: false
---

# Reflect

## Core Contract

Examine the current session, extract the friction points and how they were overcome, then map each one to a concrete improvement in this repo's skills, scripts, or docs so the friction does not recur.
Read-only investigation by default; propose changes and only implement them after explicit user approval.
Follow `CLAUDE.md` / `AGENTS.md` on conflict.

## Required Inputs

1. The current session history (problems encountered, dead ends, retries, eventual solutions).
2. Optional scope hint (specific skills, scripts, or docs to focus on).
3. Whether to stop at proposals or also implement approved changes.

## Workflow

1. Scan the session and list concrete "hiccups": errors, wrong assumptions, repeated retries, missing context, manual workarounds, and slow detours.
2. For each hiccup, capture the eventual solution and the signal that would have caught it earlier.
3. Rank hiccups by recurrence likelihood and cost; drop one-off noise.
4. Search the repo for the relevant skill, script, or doc that *should* have prevented or eased each ranked hiccup.
5. For each, classify the gap: missing tool, incomplete workflow step, unclear instruction, missing safety rule, or absent script/automation.
6. Propose the smallest durable change per gap (edit a skill step, add a safety rule, add a script, clarify a doc), citing the file path.
7. Present the ranked proposals and stop for approval.
8. On approval, apply changes following existing repo conventions, keeping README and other reference docs in sync.

Stop and ask before implementing edits, when a fix spans multiple skills, or when a proposal changes tool behavior or safety.

## Safety Rules

- Never implement repo changes before presenting ranked proposals and getting approval.
- Never invent hiccups that did not occur in the session; every finding traces to observed evidence.
- Never bundle unrelated fixes into one change; keep each improvement scoped to its gap.
- Never edit a skill or agent without updating `README.md` when adding, renaming, or removing tools.
- Never broaden into general refactoring beyond preventing the observed friction.

## Output Style

Report the ranked hiccups with evidence, each mapped gap and target file path, the proposed minimal change, approval status, and any changes applied.
