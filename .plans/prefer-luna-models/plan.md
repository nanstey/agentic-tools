# Prefer Luna for Codex policy

## Outcome
Codex-backed worker and fallback policy uses `openai-codex/gpt-6-luna` instead of Terra or Sol, reducing credit use while preserving thinking levels and all Anthropic cells.

## Acceptance
- A1. When policy is read, worker and Anthropic-work reviewer tiers all specify Luna with existing thinking levels, and no policy setting uses Terra or Sol. Check (`code`): grep policy files; no Terra/Sol matches except the intentional fixture. 
- A2. When fallback/self-improve config is read, the applicable model settings specify Luna and thinking values remain unchanged. Check (`code`): `python3 -m json.tool` on both JSON files.
- A3. When package-patches regression suite runs, it passes and the Terra fixture remains unchanged. Check (`code`): `bash harness/pi/tests/package-patches.test.sh`.
- A4. When repository changes are reviewed, unrelated Anthropic cells and fixture behavior remain unchanged. Check (`code`): diff review and relevant tests.

## Decisions
- 2026-10-03: Use Luna in every OpenAI Codex tier including premium, as explicitly requested; retain each existing thinking level. Premium-only Sol can be restored later if desired.

## Assumptions
- Repository's existing `.plans/` directory is the appropriate location for an uncommitted plan.

## Evidence
- `harness/pi/APPEND_SYSTEM.md` has worker and reviewer-of-Anthropic policy rows with Luna quick, Terra standard/high, and Sol premium.
- `harness/pi/extensions/pi-fallback.json`, `harness/pi/self-improve.json`, and `harness/pi/README.md` document/configure Terra.
- `harness/pi/tests/package-patches.test.sh` includes Terra as a managed-thinking fixture.
- `/home/noel/.pi/agent/models-store.json` identifies `openai-codex/gpt-6-luna` with `reasoning: true`.

## Approach
Replace Terra/Sol with Luna in the requested policy/config/documentation locations. Keep the fixture and all thinking levels unchanged. Search for remaining policy mentions, validate JSON and run the requested regression suite, then commit and open a review-ready PR against main.

## Risks and unknowns
- The package regression test may encode assumptions about Terra; if so, change only what is needed to retain meaningful coverage and explain it.
- Luna's reasoning support is confirmed in the local model store; actual availability remains dependent on provider authentication.

## Out of scope
Changing Anthropic model cells, thinking levels, or unrelated model references.

## Open questions
None.
