# Review: conservative pi-jev thinking (independent)

Verdict: **APPROVE** (no blockers; two non-blocking notes)

## Commands (Node v22.23.3 first on PATH)
- `git diff --check` -> exit 0, no output.
- `bash harness/pi/tests/package-patches.test.sh` -> exit 0. All 16 Jev patch states passed (install -> all `ok` on rerun), the failed self-improve aggregate test passed, and `ok: conservative user-owned thinking policy and baseline caps` passed.
- `bash install/tests/install.test.sh` -> all `ok:` lines, no failure.
- Independent check: applied prompt-guard then conservative to the pristine fixture in a temp dir; both applied cleanly.

## Scenario results
Test file `harness/pi/tests/package-patches.test.sh` (about :171-228), run through the vm harness on the fully patched package:
- Skill-wrapped fixture at medium -> medium: PASS
- `debug why X fails` -> high; `security root cause` -> high (never xhigh): PASS
- `ultrathink this` / `think hard about this` / `use xhigh`: medium baseline -> high, high baseline -> xhigh: PASS
- Low baseline + debug -> medium: PASS
- `ok`, `list files` -> minimal: PASS
- Ignored content (`> `, fence, `<context>` block, log line, `# Handoff`) -> medium: PASS
- No ratchet after router change, then plain prompt -> medium: PASS
- External user change to low, then debug -> medium (new baseline honored): PASS
- Existing `security root cause` main-session case now expects high; worker/disabled cases unchanged: PASS
- Patch order/state: all 16 subsets, installer reports `patched` then `ok` for all four Jev patches: PASS

## Requirement checks
- User-owned text only: `userOwnedText` in `harness/pi/patches/pi-jev-conservative-thinking.patch` strips tag blocks, an unclosed tag to the end, fences, handoff headings, quote/indent/log lines, and quoted spans. Empty or stripped text -> medium.
- Cap: `route()` computes `min(need, ceiling(high, or xhigh if explicit), baseline+1)`. This applies to explicit xhigh. De-escalation is uncapped.
- Baseline: `applied` is set before `setThinkingLevel`, so a synchronous `thinking_level_select` -> `observe()` (index.ts:117-118) does not ratchet. An external level sets the baseline. On error, `applied` is reset.
- Model support and cache-hostile checks run after the cap and are unchanged. Only `desired` is substituted. No new dependency or imports; regex only.
- Hunks avoid the prompt-guard lines; `route()` already accepts `string | undefined`.
- Installer: `install/main.sh` registers `patch-jev-conservative-thinking` in the HARNESSES string and dispatch. `install/modules/patches.sh` has the wrapper using the idempotent `apply_package_patch`. Rerun is `ok` in all states.
- Docs: `harness/pi/README.md` table rows, fixture row, and pi-jev bullet match behavior. The `pi-jev-auto.conf` comment matches. No catalog change needed.

## Notes (non-blocking)
1. Observation: `HIGH_INTENT` puts `\b` after stems (`diagnos`, `investigat`, `architect`). Impact: I ran the patched classifier. `diagnose the crash` and `review the architecture` return medium, but `investigate why the build is slow` returns high, via the `why ... slow` branch. The stem terms silently fail on their common word forms. This is the spec's own regex, so it is conformant; it only makes escalation more conservative. Would you be open to `\b` -> `\w*\b` on the stems as a follow-up?
2. Observation: `EXPLICIT_XHIGH` matches negations (`Please don't think harder` -> xhigh candidate). Impact: capped by baseline+1, so it is low risk. Would you be open to leaving it as is?
3. Observation: baseline updates in `observe()` are skipped when a user explicitly selects a level equal to the router's currently applied one. Impact: the baseline is not updated, which is rare and benign (still within one rank of the selection). No action needed.
4. The proposal's real-install check (restore installed files, `install.sh` twice) was not rerun. Sandboxed installs in the test cover it for all 16 states.
5. `.plans/fix-auto-thinking/` untracked is expected.
