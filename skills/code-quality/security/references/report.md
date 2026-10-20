# Security report template

Print the report in the response. Write a file only when the user names a path.
Redact secrets and personal data everywhere, including snippets and diffs.

```markdown
# Security review

**Verdict:** findings | needs_verification | clean_within_scope | incomplete
**Scope:** <paths / diff base..head / repo>, assumed or given
**Stack:** <languages, frameworks, entry points>
**Counts:** Critical N · High N · Medium N · Low N · Needs verification N
**Method:** <manual trace, plus scanners with version and ruleset, if any>
**Jev:** <model, adapter, question version, leads sent/skipped, disagreements with source disposition> | unavailable | not used

## Findings

### SEC-001 · <title>
- **Severity / confidence:** High / High  (Jev severity suggestion, if used: <level>)
- **Location:** `path/file.ext:LINE`
- **Attacker action:** <who does what, with which input>
- **Impact:** <asset affected and consequence>
- **Data path:** <source → ... → sink, with file:line per step>
- **Evidence:** <redacted snippet>
- **Why safeguards do not apply:** <what was checked upstream>
- **Suggested fix:**
  ```diff
  - vulnerable line
  + fixed line
  ```
- **Fix does not cover:** <residual risk>

## Needs verification
- **SEC-0NN · <title>** — `path:LINE`. Open question: <exact fact to confirm and who owns it>.

## Rejected hypotheses
- <pattern, location> — rejected because <safeguard or non-attacker input, with evidence>.

## Dependency and build notes
- <package or CI item, version, issue, confidence, what was not verified offline>

## Coverage gaps
- <unreviewed paths, unreadable files, missing policy, absent consumers, unverified CVE claims>

## Follow-up work
- <tracked item per High or Critical finding, owner suggestion, rotate-secret notices>

Nothing was changed. Review each suggested fix before applying it.
```

Rules:

- Order findings by severity, then confidence. Number IDs once and keep them on re-review.
- A finding without a data path, attacker action, and impact moves to needs-verification.
- For a clean result, write `clean_within_scope` and list exactly what was scanned and what was not. Do not write "secure".
- State when a live credential was found, and tell the user to rotate it. Do not repeat the value.
