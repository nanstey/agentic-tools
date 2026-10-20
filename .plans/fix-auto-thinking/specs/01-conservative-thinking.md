# Slice 01: Conservative Pi-Jev Automatic Thinking

## Objective
Ship one reviewable PR that applies a conservative automatic-thinking policy to pi-jev v0.7.0.

## Implementation
- [x] Create `harness/pi/patches/pi-jev-conservative-thinking.patch` against `src/thinking.ts`.
  - Add extraction of user-owned text that removes injected `<skill>` bodies, tagged context blocks, fenced content, quoted content, and log or handoff content.
  - Keep empty or fully removed input at `medium`.
  - Keep short mechanical de-escalation at `minimal`.
  - Return `high` for a short user-authored debugging request such as `debug why X fails`.
  - Treat `security root cause` as `high`, not `xhigh`.
  - Permit `xhigh` only for explicit user intent such as `xhigh`, `think hard`, or `ultrathink`.
  - Cap automatic results at one rank above the user-selected baseline. This cap applies to explicit intent.
  - Keep a stable baseline across router-originated changes and accept later external user level changes as a new baseline.
  - Do not alter the existing `classifyThinkingNeed` lines changed by `pi-jev-prompt-guard.patch`.
- [x] Add `harness/pi/tests/fixtures/pi-jev-skill-wrapped-prompt.txt` with a representative real failing shape. It must include an idea-to-pr `<skill>` block and a plain user request that should stay `medium`.
- [x] Extend `harness/pi/tests/package-patches.test.sh`.
  - Add the new patch to the patch and label arrays.
  - Test all 16 patch subsets and both patch orders.
  - Test skill-wrapped input, debug request, xhigh intent with medium and high baselines, low baseline cap, mechanical de-escalation, ignored quoted or pasted text, no ratchet, and an external baseline update.
- [x] Register the patch in `install/modules/patches.sh` and `install/main.sh` with the existing idempotent package-patch pattern.
- [x] Update `harness/pi/README.md` and `harness/pi/pi-jev-auto.conf` to state the new patch and conservative bounds.
- [x] Update `.plans/fix-auto-thinking/README.md` only after validation succeeds.

## Test Scenarios
- [x] Given a medium baseline and an idea-to-pr skill-wrapped prompt, when auto-thinking routes it, then the result is `medium`.
- [x] Given `debug why X fails`, when auto-thinking routes it from medium, then the result is `high`.
- [x] Given `security root cause`, when auto-thinking routes it from medium, then the result is `high`.
- [x] Given `ultrathink` from medium, when auto-thinking routes it, then the result is `high`.
- [x] Given `ultrathink` from high, when auto-thinking routes it, then the result is `xhigh`.
- [x] Given a low baseline and `debug why X fails`, when auto-thinking routes it, then the result is `medium`.
- [x] Given `ok` or `list files`, when auto-thinking routes it, then the result is `minimal`.
- [x] Given escalator words only in a removed block, when auto-thinking routes it, then the result is `medium`.
- [x] Given a router change followed by a plain request, when auto-thinking routes again, then it does not raise the baseline.
- [x] Given a later external user level change, when auto-thinking routes again, then it uses that new baseline.

## Validation
```sh
export PATH=$HOME/.nvm/versions/node/v22.23.3/bin:$PATH
node -v
git diff --check
bash harness/pi/tests/package-patches.test.sh
bash install/tests/install.test.sh
```
Restore pristine installed pi-jev files, then run `bash install.sh` twice. The new patch must report `(patched)` then `(ok)`.

## Risk Controls
- Keep new patch hunks independent of prompt-guard hunks.
- Use no online model or new runtime dependency.
- Preserve cache-hostile and model-support guards.

## Out of Scope
- Changes to the existing `pi-jev-self-improve-thinking.patch`.
- Changes outside the pi-jev automatic-thinking integration.
