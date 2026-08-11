---
name: pre-mortem
description: >
  Assumes a plan has already failed and works backward to identify its most likely causes
  of death before execution. Use when the user explicitly asks for a pre-mortem or uses
  phrases like "what kills this," "assume this fails," "what goes wrong," "how does this
  die," "future autopsy," "failure mode analysis," "imagine this failed in 12 months," or
  "what could go wrong" about a specific plan they are about to execute. Do not use for
  general brainstorming, for choosing between options, for post-hoc critique of reasoning
  (use brutal-critic), or for pre-execution alignment (use commanders-intent).
user-invocable: true
disable-model-invocation: false
---

# Pre-Mortem — Prospective Failure Analysis
# v2 2026-03-11

## Purpose

A pre-mortem inverts the normal planning question. Instead of "how do we succeed?" it asks
"we failed; why?" This reframe exploits a cognitive asymmetry: people are better at
explaining past events than predicting future ones. By placing the failure in the past
(hypothetically), the skill unlocks explanatory reasoning that forward-looking risk
assessment misses.

The technique originates from Gary Klein's research on naturalistic decision making. It
is one of the few debiasing interventions with empirical support for improving plan quality.

## Boundary with Other Skills

- **brutal-critic**: Attacks reasoning and assumptions in the present tense. Pre-mortem
  projects forward to a specific failure point and reverse-engineers. Brutal-critic asks
  "where is this wrong?" Pre-mortem asks "assuming this failed, what happened?"
- **Option evaluation / structured decision comparison**: Evaluates choices between
  options. Pre-mortem runs after a choice has been made, on the chosen path.
- **commanders-intent**: Establishes shared understanding before execution. Pre-mortem
  runs after intent is established, before or during execution.

**Sequencing with brutal-critic:** These two skills can run in sequence on the same plan.
Brutal-critic first (attack the reasoning), then pre-mortem (assuming the plan survives
the critique, project forward to execution failure). If both are requested, run them as
separate passes with distinct outputs. Do not merge them.

## Core Rules

1. The failure is stipulated, not hypothetical. "This failed" is the starting premise.
   Do not soften it to "this might fail" or "there's a risk that."
2. Work backward from failure to cause, not forward from plan to risk. The direction
   matters: backward reasoning surfaces different failure modes than forward reasoning.
3. Focus on the most likely causes, not the most dramatic. A pre-mortem that identifies
   "a global recession killed it" is useless. One that identifies "you underestimated
   the content production bottleneck by 3x" is actionable.
4. Distinguish between controllable causes (execution failures) and environmental causes
   (market shifts, competitor moves). Weight controllable causes more heavily because
   the user can act on them.
5. Do not fabricate data. If a failure cause depends on an empirical claim (market size,
   conversion rate, competitor capability), flag the claim and state what would need to
   be verified.
6. Keep total output under 800 words. Precision over coverage.

## Tone Rules

The pre-mortem is a forensic report, not a consulting memo. It should read like a
coroner's findings, not a risk register.

1. Be direct and assertive. State causes of death as facts, not possibilities. "The
   price increase gutted your buyer pool" not "the price increase may have contributed
   to reduced conversion."
2. Name the human consequence, not just the metric. "You priced desperate people out
   of the one thing they thought could save their career" hits differently than
   "conversion dropped 1.5 percentage points."
3. Do not cushion the failure scenario. Do not add "but there were bright spots" or
   "the fundamentals were sound." The plan failed. Stay in that reality.
4. The Silent Dependency section should read like an accusation, not a hypothesis.
   "You assumed X and never checked" not "there may be an untested assumption
   around X."
5. Hold the failure open. The Survivable Version comes last for a reason. Let every
   cause of death and the hidden dependency land fully before offering any path
   forward. Do not foreshadow solutions while describing the autopsy.
6. Write like a direct conversation. No hedging qualifiers ("somewhat," "potentially,"
   "it's worth noting that"). No diplomatic buffer phrases.

## The Protocol

### Setup: Define the Failure Scenario

Before running the analysis, establish three parameters:

1. **Time horizon.** When did this fail? (Default: 12 months from now unless the user
   specifies otherwise.)
2. **Definition of failure.** What does "failed" mean for this specific plan? Revenue
   target missed? Product didn't launch? Audience didn't materialize? If the user hasn't
   defined failure, propose a concrete definition and confirm before proceeding.
3. **Current state snapshot.** Briefly restate the plan as understood, so the analysis
   is grounded in shared facts, not assumptions.

### Step 1: The Autopsy — Three Most Likely Causes of Death

Identify exactly three causes, ranked by probability. For each cause:

- **What happened** (one sentence, written in past tense as if reporting on an actual
  failure). Be blunt. This is a death certificate, not a risk assessment.
- **The mechanism** (two to three sentences explaining the causal chain from the plan's
  current state to the failure). Be specific about where the chain breaks.
- **The human cost** (one sentence naming what was actually lost: not just revenue or
  metrics, but time, opportunity, credibility, or options that can't be recovered).
- **The early warning signal** that would have been visible within the first 30 days
  if the user had known to look for it.

Requirements for cause selection:
- At least two of the three causes must be controllable (execution, resource allocation,
  prioritization, skill gaps).
- At most one cause may be environmental (market, competition, regulation).
- Causes must be independent. If Cause 2 only happens because of Cause 1, they are the
  same cause.
- Prefer causes that are non-obvious. If the user has already identified a risk, it
  should not appear here unless the user has underestimated its severity.

### Step 2: The Hidden Dependency

Identify one assumption the plan depends on that the user has not explicitly tested or
validated. This is the "silent load-bearing wall": remove it and the structure collapses,
but it is invisible in the blueprint.

State the assumption as a direct accusation: "You assumed X, and you never verified it."
Explain what made the assumption feel safe enough to skip testing (this is usually
convenience or discomfort, not evidence). Propose a specific, low-cost way to test it
within two weeks. Make the test concrete enough that the user can do it tomorrow.

### Step 3: The Survivable Version

Propose one modification to the plan that would make the most likely cause of death
(from Step 1) survivable. Not prevented; survived. The distinction matters: prevention
requires prediction, but survival requires resilience.

Requirements:
- The modification must be implementable with the user's current resources.
- It must not require the plan to succeed in order to work (no circular dependencies).
- It should reduce the blast radius of failure, not the probability of failure.

### Step 4: The 30-Day Tripwire

Define one specific, observable metric or event that the user should monitor starting
now. If the tripwire is hit within 30 days, it means the most likely failure cause is
already in motion.

Requirements:
- Must be measurable, not subjective ("I feel like it's not working" is not a tripwire).
- Must have a specific threshold ("below X" or "zero instances of Y by date Z").
- Must include a pre-committed action: what the user will do if the tripwire fires.
  Define this now, not when the tripwire fires, because judgment under stress is
  unreliable.

## Output Format

Use these exact section headers. No preamble.

```
## Failure Scenario
[Setup: time horizon, definition of failure, plan snapshot]

## Cause of Death
### 1. [Cause name]
[What happened / mechanism / human cost / early warning]

### 2. [Cause name]
[What happened / mechanism / human cost / early warning]

### 3. [Cause name]
[What happened / mechanism / human cost / early warning]

## The Silent Dependency
[Accusation, why it felt safe to skip, how to test]

## The Survivable Version
[One modification for resilience]

## 30-Day Tripwire
[Metric, threshold, pre-committed action]
```

## Handling Edge Cases

**If the user provides a vague plan without specifics:**
Do not guess. Ask for the three things needed for setup: time horizon, what "failed"
means, and the plan as they understand it. Maximum two questions. If they remain vague,
work with what you have and flag assumptions explicitly.

**If the user asks for pre-mortem on someone else's plan (a client's, a team's):**
Run the same protocol but frame causes from the executor's perspective, not the user's.
The user's role is observer/advisor, so Step 3 (Survivable Version) should be advice
the user can give, not actions they can take directly.

**If the user asks for both brutal-critic and pre-mortem in the same request:**
Run brutal-critic first (it attacks the reasoning), then pre-mortem (it projects
execution failure). Separate the outputs clearly with distinct headers. Do not merge
the analyses.

**If the plan has already partially failed:**
Adjust the protocol: Step 1 becomes "what caused the failure to deepen" rather than
"what caused the failure." Anchor on the current partial-failure state, not the
original plan.

## What This Skill Never Does

- Never reassures. The failure is stipulated. Reassurance is incoherent.
- Never lists more than three causes of death. Precision over coverage.
- Never identifies only environmental causes. At least two must be controllable.
- Never proposes modifications that require resources the user does not have.
- Never runs silently. Explicit trigger only.
- Never replaces brutal-critic for present-tense reasoning critique.
- Never substitutes for a structured comparison when the task is really choosing between options.
