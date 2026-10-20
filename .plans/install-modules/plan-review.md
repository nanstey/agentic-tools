# Installer plan review

## Review

**PASS — no required plan corrections.** Reviewed `discovery.md`, `proposal.md`, and `specs/01-install-modules.md` against `AGENTS.md`, the unchanged root installer, tool orchestrator, and both package regression tests at base `3720046`.

- Correct: unconditional main invocation and same-shell extraction preserve the relevant errexit context; dynamic scope, RETURN traps and process-wide umask are explicit preservation requirements (`proposal.md:40,52-54`; `specs/01-install-modules.md:46`; `install.sh:267-279,310-329,473-500`).
- Correct: legacy git-root/caller-PWD fallback is retained rather than replaced by unconditional module-root resource selection; worktree, external-CWD and non-git coverage is specified (`proposal.md:52`; `specs/01-install-modules.md:36`; `install.sh:4,252-265`).
- Correct: definition-only imports and post-environment registry construction are explicit, with isolated import coverage (`proposal.md:52`; `specs/01-install-modules.md:32-33`; `install.sh:8-26`).
- Correct: the patch test's source-text coupling is replaced without dropping its assertions; extension smoke assertions remain unchanged (`proposal.md:32,62`; `harness/pi/tests/package-patches.test.sh:9-33`; `harness/pi/tests/package-extensions.test.mjs:19-63`).
- Correct: fixture parity, CLI checks, provisioning and failure-path tests are proportional to a whole-installer extraction. Isolation, recording stubs, no network/live mutation, narrow normalization and baseline readiness are explicit gates (`proposal.md:26-36`; `specs/01-install-modules.md:29-48`).

Validation performed: `bash -n install.sh`, `bash -n tools/install.sh`, and `bash harness/pi/tests/package-patches.test.sh` passed. The latter used only its temporary package fixture. No installer or live-package mutation was run. Planned modular and extension-fixture gates remain implementation-stage work, not verified passes.

Review provenance limitation: this session reports `PI_PROVIDER=openai-codex` and `PI_MODEL=gpt-6.1-sol`; this is a separate review session, but it does **not** satisfy the requested Anthropic cross-provider verification. An Anthropic review is still needed if that independence requirement is mandatory.
