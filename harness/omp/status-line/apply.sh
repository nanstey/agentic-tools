#!/usr/bin/env bash
set -euo pipefail

omp_bin="${OMP_BIN:-omp}"
agent_dir="${1:-${PI_CODING_AGENT_DIR:-$HOME/.omp/agent}}"

if ! command -v "$omp_bin" >/dev/null 2>&1; then
  echo "  [status-line] omp unavailable, skipping"
  exit 0
fi
updated=0

run_omp() {
  env -u OMP_PROFILE PI_CODING_AGENT_DIR="$agent_dir" "$omp_bin" "$@"
}

ensure_setting() {
  local key="$1" value="$2" current
  current="$(run_omp config get "$key")"
  if [ "$current" != "$value" ]; then
    run_omp config set "$key" "$value" >/dev/null
    updated=$((updated + 1))
  fi
}

# Keep this list explicit: these are the only config keys this applicator owns.
ensure_setting "symbolPreset" "nerd"
ensure_setting "statusLine.preset" "custom"
ensure_setting "statusLine.separator" "powerline"
ensure_setting "statusLine.contextLine" "off"
ensure_setting "statusLine.compactThinkingLevel" "true"
ensure_setting "statusLine.transparent" "true"
ensure_setting "statusLine.sessionAccent" "true"
ensure_setting "statusLine.leftSegments" '["model","context_pct","git","session_name"]'
ensure_setting "statusLine.rightSegments" '["time_spent"]'
ensure_setting "statusLine.segmentOptions" '{"model":{"showThinkingLevel":true},"git":{"showBranch":true,"showStaged":true,"showUnstaged":true,"showUntracked":true}}'

if [ "$updated" -eq 0 ]; then
  echo "  [status-line] -> $agent_dir (ok)"
else
  echo "  [status-line] -> $agent_dir ($updated settings updated)"
fi
