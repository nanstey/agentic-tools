# Brainstorm

## Goal

Turn an uncertain idea into a concepts brief without writing code.

## Workflow

1. Explore with open questions over multiple turns. Establish an anchored hypothesis: problem, affected users, desired outcome, constraints, and initial boundaries.
2. Ask the human to confirm that the hypothesis is ready for challenge.
3. Send the anchored hypothesis to three or four fresh Goldfish lenses in parallel. Give each only the hypothesis and any explicitly referenced files. Use divergent lenses: simplicity and reuse, architecture and risk, usability and scope, and operations or migration.
4. Reconcile the findings with the human. Do not silently select a product or architecture direction.
5. Write a concepts brief in the resolved plan folder. Include the hypothesis, alternatives, decisions, unresolved risks, and a clear gap list.
6. Register the brief as `egm-concept` with status `draft`, then stop for review.

## Lens Prompts

Each Goldfish is read-only and returns evidence, severity, and a concrete question or requirement.

- **Simplicity and reuse:** What existing capability or smaller approach meets the need? What is premature or unnecessary?
- **Architecture and risk:** What assumptions, failure modes, scale limits, security concerns, or operating costs lack a response?
- **Usability and scope:** Which users, interfaces, prerequisites, and non-goals are unclear? What could create cognitive friction?
- **Operations and migration:** What telemetry, rollout, rollback, compatibility, or maintenance burden is missing?

## Concepts Brief

```markdown
# <Concept>

## Hypothesis
## Problem and users
## Goals and non-goals
## Options considered
## Goldfish findings
## Decisions
## Gap list
## Next question
```
