# Discovery: conservative pi-jev 0.7.0 auto thinking

Read-only discovery. Only this file was written.

## Current behavior (evidence)
- `pi-jev/src/thinking.ts:38` `ESCALATE` regex matches words like plan/design/review/why/debug/analy[sz]/refactor/audit anywhere in text; `:39` `DEESCALATE` is `^(hi|ok|list|show|status|what is…)` ; `:42` `SHORT_PROMPT_CHARS=240`.
- `:44-62` `classifyThinkingNeed(prompt)`: any ESCALATE hit → `high`, or `xhigh` if `deep` regex (`:49`: root cause|prove|security|architect|migrat|trade-off|optimi[sz]) matches; short DEESCALATE → `minimal`; else `medium`; empty → `minimal`.
- `:123-155` `AutoThinkingRouter.route(prompt, ctx)`: classifies the raw prompt (`:124`), clamps by model (`:137`), skips if unsupported (`:138`) or cache-hostile Anthropic budget thinking (`:141`), unchanged (`:144`), else `pi.setThinkingLevel` (`:147`). No cap, no baseline, no text filtering. `observe()` `:157` records external changes (called from `thinking_level_select`, `extensions/index.ts:117-122`).
- `extensions/index.ts:124-156` `before_agent_start` passes full `event.prompt` (includes `<skill ...>` wrapped skill body + user text) to `autoThinking.route` at `:141` (when `!auto.enabled`) and `:156` (auto path). Hence a skill-wrapped idea-to-pr prompt contains "plan/design/review/security/architecture/migrat…" → high/xhigh.
- Router construction `index.ts:74-77` (already modified by self-improve patch to add `&& !process.env.PI_SELF_IMPROVE_CHILD`); pristine fixture line 74 is one line. Flag default `index.ts:53-58`: `envAutoEnabledFor("PI_JEV_THINKING") && !process.env.PI_SUBAGENT_NAME`.
- Config: `harness/pi/pi-jev-auto.conf` line 1 comment + `PI_JEV_THINKING=1`; `harness/pi/settings.json:4` `defaultThinkingLevel: "medium"` (the "chosen level" baseline).

## Patch/installer conventions
- Patches are unified diffs, `-p1`, relative to pkg root: `harness/pi/patches/pi-jev.patch` (jev.ts, index.ts), `pi-jev-prompt-guard.patch` (touches `src/thinking.ts` lines 41-46: signature `prompt: string | undefined`, `const text = (prompt ?? "").trim();`; and `index.ts:~121` adds `typeof event.prompt` guard), `pi-jev-self-improve-thinking.patch` (index.ts hunk @@ -73,7).
- Installer: `install/modules/patches.sh:97-116` `apply_package_patch PKG LABEL PATCH ENTRY` (reverse dry-run ⇒ "(ok)", forward dry-run+apply ⇒ "(patched)", else fail/untouched). Per-patch wrappers `patches.sh:86-95`. Registration: one long string in `install/main.sh:74` (add `;patch-jev-<new>:$PI_AGENT_DIR/npm/node_modules/pi-jev`), and dispatch block `install/main.sh:131-142` (add `if [ "$type" = "patch-jev-<new>" ]; then install_jev_<new>_patch "$pattern" || PATCH_FAILED=1; continue; fi`).
- `install/tests/install.test.sh` has no thinking-patch specific assertions (grep "thinking" empty); it fixtures `pi-jev-auto.conf` at `:75`. Probably unchanged unless it enumerates patch types (check `:130` area only if main.sh string change breaks it).
- `harness/pi/tests/package-patches.test.sh`: pristine fixture `harness/pi/tests/fixtures/pi-jev-0.7.0/{LICENSE,extensions/index.ts,src/jev.ts,src/thinking.ts}` (tracked, README row at `harness/pi/README.md:20`). Arrays `patches=(…)`/`labels=(…)` `:76-77`; loops `for state in {0..7}` (`:80`), apply subsets via `patch -p1` (`:86-90`), run install twice (`:94-110`) expecting `patched` run1-for-missing, `ok` thereafter (`:102-106`); `for i in 0 1 2` appear at `:86,:102`. Failure-aggregation test `:118-151` mutates a literal in index.ts. Behavior test `:153-201`: node vm harness using `$SB/home-7` (all patches), extracts `thinking.ts` via `stripTypeScriptTypes`, stubs `clampThinkingLevel`/`getSupportedThinkingLevels`, and currently asserts `security root cause` → `xhigh` for main sessions (`:198`) — MUST change.

## Expected patch targets
New file: `harness/pi/patches/pi-jev-conservative-thinking.patch` (name suggestion), label `patch-jev-conservative-thinking`, wrapper `install_jev_conservative_thinking_patch` with entry `src/thinking.ts`.
Order-independence constraint: the test applies all 2^N subsets in any order; prompt-guard hunk edits thinking.ts lines 44-46 (signature, `text` line). New patch must NOT rely on or touch those lines; its context must exist in both states. Safe design:
1. `src/thinking.ts` ~38-42 region (unchanged by guard; keep hunk context ≤ line 43): add helper `userOwnedText(prompt)` — strip `<skill\b[^>]*>[\s\S]*?</skill>`, other tagged system/context blocks (`<system-reminder>`, `<context>`, `<project_context>` etc.), fenced ``` blocks, indented/`>` quoted lines, quoted strings, and `Handoff`/pasted log-like content; return remaining user text. Add `EXPLICIT_XHIGH = /\b(xhigh|x-high|think hard|ultrathink|think harder)\b/i`.
2. Do NOT edit `classifyThinkingNeed` body lines 44-46; instead change its later lines (47-62, outside guard hunk): can't easily without overlapping context of 3 lines (hunk ending line ≥ 46 collides). Alternative that avoids collision: add NEW exported `classifyConservative(prompt)` after line 62 and change `route()` line 124 `const need = classifyThinkingNeed(prompt);` → conservative function. Keep `classifyThinkingNeed` as-is (still used by `commands.ts`? — verify `grep classifyThinkingNeed src/commands.ts`; commands.ts references AutoThinkingRouter only for status).
3. Conservative classify: `text = userOwnedText(prompt ?? "")`; empty → medium (not minimal, since no user text means no signal; spec: default medium); EXPLICIT_XHIGH → xhigh; DEESCALATE && length<240 → minimal; `debug|diagnos|why|root cause|investigat|…` hit → high (keep plain `debug why X fails` → high); everything else medium. Drop `deep`→xhigh path. Decide whether non-debug words like `plan`/`design` stay high; spec only requires `debug why X fails`=high and skill-wrapped idea-to-pr ≠ high (after stripping, residual user text decides, so tests must include the real residual text).
4. Baseline cap in `route()` (lines 123-150): add private `baseline?: ThinkingLevel; applied?: ThinkingLevel`. On entry: `if (!this.baseline || (ctx.thinkingLevel !== this.applied)) this.baseline = ctx.thinkingLevel` (treat any level not set by router as user/CLI/settings choice). Final level = `min(need.level, "high" unless explicit xhigh, rank(baseline)+1)` using order off<minimal<low<medium<high<xhigh<max; explicit xhigh still obeys "no more than one above baseline" only if spec means so — confirm; with medium baseline, xhigh is 2 above, so explicit xhigh needs exemption (flag in handoff). Set `this.applied = level` after `setThinkingLevel`. Note `observe()` (called by `thinking_level_select` for ALL changes incl. router's own) must not clobber baseline when `level === this.applied`; patch `observe` only if needed (it is after `:157`, outside guard hunk).
5. Need `hunk` to import nothing new. `ThinkingLevel` type already includes `max` (`:26`).

index.ts: no change required (route is the single choke point). Optional: nothing for skills, since stripping happens inside thinking.ts.

## Fixture strategy
- Add `harness/pi/tests/fixtures/pi-jev-skill-wrapped-prompt.txt` (or a `.json`): the real idea-to-pr skill-wrapped input (`<skill name="idea-to-pr" location="…">…skill body…</skill>` followed by user request, possibly handoff brief). Source: the live session’s `before_agent_start` event.prompt; if not obtainable, build from `~/.pi/agent/skills/idea-to-pr/SKILL.md` wrapped like Pi's skill expansion plus the real user line (ask parent to confirm exact residual user text — the escalating words in the skill body include plan/design/review/security).
- Test extension in `package-patches.test.sh` behavior block (vm harness at `:156-201`): reuse `AutoThinkingRouter` plus exports (`classify…` function) from vm. Assertions: (a) skill-wrapped fixture, baseline medium → never `high`/`xhigh` (expect medium); (b) `debug why X fails` → `high`; (c) `security root cause` → high (not xhigh); (d) `ultrathink about X`, `use xhigh`, `think hard` → xhigh; (e) baseline `low` + debug → `medium`; baseline `high` stays ≤ xhigh only if explicit; (f) `ok`/`list files` → minimal; (g) content in fenced/quoted/pasted blocks ignored; (h) repeated routes don’t ratchet (baseline retained after router sets level). Update `:198` expectation from `xhigh` to `high`. Add new patch to `patches`/`labels` arrays and change `{0..7}`→`{0..15}`, `for i in 0 1 2`→`0 1 2 3` (two spots, plus mask 1<<i). All-patches fixture dir: `home-7`→`home-15`. Failure test `:128-135` unchanged (targets index.ts literal).
- Check conflict matrix: with 4 patches / 16 states, thinking.ts has two patches (guard + new); new hunks must apply in either order (ensure context avoids lines 44-46).

## Docs/config to update
- `harness/pi/README.md`: add patch table row after line 17 (`pi-jev-conservative-thinking.patch`, applied to `.../pi-jev/src/thinking.ts`); update `:18` description (four patch states) and `:20` fixture row if new fixture added; update pi-jev bullet `:148-155` (user-owned text only, default medium, cap high, xhigh only explicit, ≤ baseline+1); also `:10` mentions thinking enabled — fine.
- `harness/pi/pi-jev-auto.conf:1` comment: note thinking is capped (high; xhigh explicit only, ≤ one above selected level). Comment-only; no new vars.
- `harness/pi/APPEND_SYSTEM.md:112-122` (subagent bounds already cap at high/no xhigh unless explicit) — optionally add one sentence that main-thread Jev auto-thinking is capped at high and ignores skill/handoff text; no required change. Also line `:165` area could mention it.

## Test commands (Node 22 first on PATH)
```
export PATH=$HOME/.nvm/versions/node/v22.23.3/bin:$PATH; node -v   # v22.x required: test uses module.stripTypeScriptTypes (node >=22.13)
git diff --check
bash harness/pi/tests/package-patches.test.sh
bash install/tests/install.test.sh
```
Real-install validation: restore pristine installed package (`~/.pi/agent/npm/node_modules/pi-jev`: note `extensions/index.ts.orig` exists beside patched index.ts; src files lack .orig — restore from `harness/pi/tests/fixtures/pi-jev-0.7.0/` for the 3 files, or reinstall pkg), run `bash install.sh` twice; expect `[patch-jev-conservative-thinking] … (patched)` then `(ok)`; other jev patches `(patched)` then `(ok)`.

## Risks
- Overlap with prompt-guard on thinking.ts (see above) — hunk context collision → "upstream code changed" failures in some of the 16 states. Verify all states.
- `thinking_level_select` fires on router's own `setThinkingLevel` → baseline tracking via `applied`; mis-tracked baseline either ratchets or ignores user `/thinking` changes.
- Cache-hostile Anthropic budget models (`:141`) skip changes entirely; cap logic must precede or be consistent with it.
- Stripping heuristics (quotes, pasted logs) can over-strip real requests; keep conservative: unknown ⇒ medium.
- Test imports the whole thinking.ts through vm with import lines removed; new code must not add imports/`require`.
- `install/main.sh:74` string is a single long line; typos break all patch types.
- Spec ambiguity: explicit xhigh vs "never >1 above baseline" (medium→xhigh = +2). Handoff assumes explicit user request exempt; confirm.
- Self-improve children: router already disabled via index.ts; unaffected.

## Handoff packet
- Create: `harness/pi/patches/pi-jev-conservative-thinking.patch` (src/thinking.ts only; avoid lines 44-46), fixture for skill-wrapped prompt.
- Edit: `install/modules/patches.sh` (wrapper after `:95`), `install/main.sh` (`:74` string + dispatch near `:139`), `harness/pi/tests/package-patches.test.sh` (arrays, state loops, behavior test, `:198`), `harness/pi/README.md` rows/bullets, `harness/pi/pi-jev-auto.conf` comment, optionally `harness/pi/APPEND_SYSTEM.md`.
- Start: `/home/noel/.pi/agent/npm/node_modules/pi-jev/src/thinking.ts` (reference) and fixture copy `harness/pi/tests/fixtures/pi-jev-0.7.0/src/thinking.ts`; generate patch with `diff -u` from pristine+prompt-guard-applied copy, verify applies to pristine too.
