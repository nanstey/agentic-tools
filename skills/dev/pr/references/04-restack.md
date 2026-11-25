# PR restack

Rebase a dependent manual PR stack onto updated upstream branches. Prefer `/pr stack` for native stacks.

## Inputs

- Stack order/top branch, upstream changes, and known merge style.

## Steps

1. Probe native stack support with `pr stack probe`; use `/pr stack` when available.
2. Resolve stack PR facts with `pr snapshot [target]`. Map branches, root base, and drift; record a per-branch plan, risks, and lease SHAs before mutation.
3. Apply [draft-before-changes](_policy.md#draft-before-changes) to each affected PR and create backups before rewriting. Never force-push `main` or `develop`; create or switch to a feature branch before committing there.
4. Execute bottom-up with `/git rebase`; resolve conflicts with `/git conflicts`, validate and verify branch shape. Push rewritten heads only with leases through `pr push [target] --run <id> --force-with-lease`. Never split dependent groups into parallel branches; flag any secret or credential without echoing its value.
5. Update changed PR bases, then verify each head and run the `/pr push` post-push steps.

## Output

Report root base, plan, branch/base and SHA changes, pushes, backups, and unresolved risks.
