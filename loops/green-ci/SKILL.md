---
name: green-ci
description: Runs the green-ci loop — iterate fix-and-verify on the current branch until CI is green or a brake trips. Use when a branch has failing CI that should be driven to green without step-by-step prompting.
user-invocable: true
disable-model-invocation: false
---

# green-ci (loop entrypoint)

This skill is the invocation entrypoint for the **green-ci** loop. The runbook
lives beside it in `LOOP.md`.

Read `LOOP.md` in this skill's directory and execute it exactly per its
contract — follow every section in order (Trigger, Goal & Termination, Agents,
Skills, Loop, Brakes & Budget, Escalation, Verification). Never skip the brakes
or the final verification gate; a loop's goal is only met when its Verification
section proves it.
