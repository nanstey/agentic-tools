#!/usr/bin/env bash
# Package patch definitions; sourcing this file performs no installation.

# pi-diff@0.9.3 catches native dynamic-import failures inside its factory, so
# jiti never retries those imports with Pi's host SDK aliases. Static imports
# let jiti supply the host modules without installing a duplicate SDK. Hoisting
# alone cannot fix this: Pi deliberately suppresses host peer installation.
install_diff_sdk_patch() {
  apply_package_patch "$1" patch-diff-sdk "$REPO_ROOT/harness/pi/patches/pi-diff-sdk-imports.patch" dist/index.js
}

# Idempotent literal patch of an installed third-party package file.
# Usage: patch_installed_file LABEL TARGET MARKER OLD NEW
# Skips (0) when TARGET is not installed yet, reports ok (0) when MARKER is
# already present, patches (0) when OLD occurs exactly once, and otherwise
# leaves the file untouched and returns 1 (also when python3 is missing).
patch_installed_file() {
  local label="$1" target="$2" marker="$3" old="$4" new="$5"
  if [ ! -f "$target" ]; then
    echo "  [$label] $target not installed yet, skipping (re-run install.sh after pi installs packages)"; return 0
  fi
  if grep -qF -- "$marker" "$target"; then
    echo "  [$label] -> $target (ok)"; return 0
  fi
  if ! command -v python3 >/dev/null 2>&1; then
    echo "  [$label] python3 not found; $target NOT patched" >&2; return 1
  fi
  if PATCH_OLD="$old" PATCH_NEW="$new" python3 - "$target" <<'PY'
import os, sys
p = sys.argv[1]
s = open(p).read()
old, new = os.environ["PATCH_OLD"], os.environ["PATCH_NEW"]
if s.count(old) != 1:
    sys.exit(1)
open(p, "w").write(s.replace(old, new))
PY
  then
    echo "  [$label] -> $target (patched)"
  else
    echo "  [$label] upstream code changed; $target NOT patched. Update the patch in install.sh or drop it if upstream fixed this." >&2
    return 1
  fi
}

# pi-fallback-models@0.1.1 classifies Anthropic's "You're out of extra usage"
# 400 invalid_request_error as ignorable, so no fallback happens on the exact
# failure that motivated it. Add that phrase to its quota patterns. Remove once
# upstream recognizes it.
install_fallback_quota_patch() {
  patch_installed_file patch-fallback "$1" '|out of extra usage/i;' \
'|plan limit|no more (?:fast )?requests|billing/i;' \
'|plan limit|no more (?:fast )?requests|billing|out of extra usage/i;'
}

# pi-fallback-models@0.1.1 can switch reviewers to the producer's provider.
# Restrict fallback candidates before either the switch bus or setModel runs.
# Keep this separate from the quota patch for installations that already have it.
install_fallback_reviewer_lock_patch() {
  apply_package_patch "$1" patch-fallback-reviewer-lock "$REPO_ROOT/harness/pi/patches/pi-fallback-reviewer-provider-lock.patch" src/extension.ts
}

# @maplezzk/pi-interactive-subagents@3.16.4 derives the widget's denied list
# from a Set now, so the former literal patch no longer matches. Hide only the
# display list; keep deniedTools intact for tool-registration enforcement.
# Remove once upstream makes the list optional.
install_subagent_widget_patch() {
  apply_package_patch "$1" patch-subagent-widget "$REPO_ROOT/harness/pi/patches/pi-subagent-widget-3.16.patch" pi-extension/subagents/subagent-done.ts
}

# @maplezzk/pi-interactive-subagents@3.16.4 accepts a text-less
# subagent_done call and exits before the agent sends a summary. Require either
# a prior assistant summary or a result. Keep this separate from the widget
# patch so installations that already have it receive this fix too.
install_subagent_done_summary_patch() {
  apply_package_patch "$1" patch-subagent-done-summary "$REPO_ROOT/harness/pi/patches/pi-subagent-done-requires-summary.patch" pi-extension/subagents/subagent-done.ts
}

# pi-jev@0.7.0 builds its SDK client once and keeps a stale base URL, so a
# profile switch keeps billing the first profile's key and endpoint. It also reads
# only TYPESAFE_API_KEY (shared with Pi's native classifier) and auto-adjusts
# thinking inside subagents. Apply harness/pi/patches/pi-jev.patch (a unified
# diff) to rebuild the client when the key or base URL changes, prefer
# PI_JEV_API_KEY, and skip auto-thinking in subagents. Remove once upstream does.
install_jev_client_patch() {
  apply_package_patch "$1" patch-jev-client "$REPO_ROOT/harness/pi/patches/pi-jev.patch" src/jev.ts
}

# pi-jev@0.7.0 assumes before_agent_start's event.prompt is a string, but runs
# started by sendCustomMessage (e.g. subagent results) have none, so
# classifyThinkingNeed throws "Cannot read properties of undefined (reading
# 'trim')". Apply harness/pi/patches/pi-jev-prompt-guard.patch. Kept separate from
# pi-jev.patch so machines that already applied that one still get this fix.
# Remove once upstream guards it.
install_jev_prompt_guard_patch() {
  apply_package_patch "$1" patch-jev-prompt-guard "$REPO_ROOT/harness/pi/patches/pi-jev-prompt-guard.patch" src/jev.ts
}

# pi-jev@0.7.0 classifies injected skill and context text as though the user
# wrote it. Route only user-owned text with conservative escalation and retain
# the user-selected thinking baseline. Keep this separate from prompt-guard.
install_jev_conservative_thinking_patch() {
  apply_package_patch "$1" patch-jev-conservative-thinking "$REPO_ROOT/harness/pi/patches/pi-jev-conservative-thinking.patch" src/thinking.ts
}

# pi-jev@0.7.0 otherwise enables automatic thinking in self-improvement workers
# and reflections. Disable only their router at construction so explicit or
# inherited thinking remains unchanged. Keep this separate from pi-jev.patch.
install_jev_self_improve_thinking_patch() {
  apply_package_patch "$1" patch-jev-self-improve-thinking "$REPO_ROOT/harness/pi/patches/pi-jev-self-improve-thinking.patch" extensions/index.ts
}

apply_package_patch() {
  local pkg="$1" label="$2" patch_file="$3" entry="$4"
  if [ ! -f "$pkg/$entry" ]; then
    echo "  [$label] $pkg not installed yet, skipping (re-run install.sh after pi installs packages)"; return 0
  fi
  if ! command -v patch >/dev/null 2>&1; then
    echo "  [$label] patch not found; $pkg NOT patched" >&2; return 1
  fi
  if patch -R -p1 -s -f --dry-run -d "$pkg" <"$patch_file" >/dev/null 2>&1; then
    echo "  [$label] -> $pkg (ok)"; return 0
  fi
  # Dry-run first: a multi-hunk patch can otherwise fail halfway and leave the package half-patched.
  if patch -p1 -s -f --dry-run -d "$pkg" <"$patch_file" >/dev/null 2>&1 \
    && patch -p1 -s -f -d "$pkg" <"$patch_file" >/dev/null 2>&1; then
    echo "  [$label] -> $pkg (patched)"
  else
    echo "  [$label] upstream code changed; $pkg NOT patched. Update $patch_file or drop it if upstream fixed this." >&2
    return 1
  fi
}
