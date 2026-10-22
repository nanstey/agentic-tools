---
name: complexity
description: Measures cyclomatic complexity, function length, and parameter count on code with Lizard, then judges whether code needs refactoring. Use when self-assessing code you wrote or changed, deciding if a refactor is warranted, or finding the most complex functions in a scope.
user-invocable: true
disable-model-invocation: false
argument-hint: "[--base REF] [--full] [--ccn N] [--nloc N] [--args N] [PATH...]"
---

# Complexity

Measure first, then judge. Numbers locate candidates. They do not prove a refactor is needed.

Invoke directly with `/complexity`. Other skills also call it: [`build`](../../workflow/build/SKILL.md) after each validated phase, and [`refactor`](../refactor/SKILL.md) (and so `review-code`) as measurement evidence. Callers that set their own mode (for example report-only) keep it. This skill never edits code when called as a measurement step.

## Workflow

1. **Run the script.** From this skill's directory:
   `scripts/complexity.sh` with no argument analyzes the files changed on this branch: commits since the merge-base with the default branch, plus staged, unstaged, and untracked files. The base is `origin/HEAD`, then `origin/main`, `main`, `master`, else `HEAD` (uncommitted only). A branch that has fallen behind `main` is not affected.
   - `scripts/complexity.sh PATH...` narrows the changed set to those files or folders.
   - `--base REF` compares against another ref. An unknown ref exits 2.
   - `--full [PATH...]` ignores git state and analyzes the paths completely (whole repo if none). Use it for an audit.
   - `--all` lists every function, not only violations.
   It analyzes whole files, so a changed file can list functions you did not touch. Check each against your diff.
   It prints a TSV, worst first. By default only violating functions appear, and `--all` lists every function. Columns: `CCN NLOC PARAMS FUNCTION LOCATION FLAGS`.
2. **If exit code is 3**, Lizard is missing. The script resolves `lizard`, `python3 -I -m lizard`, `uvx lizard`, then `pipx run lizard`. `uvx` and `pipx run` download an unpinned package. Set `COMPLEXITY_NO_FETCH=1` to forbid that. Run `./install.sh --tool lizard` from the repo root, or `uv tool install lizard` / `pipx install lizard`. Do not hand-count complexity.
3. **Judge each flagged function** against the thresholds below. Read the function before deciding.
4. **Act.** When called directly or by `build`, and if you wrote or changed the function and it is over the red line, simplify it now (see [`refactor`](../refactor/SKILL.md), goal `simplify` or `extract`). Otherwise, or in a report-only caller, report it. Never refactor unrelated code only because it scores high.
5. **Re-measure** after a change. Report before and after numbers.

## Thresholds (defaults)

| Metric | Fine | Review | Refactor |
| --- | --- | --- | --- |
| CCN (cyclomatic complexity) | 1–10 | 11–15 | over 15 |
| NLOC (function lines, no comments/blank) | up to 60 | 61–100 | over 100 |
| PARAMS | up to 5 | 6–7 | over 7 |

The script flags values over `--ccn 10`, `--nloc 60`, `--args 5`. Honor a repository's own limits if `AGENTS.md`, a linter config, or CI states them, and pass them as flags.

## Judging

- High CCN from one flat `switch` or dispatch table, a parser, or a generated mapping is often acceptable. Say so and move on.
- High CCN with deep nesting, mixed concerns, or repeated conditions is a real finding. Prefer guard clauses, extracting a named helper, or replacing conditionals with a table or polymorphism.
- A long function with low CCN is a readability issue, not a branching one. Extract only along real seams.
- Many parameters usually mean a missing object or a function doing two jobs.
- Test code and migrations may deserve looser limits. State the exception.
- A refactor must preserve behavior. Run the tests before and after.

## Output

Lead with the verdict: `refactor`, `review`, or `ok`. Then list each flagged function with its numbers, location, cause, and chosen action. Include the command used and the limits applied. Name any file Lizard did not analyze.

## Notes

- CCN counts decision points per function: `if`, loops, `case`, `catch`, `&&`, `||`, ternary. Lizard approximates this from tokens without a full parse, so it works on partial or broken code and across languages.
- Lizard also supports `-Eduplicate` (duplicate code) and `-Ens` (nested structures) for deeper checks. Run it directly for those.
