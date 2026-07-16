#!/usr/bin/env bash
# Resolve how to invoke playwright-cli in this environment and print it:
#   "playwright-cli"       global binary on PATH
#   "npx playwright cli"   local @playwright/cli package
# Exit 3 (printing nothing) when neither is available, so the caller can gate
# and stop to ask before installing.
set -uo pipefail

if command -v playwright-cli >/dev/null 2>&1; then
  printf '%s\n' "playwright-cli"
  exit 0
fi

if npx --no-install playwright --version >/dev/null 2>&1; then
  printf '%s\n' "npx playwright cli"
  exit 0
fi

exit 3
