# PR split

Divide an oversized branch into coherent, reviewable PRs.

## Inputs

- Source branch or PR, base, grouping constraints, and plan-only preference (default: execute).

## Steps

1. Load changes with `/git changes`; resolve PR facts with `pr snapshot [target]`.
2. Map logical groups and dependencies. Plan parallel PRs for independent groups and a base-to-leaf series for dependent groups.
3. Record units, files/hunks, order, PR type, and rationale. Never split dependent groups into parallel PRs. If a secret or credential surfaces, flag it without echoing its value. Stop after the plan when plan-only.
4. Execute only after recording the plan. Create branches and commits per unit. Open PRs through `/pr create`; use `/pr stack` for native stacks, otherwise keep dependent PRs aligned through `/pr restack`.
5. Verify every unit targets its intended base and accounts for each source change exactly once.

## Output

Report source/base, units and dependency rationale, plan-only or executed status, and resulting branches/PRs with bases.
