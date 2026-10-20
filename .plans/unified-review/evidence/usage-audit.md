# Historical review-skill usage audit

**Result:** Observed evidence is a lower bound, not a measure of adoption or completed reviews. Zero means **UNKNOWN**, never unused.

## Scope and privacy

Exclusive event cutoff: `2026-10-20T00:38:18.590Z`. The specified parent session is excluded; timestamp filtering excludes its later agents. The audit reads repository frontmatter and git history, Pi/Claude transcripts, aggregate histories, and shell histories. This extension also reads installed Pi trace producer definitions. No credentials/auth files or raw excerpts are included.

Canonical current names come from `name:` frontmatter under `skills/code-quality`, `skills/dev`, `skills/planning`, `skills/workflow`, `skills/agent`, plus `skills/env/handoff/SKILL.md` and `agents/reviewer.md`. Historical deleted dev/workflow/code-quality frontmatter is recovered from git, and retired PR/stack frontmatter from successful historical skill loads; historical rows are marked. Relocated skills use their current frontmatter path. Other categories are outside this review-focused scope.

## Counting definitions

- **Read:** a structured `read`/`Read` call whose argument names an actual `skills/<name>/SKILL.md`, paired by tool-call ID with a non-error tool result before cutoff. Failed/unconfirmed calls are separate in JSON. It proves a document load, not that the workflow ran; authoring/audit reads cannot reliably be distinguished.
- **Command:** exact `/skill:name`, `$name`, or `/name` at the start of a user text. Generic mentions, quoted examples, assistant prose, catalogs/system prompts, shell commands containing a name and tool outputs are not calls. Conservative start-of-text matching misses inline commands. A requested invocation need not have succeeded.
- **Skill:** provider `Skill` tool success paired with a result; unsuccessful/unconfirmed dispatches are separate.
- **Reviewer:** exact structured `agent`/`subagent_type` equal to `reviewer` or historical `code-reviewer`, including nested task/chain specs. Success means the dispatch tool returned non-error, not reviewer acceptance or completed review. Free-text requests, flow script strings, resumes and arbitrary agent nicknames are not counted.
- **Turns:** union of commands, successful reads, successful provider Skill calls and successful reviewer dispatches in the same user turn for a skill. Multiple reads/commands in that turn count once. Branch copies deduplicate by stable tool IDs or stable message ID+timestamp. Shared message IDs merge session lineages. **Lineages** further collapse all turns in each deduplicated transcript lineage; this is the more conservative run-evidence bound, still not completed executions.
- Supplementary command/run histories are reported separately, never added to transcript evidence (they can duplicate it). Cross-session/provider handoffs cannot be reconstructed reliably: turn/lineage counts may still include a parent request and child load. They are NOT invocation lower bounds. **Call bound** is the maximum of four groups: direct plus nested successful reads, explicit user commands, successful Skill calls, and direct plus nested successful reviewer dispatches, allowing all categories to overlap even across sessions. This bounds observed load/request/dispatch calls, not completed workflow executions; authoring reads remain document loads. Evidence-turn counts are observed load/request occasions, not exact workflow runs.
- Jev `jev_find_skill` structured recommendations are separate from actual loads; router-decision records are not skill calls. No inference is made from a candidate name, confidence score, or catalog injection. Metrics without skill identity cannot establish invocation. Available Jev recommendations are counted separately in JSON; no dedicated auto-match/load telemetry was found in the bounded metric sources, so auto-match frequency is UNKNOWN.

## Per-name evidence

| Canonical name | Direct reads | Nested reads | Commands | Skill | Direct dispatch | Nested dispatch | Turn union | Lineages | Call bound | Status |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| branch (historical) | 27 | 0 | 0 | 0 | 0 | 0 | 27 | 26 | 27 | EVIDENCED |
| build | 41 | 2 | 11 | 0 | 0 | 0 | 43 | 37 | 43 | EVIDENCED |
| changes (historical) | 27 | 0 | 2 | 0 | 0 | 0 | 27 | 24 | 27 | EVIDENCED |
| commit (historical) | 60 | 0 | 1 | 0 | 0 | 0 | 60 | 54 | 60 | EVIDENCED |
| conflicts (historical) | 10 | 0 | 0 | 0 | 0 | 0 | 10 | 10 | 10 | EVIDENCED |
| context-engineering | 1 | 0 | 0 | 0 | 0 | 0 | 1 | 1 | 1 | EVIDENCED |
| deep-review | 7 | 0 | 0 | 0 | 0 | 0 | 6 | 6 | 7 | EVIDENCED |
| dry | 1 | 0 | 1 | 0 | 0 | 0 | 2 | 2 | 1 | EVIDENCED |
| extract | 1 | 1 | 0 | 0 | 0 | 0 | 2 | 2 | 2 | EVIDENCED |
| flow-design | 8 | 0 | 0 | 0 | 0 | 0 | 8 | 8 | 8 | EVIDENCED |
| fresh-air | 1 | 0 | 0 | 0 | 0 | 0 | 1 | 1 | 1 | EVIDENCED |
| gh-stack (historical) | 22 | 0 | 4 | 0 | 0 | 0 | 22 | 21 | 22 | EVIDENCED |
| git | 7 | 4 | 1 | 0 | 0 | 0 | 12 | 12 | 11 | EVIDENCED |
| handoff | 3 | 0 | 2 | 0 | 0 | 0 | 3 | 3 | 3 | EVIDENCED |
| idea-to-pr | 9 | 1 | 3 | 0 | 0 | 0 | 11 | 10 | 10 | EVIDENCED |
| new-app | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | UNKNOWN |
| plan-init | 15 | 1 | 0 | 0 | 0 | 0 | 16 | 16 | 16 | EVIDENCED |
| ponytail | 2 | 0 | 1 | 0 | 0 | 0 | 3 | 3 | 2 | EVIDENCED |
| pr | 47 | 9 | 23 | 0 | 0 | 0 | 67 | 63 | 56 | EVIDENCED |
| pr-ci (historical) | 24 | 0 | 2 | 1 | 0 | 0 | 27 | 24 | 24 | EVIDENCED |
| pr-comments (historical) | 28 | 0 | 0 | 0 | 0 | 0 | 27 | 25 | 28 | EVIDENCED |
| pr-create (historical) | 73 | 0 | 0 | 1 | 0 | 0 | 73 | 69 | 73 | EVIDENCED |
| pr-description (historical) | 99 | 0 | 2 | 0 | 0 | 0 | 97 | 83 | 99 | EVIDENCED |
| pr-info (historical) | 75 | 0 | 0 | 0 | 0 | 0 | 74 | 71 | 75 | EVIDENCED |
| pr-merge (historical) | 1 | 0 | 0 | 0 | 0 | 0 | 1 | 1 | 1 | EVIDENCED |
| pr-monitor (historical) | 2 | 0 | 1 | 1 | 0 | 0 | 4 | 4 | 2 | EVIDENCED |
| pr-rebase (historical) | 21 | 0 | 0 | 0 | 0 | 0 | 21 | 19 | 21 | EVIDENCED |
| pr-restack (historical) | 15 | 0 | 0 | 0 | 0 | 0 | 15 | 15 | 15 | EVIDENCED |
| pr-screenshots (historical) | 29 | 0 | 0 | 0 | 0 | 0 | 27 | 24 | 29 | EVIDENCED |
| pr-split (historical) | 1 | 0 | 0 | 0 | 0 | 0 | 1 | 1 | 1 | EVIDENCED |
| principles | 1 | 0 | 0 | 0 | 0 | 0 | 1 | 1 | 1 | EVIDENCED |
| product-review | 7 | 0 | 0 | 0 | 0 | 0 | 6 | 6 | 7 | EVIDENCED |
| program-design | 6 | 0 | 0 | 0 | 0 | 0 | 5 | 5 | 6 | EVIDENCED |
| proposal | 18 | 1 | 2 | 0 | 0 | 0 | 18 | 17 | 19 | EVIDENCED |
| prototype | 1 | 0 | 0 | 0 | 0 | 0 | 1 | 1 | 1 | EVIDENCED |
| rebase (historical) | 54 | 0 | 0 | 0 | 0 | 0 | 54 | 49 | 54 | EVIDENCED |
| refactor | 1 | 1 | 0 | 0 | 0 | 0 | 2 | 2 | 2 | EVIDENCED |
| reflect | 4 | 0 | 0 | 0 | 0 | 0 | 4 | 4 | 4 | EVIDENCED |
| reviewer agent | 0 | 0 | 0 | 0 | 110 | 24 | 97 | 67 | 134 | EVIDENCED |
| scope | 6 | 4 | 0 | 0 | 0 | 0 | 10 | 9 | 10 | EVIDENCED |
| scrutiny | 9 | 0 | 0 | 0 | 0 | 0 | 9 | 9 | 9 | EVIDENCED |
| smell (historical) | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | UNKNOWN |
| sniff | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | UNKNOWN |
| speclist | 16 | 1 | 0 | 0 | 0 | 0 | 17 | 16 | 17 | EVIDENCED |
| srp | 1 | 0 | 0 | 0 | 0 | 0 | 1 | 1 | 1 | EVIDENCED |
| system-architecture | 6 | 0 | 0 | 0 | 0 | 0 | 6 | 6 | 6 | EVIDENCED |
| vertical-slices | 6 | 0 | 0 | 0 | 0 | 0 | 6 | 6 | 6 | EVIDENCED |
| worktree (historical) | 4 | 0 | 0 | 0 | 0 | 0 | 4 | 4 | 4 | EVIDENCED |

Per-source per-skill breakdowns, failed/unconfirmed calls, canonical frontmatter paths and git-only change counts are in `usage-counts.json`.

## Transcript coverage

| Logical source | Files | Bytes | Records | Eligible | Date range (UTC) | Invalid JSON | Missing/invalid time | Cutoff omitted | Task files omitted |
|---|---:|---:|---:|---:|---|---:|---:|---:|---:|
| pi-main | 697 | 436803693 | 103458 | 103280 | 2026-06-09T02:54:54.929000+00:00 – 2026-10-20T00:38:17.859000+00:00 | 0 | 0 | 67 | 1 |
| pi-subagents | 99 | 34661731 | 7215 | 6744 | 2026-08-28T00:45:04.423000+00:00 – 2026-10-20T00:37:50.355000+00:00 | 0 | 0 | 471 | 0 |
| claude-projects | 32 | 26186845 | 5569 | 3957 | 2026-09-17T23:12:16.622000+00:00 – 2026-10-17T00:10:27.458000+00:00 | 0 | 1612 | 0 | 0 |

`pi-main`: `~/.pi/agent/sessions`; `pi-subagents`: `~/.pi/subagent-sessions`; `claude-projects`: `~/.claude/projects`. JSONL artifacts are excluded. Only directly named retired/archive/backup/old roots beneath `~/.pi` and `~/.pi/agent` are additionally discovered. No such roots were found. Retired individual skill names still appear in older main sessions; missing retired roots do not prove older data never existed.

## Supplementary evidence (not added)

- **claude-history:** 1 files, 83008 bytes, 368 records; eligible 368; dates 2026-04-16T18:58:17.710000+00:00 – 2026-10-17T00:09:42.173000+00:00; invalid JSON 0, missing/invalid time 0, cutoff omitted 0, undated omitted 0. Relevant evidence counts: `{"changes": 3, "commit": 2, "ponytail": 1, "pr": 4, "pr-comments": 1, "pr-description": 2, "prototype": 1}`.
- **pi-run-history:** 1 files, 23526 bytes, 139 records; eligible 139; dates 2026-06-09T03:05:15+00:00 – 2026-08-28T00:01:59+00:00; invalid JSON 0, missing/invalid time 0, cutoff omitted 0, undated omitted 0. Relevant evidence counts: `{"reviewer agent": 89}`.
- **pi-observability:** 1 files, 2162 bytes, 10 records; eligible 10; dates 2026-10-19T20:38:14.633000+00:00 – 2026-10-20T00:21:46.363000+00:00; invalid JSON 0, missing/invalid time 0, cutoff omitted 0, undated omitted 0. Relevant evidence counts: `{}`.
- **bash-history:** 1 files, 37649 bytes, 2000 records; eligible 0; dates None – None; invalid JSON 0, missing/invalid time 0, cutoff omitted 0, undated omitted 2000. Relevant evidence counts: `{}`.
- **zsh-history:** 1 files, 6734 bytes, 56 records; eligible 46; dates 2025-10-09T18:15:48+00:00 – 2026-06-25T19:10:16+00:00; invalid JSON 0, missing/invalid time 0, cutoff omitted 0, undated omitted 10. Relevant evidence counts: `{}`.

## Follow-up: handoff and nested-tool metadata

The scope includes `handoff`. The metadata audit samples Pi bash/codemode schemas. This extension adds successful structured nested reads and reviewer dispatches. Direct counts, cutoff rules, and parent exclusions remain unchanged. The JSON preserves each direct-only call bound.

The metadata audit samples at most 40 unique pre-cutoff results for each tool. It reads metadata keys and value types, not command/code text, prompts, or output text. It counts all eligible outer calls by stable tool-call ID. The JSON preserves the source counts and sampled key schemas.

**Codemode retains structured nested traces.** Sampled `nestedCalls` objects contain `calls` and `complete`. Their call entries contain `arguments`, `id`, `name`, `status`, and `durationMs`. Some entries also contain `error`. The sampled `arguments` values are dictionaries. These fields can identify actual nested reads or reviewer dispatches. The installed producer confirms the status and completeness rules. The count now uses these rules.

`details.calls` also contains `args`, `id`, `name`, and `status`. Its sampled `args` values are strings. These previews are not a reliable replacement for structured `nestedCalls.calls.arguments`. This audit does not count text occurrences as calls.

**Sampled bash results have no nested trace.** They contain text content and sometimes truncation metadata. Hidden skill reads and reviewer dispatches remain unobserved. Codemode results without the structured trace schema also remain opaque to this method.

| Source | Tool | Call records | Unique calls | Result records | Unique results | Structured trace results | No structured trace | Missing eligible result |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| pi-main | bash | 18042 | 17400 | 18024 | 17383 | 0 | 17383 | 17 |
| pi-main | codemode | 75 | 75 | 75 | 75 | 62 | 13 | 0 |
| pi-subagents | bash | 951 | 951 | 951 | 951 | 0 | 951 | 0 |
| pi-subagents | codemode | 170 | 170 | 170 | 170 | 170 | 0 | 0 |

### Validated nested counting rules

The installed Pi core defines `ok`, `error`, and `unfinished` statuses. `finish()` maps a non-error outcome to `ok`. A complete trace has no unfinished calls, omitted arguments, or dropped calls. Nested results themselves are not persisted.

The parser requires `complete: true`, `status: ok`, dictionary arguments, and an exact read or reviewer target. It excludes all incomplete traces from positive counts. It preserves identifiable failed, unfinished, incomplete, and unknown-status targets as separate JSON categories.

The producer assigns each nested ID as `<callerId>/<n>`. The parser deduplicates with the outer ID and nested ID. It ignores `details.calls` previews, even when they repeat the same trace. The outer call and result must both have timestamps before the cutoff. Nested records have no separate event timestamps. Their completed result establishes that they finish before the cutoff.

The installed definitions validate the observed schema. Historical records must satisfy that exact schema before they contribute positive counts. The count combines successful direct and nested loads within the load group. It combines direct and nested dispatches within the dispatch group. It takes the maximum across load, command, Skill, and dispatch groups. It does not add a command to its resulting load.

Installed source references: `~/.pi/agent/install/releases/1.3.0/node_modules/@earendil-works/pi-coding-agent/dist/core/nested-tool-calls.js`, lines 11–67 and 99–174. Types: sibling package `pi-ai/dist/types.d.ts`, lines 390–426. Attachment: `pi-coding-agent/dist/core/agent-session.js`, lines 714–725.

The temporary parser passed 17 synthetic parser cases and four bound cases. The cases test success, failure, incomplete traces, duplicates, catalogs, non-calls, cutoff, parent exclusion, and command/load overlap.

Successful nested evidence totals: `{"nested_reviewer_dispatch_success": 24, "nested_skill_read_success": 25}`. Direct-only bounds sum to 907. Combined bounds sum to 956. Nested diagnostics: `{"pi-main": {"complete_traces": 61, "incomplete_traces": 1, "nested_record_status_error": 36, "nested_record_status_ok": 170, "non_target_structured_calls": 156, "opaque_or_omitted_arguments": 18}, "pi-subagents": {"complete_traces": 170, "nested_record_status_error": 34, "nested_record_status_ok": 734, "non_target_structured_calls": 751}}`.


Sampled result counts: `{"bash": 40, "codemode": 40}`. Opaque unique outer call counts: `{"bash": 18351, "codemode": 13}`. These counts include calls with no eligible result. Hidden calls remain unobserved. Structural trace counts do not establish successful nested calls. Results can exist without an eligible outer call. Duplicate records use the same first-source attribution as the main audit.


`claude-history`: `~/.claude/history.jsonl`; `pi-run-history`: `~/.pi/agent/run-history.jsonl`; `pi-observability`: `~/.pi/agent/observability/history.jsonl`; shell sources are `~/.bash_history` and `~/.zsh_history`. Undated shell records cannot satisfy the cutoff and are not invocation evidence. Repository git commit counts are change history only; dates are author/committer metadata, not runtime evidence.

## Limits and reproduction

Reviewer run-history records are only corroboration: 89 retained reviewer entries are not added to transcript dispatches. Jev result/source coverage counts and all-name provider Skill call counts are retained in JSON; recommendations outside the canonical scope yield no per-skill rows. No match is UNKNOWN, not unused.

No retention completeness is assumed. Deleted sessions, other machines/harness roots, non-JSONL transcripts and Bash/flow-mediated reads and dispatches are unobserved. Only complete structured nested traces with confirmed success contribute nested reads and dispatches. Opaque, failed, unfinished, and incomplete traces do not contribute positive counts. Successful reads include research/authoring reads; they must not be presented as completed skill executions. Reads use the canonical skill directory basename and exact SKILL.md path, so renamed/nonstandard install layouts may be missed. Explicit command matching omits ambiguous mid-text references. Branch deduplication depends on preserved IDs. Tool results missing timestamps, after-cutoff results and missing results cannot confirm a call. Source attribution of duplicates uses the first source encountered; union totals remain deduplicated. JSONL records with no timestamp are omitted rather than assigned file mtime.

To repeat this audit, apply the counting definitions and fixed cutoff above to the original JSONL records. Confirm tool results and deduplicate stable IDs. The temporary counting script is research tooling, not part of the proposed review implementation.

Totals: 45 names evidenced, 3 UNKNOWN; 929 deduplicated skill-turn evidence occasions; 80 duplicate evidence records removed.
