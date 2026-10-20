#!/usr/bin/env bash
# Initialize context before loading helpers, as in the root installer.

install_usage() {
  cat <<EOF
Usage: $0 [--tools | --tool TOOL | --help]

With no arguments, install skills, agents and harness configuration, then report tool status.

Options:
  --tools      Run normal installation, install all tools, then report status
  --tool TOOL  Run normal installation, install one tool, then report status
  --help       Show this help without installation or checks

Use exactly one action. Tool names also accept underscores, such as gh_stack.
TOOLS_SKIP and TOOLS_INTERACTIVE pass through to the tools CLI.

Examples from the repository root:
  ./install.sh
  ./install.sh --tools
  ./install.sh --tool gh
EOF
}

install_main() {
  local action= tool= tools_installer= tool_status=0
  if [ "$#" -gt 0 ]; then
    case "$1" in
      --help|--tools)
        if [ "$#" -ne 1 ]; then
          echo "install.sh: $1 must be used alone" >&2
          return 1
        fi
        if [ "$1" = --help ]; then install_usage; return 0; fi
        action=all
        ;;
      --tool)
        if [ "$#" -ne 2 ] || [ -z "$2" ]; then
          echo "install.sh: --tool requires exactly one nonempty tool name" >&2
          return 1
        fi
        action=one; tool="$2"
        ;;
      *)
        echo "install.sh: invalid arguments. Use --help for usage." >&2
        return 1
        ;;
    esac
    tools_installer="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/tools/install.sh"
    if [ "$action" = one ]; then
      bash "$tools_installer" --validate "$tool" >&2 || return 1
    fi
  fi

  REPO_ROOT="$(cd "$(git -C "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)" rev-parse --show-toplevel 2>/dev/null || echo "$PWD")" && pwd)"

  # Load machine-local installer environment when the calling shell did not
  # already provide the key. The git-ignored file accepts shell assignments.
  if [ -z "${TYPESAFE_API_KEY:-}" ] && [ -f "$REPO_ROOT/.env" ]; then
    set -a
    # shellcheck disable=SC1091
    . "$REPO_ROOT/.env"
    set +a
  fi
  PI_AGENT_DIR="${PI_CODING_AGENT_DIR:-$HOME/.pi/agent}"

  # Each harness declares: name | detect_dir | binaries | type:dir;type:dir;...
  # A harness installs only the artifact types it lists. Add a "type:dir" pair to
  # teach a harness about a new type; add a row to support a new harness.
  # A dir may be a glob (e.g. one skills dir per profile): it expands to
  # every existing match, so a single pair can fan out to many destinations.
  HARNESSES=(
    "claude|$HOME/.claude|claude|skills:$HOME/.claude/skills;agents:$HOME/.claude/agents"
    "pi|$PI_AGENT_DIR|pi|skills:$PI_AGENT_DIR/skills;agents:$PI_AGENT_DIR/agents;config:$PI_AGENT_DIR::$REPO_ROOT/harness/pi;config:$PI_AGENT_DIR/extensions::$REPO_ROOT/harness/pi/extensions;config:$PI_AGENT_DIR/bin::$REPO_ROOT/harness/pi/bin;config:$PI_AGENT_DIR/prompts::$REPO_ROOT/harness/pi/prompts;config:$PI_AGENT_DIR/extensions/pi-interactive-subagents::$REPO_ROOT/harness/pi/extensions/pi-interactive-subagents;config:$PI_AGENT_DIR/extensions/pi-extensions-i18n::$REPO_ROOT/harness/pi/extensions/pi-extensions-i18n;config:$PI_AGENT_DIR/intercom::$REPO_ROOT/harness/pi/extensions/pi-intercom;hoist:$PI_AGENT_DIR/npm::$REPO_ROOT/harness/pi/settings.json;vendor-git:$PI_AGENT_DIR/vendor::$REPO_ROOT/harness/pi/vendor;patch-diff-sdk:$PI_AGENT_DIR/npm/node_modules/@heyhuynhgiabuu/pi-diff;patch-fallback:$PI_AGENT_DIR/npm/node_modules/pi-fallback-models/src/extension.ts;patch-fallback-reviewer-lock:$PI_AGENT_DIR/npm/node_modules/pi-fallback-models;patch-subagent-widget:$PI_AGENT_DIR/npm/node_modules/@maplezzk/pi-interactive-subagents;patch-jev-client:$PI_AGENT_DIR/npm/node_modules/pi-jev;patch-jev-prompt-guard:$PI_AGENT_DIR/npm/node_modules/pi-jev;patch-jev-self-improve-thinking:$PI_AGENT_DIR/npm/node_modules/pi-jev"
    "omp|$HOME/.omp/agent|omp|skills:$HOME/.omp/agent/skills;skills:$HOME/.omp/profiles/*/agent/skills;agents:$HOME/.omp/agent/agents;agents:$HOME/.omp/profiles/*/agent/agents;config:$HOME/.omp/agent::$REPO_ROOT/harness/omp;config:$PI_AGENT_DIR/intercom::$REPO_ROOT/harness/pi/extensions/pi-intercom;omp-plugin-manifest:$REPO_ROOT/harness/omp/plugins/pi-intercom.txt;omp-plugin-manifest:$REPO_ROOT/harness/omp/plugins/pi-jev.txt;omp-status-line:$REPO_ROOT/harness/omp/status-line/apply.sh"
    "codex|$HOME/.codex|codex|skills:$HOME/.codex/skills"
  )

  source "$(dirname "${BASH_SOURCE[0]}")/modules/artifacts.sh"
  source "$(dirname "${BASH_SOURCE[0]}")/modules/config.sh"
  source "$(dirname "${BASH_SOURCE[0]}")/modules/pi.sh"
  source "$(dirname "${BASH_SOURCE[0]}")/modules/patches.sh"
  source "$(dirname "${BASH_SOURCE[0]}")/modules/omp.sh"
  source "$(dirname "${BASH_SOURCE[0]}")/modules/tools.sh"

  # Present if the home dir exists or any listed binary is on PATH.
  present() {
    [ -d "$1" ] && return 0
    local IFS=','; for b in $2; do command -v "$b" >/dev/null 2>&1 && return 0; done
    return 1
  }

  install_typesafe_secret
  install_pi_jev_auto_modes

  for entry in "${HARNESSES[@]}"; do
    IFS='|' read -r name detect_dir bins typemap <<<"$entry"
    if ! present "$detect_dir" "$bins"; then echo "skip $name (not installed)"; continue; fi
    echo "== $name"
    IFS=';' read -ra pairs <<<"$typemap"
    for pair in "${pairs[@]}"; do
      type="${pair%%:*}"; pattern="${pair#*:}"
      # config pairs encode both destination and source as DEST::SRC and are
      # copied rather than symlinked, so they bypass the shared linker loop.
      if [ "$type" = "config" ]; then
        install_config "${pattern%%::*}" "${pattern##*::}"; continue
      fi
      # The OMP status-line applicator follows its config copy so it can merge its
      # managed schema keys without copying a partial config.yml into the agent dir.
      if [ "$type" = "omp-status-line" ]; then
        install_omp_status_line "$pattern"
        continue
      fi
      # hoist pairs encode NPMDIR::SETTINGS; they bypass the linker loop too.
      if [ "$type" = "hoist" ]; then
        install_pnpm_hoist "${pattern%%::*}" "${pattern##*::}"; continue
      fi
      # vendor-git pairs encode VENDORDIR::MANIFESTDIR (pinned git clones).
      if [ "$type" = "vendor-git" ]; then
        install_vendor_git "${pattern%%::*}" "${pattern##*::}" || PATCH_FAILED=1; continue
      fi
      # patch-* types carry the path of the installed package or file to patch.
      if [ "$type" = "patch-diff-sdk" ]; then
        install_diff_sdk_patch "$pattern" || PATCH_FAILED=1
        continue
      fi
      if [ "$type" = "patch-subagent-widget" ]; then
        install_subagent_widget_patch "$pattern" || PATCH_FAILED=1
        continue
      fi
      if [ "$type" = "patch-jev-client" ]; then
        install_jev_client_patch "$pattern" || PATCH_FAILED=1
        continue
      fi
      if [ "$type" = "patch-jev-prompt-guard" ]; then
        install_jev_prompt_guard_patch "$pattern" || PATCH_FAILED=1
        continue
      fi
      if [ "$type" = "patch-jev-self-improve-thinking" ]; then
        install_jev_self_improve_thinking_patch "$pattern" || PATCH_FAILED=1
        continue
      fi
      if [ "$type" = "patch-fallback" ]; then
        install_fallback_quota_patch "$pattern" || PATCH_FAILED=1
        continue
      fi
      if [ "$type" = "patch-fallback-reviewer-lock" ]; then
        install_fallback_reviewer_lock_patch "$pattern" || PATCH_FAILED=1
        continue
      fi
      # OMP plugin manifests are repository metadata, not copied runtime config.
      if [ "$type" = "omp-plugin-manifest" ]; then
        install_omp_plugin_manifest "$pattern"; continue
      fi
      install_artifacts "$type" "$pattern"
    done
  done

  # After the harness loop so a fresh install has copied the CLIs first.
  install_pi_cli_links
  install_self_improve_repo

  case "$action" in
    all) bash "$tools_installer" --install-all || tool_status=$? ;;
    one) bash "$tools_installer" --install "$tool" || tool_status=$? ;;
  esac
  check_tools

  # A failed required patch must not look like a successful install, but it should
  # not abort the unrelated installs above either, so fail only at the end.
  if [ "${PATCH_FAILED:-0}" = 1 ]; then
    echo "install.sh: a required patch failed (see [patch-*] above)" >&2
    exit 1
  fi
  return "$tool_status"
}
