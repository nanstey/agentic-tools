# PR description

## Purpose
Sync the PR title and body with its current changes. Apply [policy](policy.md#pr-body).

## Inputs
- PR target; otherwise resolve with `pr snapshot`.
- Current title/body, authoritative base/head comparison, repository instructions, and applicable template.

## Steps
1. Run `pr snapshot [target]`. If no PR exists, run `/pr create`; do not stop with a suggestion. Read the title/body and apply supplied `CLAUDE.md`/`AGENTS.md` instructions. Inspect only standard PR templates and linked contribution guidance.
2. Judge drift against the exact PR changes. Select applicable guidance/template; resolve ties by change-type match, then alphabetical order. Preserve required fields, relevant existing content, links, and attachments. A usable default description has `## Summary`, `## Changes`, and `## Testing`; missing any heading is a phase-3 placeholder.
3. Draft a concise BLUF title/body using `bluf` and `ste`.
   - Include only supported claims, keep required template sections, and remove agent disclosure.
   - Use `## Summary` (what changed), `## Changes` (cohesive groups), and `## Testing` (specific evidence). Optional sections: `## Notes` for risks and `## Screenshots` for UI evidence.
   - Lead with the result. Describe groups rather than files or chronology. Keep sentences and bullets near 25 words; omit rationale unless needed to understand the change.
   - Refresh UI evidence first with `/pr screenshots` and preserve its attachments. Retain `## Evidence` written by verification.
4. Update a drifted title and apply the body with `pr body --run <id> --file <path> --preserve-evidence`. Re-read with `pr snapshot` and confirm title/body. Follow [body policy](policy.md#pr-body).

## Output
Report PR, comparison base, guidance/template, title change or unchanged status, body drift, and sections updated, preserved, checked, or removed.
