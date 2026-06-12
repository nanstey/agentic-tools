---
name: context-engineering
description: Audits a given scope (skill, system prompt, tool set, CLAUDE.md, or project) against context engineering best practices and applies improvements. Evaluates signal-to-noise ratio, system prompt altitude, tool design, retrieval strategy, and long-horizon technique selection.
user-invocable: true
disable-model-invocation: false
---

# Context Engineering Audit

Apply context engineering best practices to `<scope>`. If no scope is given, ask the user to specify one (e.g., "this skill", "CLAUDE.md", "the tool definitions in X", "this project").

## Step 0 — Parse Scope

Identify what the scope refers to and read it:

- **Skill / SKILL.md**: Read the file, treat system prompt + tool list + examples as the artifact
- **CLAUDE.md**: Read it, treat it as the system prompt artifact
- **Tool set**: Read all tool definitions (descriptions, parameters, return shapes)
- **Project**: Read CLAUDE.md, any skills, and skim the directory structure
- **Other**: Read whatever the user pointed at

If the scope is ambiguous, resolve it by reading candidate files before asking.

---

## Step 1 — Signal-to-Noise Audit

Estimate the token cost vs. value of each section in the scope:

For each section or block of content, ask:
- Would removing this change model behavior? If no → candidate for deletion.
- Is this derivable from the code/context at runtime? If yes → candidate for removal (just-in-time beats pre-loaded).
- Does this repeat something already implied elsewhere? If yes → consolidate.

**Output**: List each section as `KEEP`, `TRIM`, `REMOVE`, or `MOVE TO JIT` with one-line rationale.

---

## Step 2 — System Prompt Altitude Check

Evaluate whether instructions sit at the right level of specificity.

**Too prescriptive** (flag these):
- Hardcoded if-else logic ("if X then do Y else do Z")
- Enumerated lists of every possible case
- Instructions that encode things the model can infer

**Too vague** (flag these):
- High-level guidance with no concrete signal ("be helpful", "use best judgment")
- Instructions that assume shared context the model doesn't have
- Goals stated without any heuristic for achieving them

**Just right** (these are fine):
- Specific enough to guide behavior effectively
- Flexible enough to handle edge cases the author didn't anticipate
- Organized into distinct sections (background, instructions, tool guidance, examples)

**Output**: For each flagged instruction, write a reworded replacement at the correct altitude.

---

## Step 3 — Tool Design Review

For each tool in scope (if any):

Check each property:
- **Single purpose**: Does this tool do exactly one thing? If it does two, split it.
- **Unambiguous name**: Would a human engineer immediately know when to use it vs. any other tool?
- **Descriptive parameters**: Are parameter names self-explanatory? (`user_id` not `user`, `file_path` not `path`)
- **Token-efficient returns**: Does it return only what's needed, or does it dump everything?
- **No overlap**: Could two tools be confused for each other in the same situation? If yes, rewrite their descriptions or merge them.

**The human engineer test**: For each pair of tools that seem similar, ask — "if a human engineer were in this situation, would they know immediately which tool to call?" If no, the tools need clarification.

**Output**: Per-tool findings with specific rewrites for names, descriptions, or parameter names.

---

## Step 4 — Examples Quality Check

If the scope contains examples (few-shot, sample interactions, etc.):

- Are examples **diverse** (covering meaningfully different cases) or **exhaustive** (covering every edge case)? Exhaustive is bad — prune to canonical.
- Does each example demonstrate **expected behavior** clearly, like a picture worth a thousand words?
- Are any examples redundant with each other? Remove duplicates.
- Are there important behavioral patterns with **no** example? Flag the gap.

**Output**: List examples to remove (redundant/exhaustive) and gaps worth adding one example for.

---

## Step 5 — Retrieval Strategy Assessment

Determine if the scope loads the right information at the right time.

Ask for each piece of data loaded upfront:
- Is this **static** content that won't change during the interaction? → Pre-loading is fine.
- Is this content the agent **might not need**? → Move to just-in-time (reference by path/query, load on demand).
- Is this content the agent will **always** need immediately? → Keep it upfront.

**Just-in-time signals**: file paths, search queries, identifiers, links — lightweight pointers the agent can resolve when needed.

**Hybrid check**: Is there an obvious split between "load this CLAUDE.md upfront" and "let the agent glob/grep for specifics"? If yes, propose it.

**Output**: List what should move to JIT, what should stay pre-loaded, and any missing tool guidance needed to make JIT work (dead-end prevention).

---

## Step 6 — Long-Horizon Technique Selection

If the scope is an agent or skill designed for extended tasks, evaluate which technique fits:

| Situation | Technique |
|-----------|-----------|
| Extended back-and-forth, context nearing limit | **Compaction**: summarize history, preserve decisions/bugs/impl, discard redundant tool output |
| Iterative development with milestones | **Structured note-taking**: NOTES.md, to-do lists, progress logs outside context window |
| Complex research requiring deep exploration | **Sub-agent architecture**: main agent coordinates, sub-agents explore, return 1–2k token summaries |
| None of the above | No long-horizon technique needed — flag if one was added unnecessarily |

If compaction is used: verify it preserves architectural decisions and bugs found, not just conversation summaries.

If note-taking is used: verify the agent has a tool or mechanism to write/read notes.

If sub-agents are used: verify sub-agents get clean context windows and return condensed summaries, not raw dumps.

**Output**: Confirm the right technique is chosen (or recommend one), with specific gaps in the current implementation.

---

## Step 7 — Apply Findings

After completing Steps 1–6:

1. Collect all findings into a prioritized list:
   - **P1**: Findings that actively degrade model performance (context rot, ambiguous tools, missing signals)
   - **P2**: Inefficiencies that waste tokens without breaking behavior
   - **P3**: Nice-to-haves (better examples, cleaner structure)

2. Apply P1 and P2 fixes directly to the file(s) in scope using Edit.

3. For P3 findings, present them as suggestions but do not apply without asking.

4. After applying, report:
   - What changed and why
   - Estimated token reduction (rough: "removed ~200 tokens of redundant tool descriptions")
   - Any gaps that require the user to provide content (e.g., "no good example exists for X — do you have one?")

---

## Anti-Patterns (Reference)

Flag any of these if found in scope:

- Cramming everything into the system prompt instead of using JIT retrieval
- Brittle if-else logic that should be heuristics
- Bloated tool sets where tools overlap or serve dual purposes
- Exhaustive edge-case examples instead of diverse canonical ones
- Ignoring context pollution over long interactions
- Assuming a larger context window solves a signal-to-noise problem

---

## Core Principle

> Find the smallest possible set of high-signal tokens that maximize the likelihood of the desired outcome.

Context is a finite resource. Every token attends to every other token (n² relationships). More is not better — optimal is better.
