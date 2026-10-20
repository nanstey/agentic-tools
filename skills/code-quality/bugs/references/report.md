# Report template

```
Verdict: findings | needs_verification | clean_within_scope | incomplete
Counts: critical N, high N, medium N, low N; needs-verification N
Scope: <paths | base..head>, assumed or given
Intent source: <spec | issue | tests | none>
```

## Findings

Group by severity. For each finding:

```
B1 <title>
Severity: <level>   Confidence: high
Location: path:line (more locations if one root cause)
Trigger: <input or state that causes it>
Wrong behavior: <actual result vs intended result>
Impact: <who or what is affected>
Evidence: <trace of values or code path, caller/guard check, test search result>
Fix:
  <suggested diff>
Not covered by fix: <what remains>
```

## Needs verification

Each item: location, the suspected defect, and the exact question that decides it.

## Rejected leads

One line each: the lead and the reason it failed (guard found, unreachable, intended, tested).

## Coverage

- Reviewed: units read in full.
- Not reviewed: units and the reason.
- Not run: tests, builds, or runtime checks, and why.

## Next steps

Suggested fixes in priority order. Name `security`, `refactor`, `risk-review`, or `verification` only where a lead belongs there.
