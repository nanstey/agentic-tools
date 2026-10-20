# Proposal: conservative pi-jev 0.7.0 auto thinking

Sources: [discovery](./discovery.md); fixture `harness/pi/tests/fixtures/pi-jev-0.7.0/src/thinking.ts`; `harness/pi/tests/package-patches.test.sh`; `install/main.sh`; `install/modules/patches.sh`.

## Purpose
Auto thinking in pi-jev v0.7.0 classifies the whole `event.prompt`. That prompt includes the expanded `<skill>` body, handoff briefs, pasted files and logs. A skill-wrapped prompt therefore matches words such as plan/design/review/security/architecture and is routed to `high` or `xhigh`. Fix it so the router reads only user-authored text, defaults to `medium`, and never rises more than one level above the user's chosen level. It runs offline with regexes only, so it is cheap and testable.

## Scenarios
1. Skill-wrapped real failing input → `medium`.
2. Plain `debug why X fails` → `high`.
3. Keyword alone (`security root cause`) → `high`, never `xhigh`.
4. Explicit `ultrathink` / `think hard` / `xhigh` → `xhigh`, but only if the baseline allows it (baseline + 1).
5. `ok`, `list files` → `minimal` (short mechanical de-escalation kept).
6. Keywords inside fenced code, quoted lines, pasted logs, tagged blocks or handoff sections are ignored.
7. Repeated prompts do not ratchet upward. The router's own changes never become the new baseline.

## Behavior (Given / When / Then)
- Given baseline `medium` and a skill-wrapped prompt, when the user text carries no high-intent keyword, then the level is `medium`.
- Given baseline `medium` and `debug why X fails`, then `high`.
- Given baseline `medium` and `security root cause`, then `high`.
- Given baseline `medium` and `think hard about X` or `ultrathink` or `use xhigh`, then `high` (cap baseline+1 applies to explicit xhigh).
- Given baseline `high` and explicit `ultrathink`, then `xhigh`.
- Given baseline `low` and `debug why X fails`, then `medium` (baseline+1).
- Given baseline `medium` and `ok`, then `minimal` (down is always allowed).
- Given the router set `high` last turn and the user changes nothing, when the next prompt is plain, then `medium` is derived from the retained baseline `medium`.
- Given the user changes the level (CLI, settings, `/thinking`), then that level becomes the new baseline.
- Given empty or fully stripped user text, then `medium` (no signal, not `minimal`).
- Given a model that is unsupported or cache-hostile (budget Anthropic), existing skip behavior is unchanged. The cap is applied before clamping and these checks.
- Rank order: off < minimal < low < medium < high < xhigh < max. The automatic ceiling is `high` unless the explicit-xhigh regex matches. The final level is `min(need, ceiling, baseline+1)`. De-escalation below baseline is not capped.

## QA
Automated, offline, in `harness/pi/tests/package-patches.test.sh` (vm harness, Node ≥ 22.13):
- Skill-wrapped fixture at baseline `medium` → `medium`.
- `debug why X fails` → `high`.
- `security root cause` → `high`.
- `ultrathink` / `think hard` / `xhigh` at baseline `medium` → `high`; at baseline `high` → `xhigh`.
- Baseline `low` + debug → `medium`.
- `ok` and `list files` → `minimal`.
- Fenced, `>` quoted, tag-block, and log content is ignored.
- Two consecutive routes (debug, then plain) do not ratchet.
- A user baseline change between routes is honored.
- Existing `:198` expectation changes from `xhigh` to `high`.
- Install idempotence over all 16 patch-order subsets (see below).

## Architecture
Single choke point: `AutoThinkingRouter.route()` in `src/thinking.ts`. `extensions/index.ts` is untouched because it already passes the full prompt to `route()`. A new patch, `harness/pi/patches/pi-jev-conservative-thinking.patch`, touches `src/thinking.ts` only.

1. **User-text filter** `userOwnedText(prompt)`. Strip in order:
   - paired tag blocks, `<tag ...>…</tag>`, via a back-reference regex. This covers `skill`, `file`, `system-reminder`, `project_context`, and similar. An unclosed opening tag strips to the end of the text.
   - fenced ``` blocks.
   - from a heading line such as `# Handoff|Context|Brief` to the end of the text.
   - lines starting with `>`, a tab or four spaces.
   - lines that look like logs: timestamps, `at x (file:line)`, `ERROR|WARN|Traceback`, leading `$ `.
   - quoted strings: `"…"`, `“…”`, and backtick spans.
   - Keep what is left, trimmed.
2. **New exported `classifyConservative(prompt)`**, added after `classifyThinkingNeed`. The old function stays as is.
   - `text = userOwnedText(prompt ?? "")`.
   - Empty → `medium`.
   - `EXPLICIT_XHIGH = /\b(xhigh|x-high|think hard(er)?|ultrathink)\b/i` → `{level:"xhigh", explicit:true}`.
   - `DEESCALATE` (existing regex) and length < `SHORT_PROMPT_CHARS` → `minimal`.
   - `HIGH_INTENT` and length ≤ 600 → `high`. `HIGH_INTENT = /\b(debug|diagnos|root cause|investigat|trade-?off|architect|security|audit|why\b[^.?!]{0,80}\b(fail|broke|error|crash|slow|wrong|not))\b/i`. Broad words (plan, design, review, reason, complex, analy*, refactor, optimi*, bare `why`) are dropped.
   - Otherwise `medium`. No `deep` → `xhigh` path.
3. **Baseline and cap** in `AutoThinkingRouter`. New private fields `baseline?` and `applied?`. In `route()`:
   - If `ctx.thinkingLevel !== this.applied`, set `baseline = ctx.thinkingLevel`.
   - Compute `final = min(need.level, explicit ? xhigh : high, rank(baseline)+1)`. If there is no baseline, use `medium`.
   - Set `this.applied = final` before `pi.setThinkingLevel`, because the `thinking_level_select` event can fire synchronously. Reset it on error.
   - `observe(level)`: if `level !== this.applied`, set `baseline = level`.
   - The clamp, cache-hostile and unchanged checks then use `final`.
4. **Patch-order constraint.** The existing `pi-jev-prompt-guard.patch` edits `src/thinking.ts` lines ~41-49 (the `classifyThinkingNeed` signature to `prompt: string | undefined`, and the `const text = (prompt ?? "").trim();` line). The new patch must not touch or carry context from those lines. Its hunks are:
   - (a) additions after `classifyThinkingNeed`'s closing brace (context from lines ~59-63).
   - (b) new fields in the class (~line 118).
   - (c) the `route()` first line and body (~123-150).
   - (d) `observe()` (~157).
   - Both patches must apply to pristine, to each other's output, and in either order. The installer treats a failed forward and reverse dry-run as an error, so verify all 2^4 = 16 subsets. Also, `route(prompt: string, …)` must remain compatible with the guard's `string | undefined`. `classifyConservative` takes `prompt: string | undefined`.
   - The patch is generated with `diff -u` from the pristine fixture and checked against the guard-applied copy. Both guard-first and conservative-first orders are applied in the test.
5. **Installer.** Add the wrapper `install_jev_conservative_thinking_patch` in `install/modules/patches.sh` after the existing wrappers (~:95), using `apply_package_patch … src/thinking.ts`. In `install/main.sh` add `;patch-jev-conservative-thinking:$PI_AGENT_DIR/npm/node_modules/pi-jev` to the string at :74 and a dispatch `if` beside :131-142.

## Rejected alternative
Make the filter ignore only `<skill>` tags and leave the existing regex otherwise unchanged, or edit `classifyThinkingNeed` in place. Pasted logs and handoffs would still escalate. An in-place edit also collides with the prompt-guard hunk on lines 44-46 and breaks order independence. Also rejected: an online or LLM classifier. It costs latency and money and cannot be tested offline. Also rejected: patching `extensions/index.ts` to strip skills. The text would be filtered in a different file from the one that classifies, and the self-improve patch already touches that file.

## Affected files
- New: `harness/pi/patches/pi-jev-conservative-thinking.patch`.
- New: `harness/pi/tests/fixtures/pi-jev-skill-wrapped-prompt.txt` (the real failing input, captured from `before_agent_start`. If it is not available, rebuild the `<skill name="idea-to-pr" …>` wrapper around `~/.pi/agent/skills/idea-to-pr/SKILL.md` plus the real user line and note that in the test).
- Edit: `install/modules/patches.sh`, `install/main.sh`.
- Edit: `harness/pi/tests/package-patches.test.sh`:
  - add the patch to the `patches` and `labels` arrays.
  - change `{0..7}` to `{0..15}` and `for i in 0 1 2` to `0 1 2 3` at both spots.
  - rename `home-7` to `home-15`.
  - update the behavior assertions and the `:198` expectation.
- Edit: `harness/pi/README.md`: add a patch table row, update the :18 state-count text, add the fixture row, and rewrite the pi-jev bullet (~:148-155) for user-owned text, `medium` default, `high` cap, explicit xhigh, and baseline+1.
- Edit: `harness/pi/pi-jev-auto.conf`: comment only (line 1).
- Optional: one sentence in `harness/pi/APPEND_SYSTEM.md` (~:112-122).
- `README.md` catalog: no change, because no skill or agent is added.
- Untouched: `extensions/index.ts`, existing patches, `install/tests/install.test.sh` (re-run only).

## Slice (single phase, one commit, one PR)
Implement everything above together. The patch, installer registration, tests and docs ship together. Splitting them would leave the test arrays or installer inconsistent.

## Validation (exact)
```
export PATH=$HOME/.nvm/versions/node/v22.23.3/bin:$PATH; node -v   # must be v22.x
git diff --check
bash harness/pi/tests/package-patches.test.sh
bash install/tests/install.test.sh
```
Then run a real-install check. Restore the installed `pi-jev` files `src/thinking.ts`, `src/jev.ts` and `extensions/index.ts` from `harness/pi/tests/fixtures/pi-jev-0.7.0/`. Run `bash install.sh` twice. Expect `[patch-jev-conservative-thinking] … (patched)` and then `(ok)`, and the same for the other jev patches. Check that the patch applies cleanly in all 16 order subsets.

## Risks
- Hunk context collisions with prompt-guard in some subsets. The 16-subset test is the guard.
- Baseline tracking with `applied` and `observe` can ratchet or ignore user `/thinking` changes. The test must cover both.
- Over-stripping could hide a real request. Unknown input falls back to `medium`.
- The new code must not add imports, because the vm harness strips them.
- A typo in the single long `install/main.sh:74` string would break every patch type.
- The real failing input must be captured for the fixture. If it can't be, state the substitute in the test.
