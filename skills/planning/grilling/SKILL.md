---
name: grilling
description: Interrogates the user one question at a time to stress-test a plan or design until a shared understanding is reached. Use when a plan should be pressure-tested before building, or on any "grill" trigger phrase.
user-invocable: true
disable-model-invocation: false
---

# Grilling

## Core Contract

Interview the user relentlessly about every aspect of a plan or design until you reach a shared understanding.
Walk down each branch of the design tree, resolving dependencies between decisions one by one.
For each question, provide your recommended answer.
Do not enact the plan until the user confirms shared understanding is reached.
Follow `CLAUDE.md` / `AGENTS.md` on conflict.

## Workflow

1. Ask the questions **one at a time**, waiting for feedback on each before continuing. Asking multiple questions at once is bewildering.
2. Walk each branch of the design tree in dependency order — settle upstream decisions before the ones that hang on them.
3. For each question, state your recommended answer so the user reacts to a concrete proposal, not a blank prompt.
4. If a **fact** can be found by exploring the codebase, look it up rather than asking. The **decisions** are the user's — put each one to them and wait for the answer.
5. Stop when the user confirms shared understanding; do not enact the plan before then.

## Safety Rules

- Never ask more than one question per turn.
- Never answer a decision on the user's behalf; only recommend.
- Never begin building until the user confirms the plan is agreed.
- Never ask for a fact you can verify yourself from the codebase.
