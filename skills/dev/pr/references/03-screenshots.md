# PR screenshots

## Purpose
Judge whether UI changes need current visual evidence and attach it safely. Apply [body policy](_policy.md#pr-body).

## Inputs
- PR target, or current branch.
- Authoritative changes and current body from `pr snapshot`.
- Runnable branch site and `visual-capture` artifacts when capture is needed.

## Steps
1. Run `pr snapshot [target]`. If no PR exists, run `/pr create`. Judge applicability from the authoritative changes: user-facing UI changes require evidence; backend, docs, tests, config, tooling, and non-visual refactors do not. If not applicable, report that and stop.
2. Judge existing image/video evidence for relevance, coverage, and freshness against the latest UI changes. If current, keep it. If missing or stale, confirm the site is reachable and delegate capture to `visual-capture`. Capture final-state capabilities; use before/after only for explicit visual replacement/regression, with exact refs. Never capture errors or add artifacts to the repository.
3. Prepare one body update preserving unrelated content and every attachment. Attach with `pr attach --run <id> --file <body-file> --cap <capture-dir> [--capture-skill-dir <path>]`. The script validates assets, performs native attachment, rereads the body, and reports partial uploads. Do not blindly retry a failed attempt.

## Output
Report applicability, evidence classification and coverage, captures/refs, attach result and remaining paths, updated body sections, and confirmation that artifacts were not committed. If attach is pending, include validated paths and paste-ready Markdown.
