#!/usr/bin/env bash
# Offline extraction regressions. Only temporary fixtures and recording CLIs run.
set -euo pipefail

if [ "${1:-}" != --isolated ]; then
  REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
  SB="$(mktemp -d "${TMPDIR:-/tmp}/install-modules-test.XXXXXX")"
  trap 'rm -rf "$SB"' EXIT
  mkdir -p "$SB/bin" "$SB/home" "$SB/tmp"
  # An allowlist prevents inherited harnesses, package managers or network CLIs.
  for cmd in bash env awk basename cat chmod cmp cp dirname find grep ln mkdir mktemp mv patch python3 readlink rm sed sha256sum sort tr; do
    ln -s "$(command -v "$cmd")" "$SB/bin/$cmd"
  done
  env -i HOME="$SB/home" PATH="$SB/bin" TMPDIR="$SB/tmp" LC_ALL=C \
    TOOLS_INTERACTIVE=0 bash "${BASH_SOURCE[0]}" --isolated "$SB" "$REPO"
  exit 0
fi
SB="$2"; REPO="$3"
FIXTURE="$SB/checkout with spaces"
export FIXTURE TEST_LOG="$SB/commands"
mkdir -p "$FIXTURE" "$SB/elsewhere" "$SB/capabilities" "$SB/bun-bin"
cp "$REPO/install.sh" "$FIXTURE/install.sh"
cp -R "$REPO/install" "$FIXTURE/"

fail() { echo "FAIL: $*" >&2; exit 1; }
run() {
  local label="$1" expected="$2" status=0; shift 2
  "$@" >"$SB/$label.out" 2>"$SB/$label.err" || status=$?
  if [ "$status" -ne "$expected" ]; then
    cat "$SB/$label.out" "$SB/$label.err" >&2
    fail "$label returned $status, expected $expected"
  fi
}
has() { grep -qF -- "$2" "$SB/$1.out" || fail "$1 missing: $2"; }
lacks() { if grep -qF -- "$2" "$SB/$1.out"; then fail "$1 unexpectedly contains: $2"; fi; }

[ ! -e "$REPO/src" ] || fail 'obsolete src directory remains'
[ "$(find "$FIXTURE/install" -maxdepth 1 -type f -print | sort)" = \
  "$(printf '%s\n' "$FIXTURE/install/TOOL_INSTALLATION.md" "$FIXTURE/install/main.sh")" ] \
  || fail 'install root must contain only main.sh and the guide'
[ ! -e "$REPO/TOOL_INSTALLATION.md" ] || fail 'guide remains at repository root'

# No host git is called: root/common-dir queries and vendor actions are fixtures.
printf '%s\n' '#!/usr/bin/env bash' 'set -eu' \
  'printf "git %s\n" "$*" >>"$TEST_LOG"' \
  'if [ "$1" = -C ] && [ "$3" = rev-parse ]; then' \
  '  case "$4" in' \
  '    --show-toplevel) [ "${NO_GIT:-0}" = 0 ] || exit 1; echo "$FIXTURE" ;;' \
  '    --path-format=absolute) echo "${COMMON_ROOT:-$FIXTURE}/.git" ;;' \
  '    HEAD) cat "$2/.git/head" ;;' \
  '    *) exit 97 ;;' \
  '  esac' \
  'elif [ "$1" = clone ]; then mkdir -p "${@: -1}/.git"' \
  'elif [ "$3" = fetch ]; then exit "${GIT_FAIL:-0}"' \
  'elif [ "$3" = -c ]; then printf "%s\n" "${@: -1}" >"$2/.git/head"' \
  'else echo "blocked git: $*" >&2; exit 97; fi' >"$SB/bin/git"
printf '%s\n' '#!/usr/bin/env bash' 'set -eu' \
  'printf "omp %s\n" "$*" >>"$TEST_LOG"' \
  'case "$1 $2" in' \
  '  "plugin list") if [ -f "$HOME/plugin" ]; then echo '\''[{"name":"fixture","version":"1"}]'\''; else echo "[]"; fi ;;' \
  '  install\ *) [ "${OMP_FAIL:-0}" = 0 ] || exit 9; if [ "${USE_BUN:-0}" = 1 ]; then echo "shim ${PATH%%:*}" >>"$TEST_LOG"; bun --version; fi; echo installed >"$HOME/plugin" ;;' \
  '  "config get") if [ -f "$PI_CODING_AGENT_DIR/setting-$3" ]; then cat "$PI_CODING_AGENT_DIR/setting-$3"; fi ;;' \
  '  "config set") printf "%s\n" "$4" >"$PI_CODING_AGENT_DIR/setting-$3" ;;' \
  '  *) echo "blocked omp: $*" >&2; exit 97 ;;' \
  'esac' >"$SB/capabilities/omp"
printf '%s\n' '#!/usr/bin/env bash' 'printf "npx %s\n" "$*" >>"$TEST_LOG"' >"$SB/capabilities/npx"
printf '%s\n' '#!/usr/bin/env bash' 'echo "unexpected bun invocation" >&2; exit 97' >"$SB/bun-bin/bun"
chmod +x "$SB/bin/git" "$SB/capabilities/omp" "$SB/capabilities/npx" "$SB/bun-bin/bun"

mkdir -p "$FIXTURE/skills/dev/sample" "$FIXTURE/agents" "$FIXTURE/harness/pi/bin" \
  "$FIXTURE/harness/pi/ignored" "$FIXTURE/harness/omp/plugins" "$FIXTURE/harness/omp/status-line"
printf 'name: sample\n' >"$FIXTURE/skills/dev/sample/SKILL.md"
printf 'name: reviewer\n' >"$FIXTURE/agents/reviewer.md"
printf '{"npmCommand":["pnpm"]}\n' >"$FIXTURE/harness/pi/settings.json"
printf 'PI_JEV_AUTO=1\n' >"$FIXTURE/harness/pi/pi-jev-auto.conf"
printf 'excluded\n' >"$FIXTURE/harness/pi/README.md"
printf 'excluded\n' >"$FIXTURE/harness/pi/.hidden"
printf 'excluded\n' >"$FIXTURE/harness/pi/ignored/nested"
printf '#!/usr/bin/env bash\nexit 0\n' >"$FIXTURE/harness/pi/bin/pi-secret"
cp "$FIXTURE/harness/pi/bin/pi-secret" "$FIXTURE/harness/pi/bin/pi-improve"
chmod +x "$FIXTURE/harness/pi/bin/"*
printf 'npm:fixture@1\n' >"$FIXTURE/harness/omp/plugins/pi-jev.txt"
cp "$REPO/harness/omp/status-line/apply.sh" "$FIXTURE/harness/omp/status-line/"
cd "$FIXTURE"
printf '%s\n' 'TYPESAFE_API_KEY=fixture-file-key' 'PI_CODING_AGENT_DIR="$HOME/custom-agent"' \
  'echo loaded >"$HOME/env-loaded"' 'install_typesafe_secret() { exit 97; }' >.env

# Help and rejected forms must not reach .env, git, checks or HOME writes.
preflight() {
  local label="$1" expected="$2"; shift 2
  run "$label" "$expected" bash "$FIXTURE/install.sh" "$@"
  [ -z "$(find "$HOME" -mindepth 1 -print)" ] || fail "$label changed HOME"
  [ ! -s "$TEST_LOG" ] || fail "$label invoked a fixture command"
  if [ "$expected" = 0 ]; then
    [ -s "$SB/$label.out" ] && [ ! -s "$SB/$label.err" ] || fail "$label help streams"
  else
    [ ! -s "$SB/$label.out" ] && [ -s "$SB/$label.err" ] || fail "$label error streams"
  fi
}
cd "$SB/elsewhere"
preflight roothelp 0 --help
has roothelp '--tools'; has roothelp '--tool TOOL'
preflight positional 1 positional
preflight emptyarg 1 ''
preflight badoption 1 --unknown
preflight obsoleteall 1 --install-tools
preflight obsoleteone 1 --install-tool gh
preflight missingtool 1 --tool
preflight emptytool 1 --tool ''
preflight unknowntool 1 --tool unknown
preflight regextool 1 --tool 'gh.*'
preflight multimatch 1 --tool $'gh\norca'
preflight flagoperand 1 --tool --tools
preflight extratool 1 --tool gh extra
preflight alloperand 1 --tools gh
preflight repeatedall 1 --tools --tools
preflight repeatedone 1 --tool gh --tool orca
preflight mixedactions 1 --tools --tool gh
preflight mixedreverse 1 --tool gh --tools
preflight mixedhelp 1 --help --tools
preflight trailinghelp 1 --tool gh --help
cd "$FIXTURE"
echo 'ok: root help and strict errors precede bootstrap, env, git, checks and writes'

run imports 0 bash -euc '
  umask 022
  trap ":" RETURN
  before="$(trap -p RETURN)"
  source "$1/install/main.sh"
  for module in artifacts config pi durable patches omp tools; do source "$1/install/modules/$module.sh"; done
  [ "$(umask)" = 0022 ] && [ "$(trap -p RETURN)" = "$before" ]
  declare -F apply_package_patch >/dev/null
  declare -F install_vendor_git >/dev/null
  [ -z "${TYPESAFE_API_KEY:-}" ] && [ -z "${REPO_ROOT:-}" ]
' test "$FIXTURE"
[ ! -s "$SB/imports.out" ] && [ ! -s "$SB/imports.err" ] || fail 'imports emitted output'
[ ! -e "$HOME/env-loaded" ] && [ ! -e "$HOME/custom-agent" ] || fail 'imports installed or loaded .env'
echo 'ok: all definition modules import without installation, env, umask or trap changes'

mkdir -p "$HOME/.claude/skills/sample" "$HOME/.claude/agents" "$HOME/.codex" \
  "$HOME/.omp/agent" "$HOME/.omp/profiles/alpha/agent/skills" "$HOME/.omp/profiles/alpha/agent/agents"
ln -s /dev/null "$HOME/.claude/agents/reviewer.md"
ln -s "$SB/missing" "$HOME/.claude/skills/retired"
run first 0 env PATH="$SB/capabilities:$PATH" USE_BUN=1 bash "$FIXTURE/install.sh"
[ ! -s "$SB/first.err" ] || fail 'fresh install stderr'
has first '1 overwritten'; has first '1 repointed'; has first 'removed dangling retired'
has first '10 settings updated'; has first '1 installed, 0 up to date'
[ -f "$HOME/env-loaded" ] || fail '.env not loaded'
[ "$(cat "$HOME/custom-agent/secrets/typesafe_api_key")" = fixture-file-key ] || fail 'file key precedence'
[ "$(find "$HOME/custom-agent/secrets/typesafe_api_key" -perm 0600)" ] || fail 'secret mode'
[ "$(find "$HOME/.config/environment.d/91-pi-jev-auto.conf" -perm 0644)" ] || fail 'jev mode'
[ "$(find "$HOME/.codex/skills" -perm 0700)" ] || fail 'global umask effect lost'
[ -x "$HOME/custom-agent/bin/pi-secret" ] && [ -L "$HOME/.local/bin/pi-secret" ] || fail 'CLI mode/link'
[ ! -e "$HOME/custom-agent/README.md" ] && [ ! -e "$HOME/custom-agent/.hidden" ] \
  && [ ! -e "$HOME/custom-agent/ignored" ] || fail 'config exclusion'
grep -qF 'npx --yes bun --version' "$TEST_LOG" || fail 'npx bun shim not used'
shim="$(sed -n 's/^shim //p' "$TEST_LOG")"
[ -n "$shim" ] && [ ! -e "$shim" ] || fail 'temporary bun shim leaked'
run second 0 env PATH="$SB/capabilities:$PATH" bash "$FIXTURE/install.sh"
has second '[skills] ->'; has second '(1 ok)'; has second '0 installed, 1 up to date'
has second '[status-line] ->'; lacks second 'settings updated'; lacks second 'store reset'
echo 'ok: fresh/rerun artifacts, configs, profiles, secret permissions and npx cleanup'

# An inherited key prevents even executing the fixture .env; registry uses the override.
rm "$HOME/env-loaded"
run inherited 0 env TYPESAFE_API_KEY=inherited PI_CODING_AGENT_DIR="$HOME/override" bash "$FIXTURE/install.sh"
[ ! -e "$HOME/env-loaded" ] || fail 'inherited key still sourced .env'
[ "$(cat "$HOME/override/secrets/typesafe_api_key")" = inherited ] || fail 'inherited key/override'
run umask 0 env TYPESAFE_API_KEY=fixture PI_CODING_AGENT_DIR="$HOME/override" bash -euc '
  source "$1/install/modules/pi.sh"; PI_AGENT_DIR="$PI_CODING_AGENT_DIR"
  umask 022; install_typesafe_secret >/dev/null; [ "$(umask)" = 0077 ]
' test "$FIXTURE"
rm "$FIXTURE/.env"
cd "$SB/elsewhere"
run relative 0 env HOME="$SB/empty-home" bash '../checkout with spaces/install.sh'
run noargs 0 env HOME="$SB/empty-home" bash "$FIXTURE/install.sh"
cmp "$SB/relative.out" "$SB/noargs.out"; cmp "$SB/relative.err" "$SB/noargs.err"
has noargs 'skip claude (not installed)'; has noargs '== Tools'; lacks noargs 'Usage:'
# The git-common-dir contract of a linked worktree records its main checkout.
printf 'gitdir: fixture\n' >"$FIXTURE/.git"
run common 0 env COMMON_ROOT="$SB/main-checkout" PI_CODING_AGENT_DIR="$HOME/custom-agent" bash "$FIXTURE/install.sh"
[ "$(cat "$HOME/custom-agent/self-improve/repo")" = "$SB/main-checkout" ] || fail 'common checkout recording'
mkdir -p "$SB/fallback-home/.claude"
run fallback 0 env NO_GIT=1 HOME="$SB/fallback-home" bash "$FIXTURE/install.sh"
has fallback 'skip pi (not installed)'; has fallback '== Tools'; has fallback '(0 ok)'
[ ! -e "$SB/fallback-home/.claude/skills/sample" ] || fail 'non-git fallback ignored caller PWD'
run binary 0 env HOME="$SB/binary-home" PATH="$SB/capabilities:$PATH" bash "$FIXTURE/install.sh"
has binary '== omp'; has binary 'no match for'; has binary 'skip claude (not installed)'
echo 'ok: env precedence/override, same-shell umask, no-arg paths and common-dir lookup'

# Required failures defer to the end; native OMP failure must stop before postlude/tools.
mkdir -p "$HOME/.pi/agent/npm/node_modules/pi-fallback-models/src" "$FIXTURE/harness/pi/vendor"
printf 'node-linker=hoisted\n' >"$HOME/.pi/agent/npm/.npmrc"
printf 'changed upstream\n' >"$HOME/.pi/agent/npm/node_modules/pi-fallback-models/src/extension.ts"
printf 'https://fixture.invalid/vendor bad-sha\n' >"$FIXTURE/harness/pi/vendor/bad.txt"
run deferred 1 bash "$FIXTURE/install.sh"
has deferred '== codex'; has deferred '[self-improve]'; has deferred '== Tools'
grep -qF 'upstream code changed' "$SB/deferred.err" || fail 'patch failure absent'
grep -qF 'needs a full 40-char commit SHA' "$SB/deferred.err" || fail 'vendor failure absent'
grep -qF 'install.sh: a required patch failed' "$SB/deferred.err" || fail 'final failure absent'
rm "$HOME/plugin"
run immediate 1 env PATH="$SB/capabilities:$PATH" OMP_FAIL=1 bash "$FIXTURE/install.sh"
lacks immediate '== codex'; lacks immediate '[self-improve]'; lacks immediate '== Tools'
grep -qF 'failed to install npm:fixture@1' "$SB/immediate.err" || fail 'OMP failure absent'
run nobun 1 bash -euc 'source "$1/install/modules/omp.sh"; omp_install_package npm:fixture@1' test "$FIXTURE"
grep -qF 'bun and npx are both unavailable' "$SB/nobun.err" || fail 'missing runtime error'
run bun 0 env PATH="$SB/bun-bin:$SB/capabilities:$PATH" bash -euc '
  source "$1/install/modules/omp.sh"; omp_install_package npm:fixture@1
' test "$FIXTURE"
run failedshim 9 env PATH="$SB/capabilities:$PATH" OMP_FAIL=1 bash -euc '
  source "$1/install/modules/omp.sh"; omp_install_package npm:fixture@1
' test "$FIXTURE"
[ -z "$(find "$TMPDIR" -mindepth 1 -print)" ] || fail 'failed shim cleanup'
echo 'ok: deferred patch/vendor failures, immediate OMP errexit and bun/npx/missing-runtime paths'

run provisioning 0 bash -euc '
  source "$1/install/modules/pi.sh"
  npm="$2/npm"; mkdir -p "$npm/node_modules"
  echo disposable >"$npm/node_modules/marker"; echo lock >"$npm/pnpm-lock.yaml"
  echo '\''{"npmCommand":["npm"]}'\'' >"$2/settings"
  install_pnpm_hoist "$npm" "$2/settings"; [ -f "$npm/node_modules/marker" ]
  echo '\''{"npmCommand":["pnpm"]}'\'' >"$2/settings"
  install_pnpm_hoist "$npm" "$2/settings"; [ ! -e "$npm/node_modules" ] && [ ! -e "$npm/pnpm-lock.yaml" ]
  install_pnpm_hoist "$npm" "$2/settings"
  mkdir -p "$2/manifests"
  echo "https://fixture.invalid/vendor 0123456789012345678901234567890123456789" >"$2/manifests/vendor.txt"
  install_vendor_git "$2/vendor" "$2/manifests"
  install_vendor_git "$2/vendor" "$2/manifests"
  echo old >"$2/vendor/fixture.invalid/vendor/.git/head"
  install_vendor_git "$2/vendor" "$2/manifests"
  echo old >"$2/vendor/fixture.invalid/vendor/.git/head"
  if GIT_FAIL=1 install_vendor_git "$2/vendor" "$2/manifests"; then exit 1; fi
  [ "$(cat "$2/vendor/fixture.invalid/vendor/.git/head")" = old ]
  rm -rf "$2/vendor/fixture.invalid/vendor/.git"
  if install_vendor_git "$2/vendor" "$2/manifests"; then exit 1; fi
  echo "https://fixture.invalid/../unsafe 0123456789012345678901234567890123456789" >"$2/manifests/vendor.txt"
  if install_vendor_git "$2/vendor" "$2/manifests"; then exit 1; fi
' test "$FIXTURE" "$SB"
has provisioning 'hoisting is pnpm-only'; has provisioning 'store reset'; has provisioning '(ok)'
has provisioning '(cloned at'; has provisioning '(updated to'
grep -qF 'cannot derive a safe path' "$SB/provisioning.err" || fail 'unsafe vendor accepted'
echo 'ok: pnpm skip/reset/rerun and pinned vendor clone/ok/update/unsafe paths use only stubs'

# Durable keeps its dependency stamp separate from the generic pinned-clone flow.
printf '%s\n' '#!/usr/bin/env bash' 'set -eu' 'printf "pnpm %s\\n" "$*" >>"$TEST_LOG"' >"$SB/bin/pnpm"
chmod +x "$SB/bin/pnpm"
run durable 0 bash -euc '
  source "$1/install/modules/artifacts.sh"; source "$1/install/modules/durable.sh"
  clone="$2/durable"; mkdir -p "$clone/bin"
  printf "{}\\n" >"$clone/package.json"; printf "lock\\n" >"$clone/pnpm-lock.yaml"
  printf "#!/usr/bin/env bash\\n" >"$clone/bin/durable"; chmod +x "$clone/bin/durable"
  install_durable_deps "$clone"
  install_durable_deps "$clone"
  printf "changed\\n" >>"$clone/pnpm-lock.yaml"
  install_durable_deps "$clone"
  install_durable_cli_link "$clone"
  [ -L "$HOME/.local/bin/durable" ]
' test "$FIXTURE" "$SB"
[ "$(grep -c '^pnpm ' "$TEST_LOG")" -eq 2 ] || fail 'durable dependencies did not stamp metadata changes'
has durable 'dependencies ->'; has durable '(ok)'; has durable '[link] durable:'
echo 'ok: durable dependency stamp installs once per metadata hash and links the CLI'

# Master CLI dispatch: recording adapters, never installation of real tools.
DISPATCH="$SB/dispatch"; mkdir -p "$DISPATCH"
cp "$FIXTURE/install/tools/install.sh" "$DISPATCH/"
for tool in gh gh-stack playwright-cli chrome-devtools-cli agent-browser orca lizard; do
  printf '%s\n' '#!/usr/bin/env bash' 'tool="$(basename "$0" .sh)"' \
    'printf "%s %s\n" "$tool" "${1:-help}" >>"$TEST_LOG"' \
    'echo "$tool ${1:-help}"' \
    'if [ "${1:-}" = install ]; then' \
    '  if [ "${EXPECT_REPO:-0}" = 1 ]; then [ -L "$HOME/.claude/skills/sample" ] && [ -f "$HOME/.pi/agent/self-improve/repo" ] || exit 97; fi' \
    '  printf "%s|%s|%s\n" "$tool" "${TOOLS_SKIP:-}" "${TOOLS_INTERACTIVE:-}" >>"$TEST_LOG.env"' \
    '  if [ "${ADAPTER_STDERR:-0}" = 1 ]; then echo "install-stderr:$tool" >&2; fi' \
    'fi' \
    'if [ "${FAIL_TOOL:-}" = "$tool" ]; then exit "${FAIL_STATUS:-1}"; fi' \
    '[ "${1:-}" != --help ]' >"$DISPATCH/$tool.sh"
done
: >"$TEST_LOG"
for tool in gh gh-stack playwright-cli chrome-devtools-cli agent-browser orca lizard gh_stack; do
  run validate 0 bash "$DISPATCH/install.sh" --validate "$tool"
  [ ! -s "$SB/validate.out" ] && [ ! -s "$SB/validate.err" ] || fail 'validation emitted output'
done
for tool in unknown '' 'gh.*' '[go]h' $'gh\norca'; do
  run invalidvalidate 1 bash "$DISPATCH/install.sh" --validate "$tool"
done
run missingvalidate 1 bash "$DISPATCH/install.sh" --validate
run extravalidate 1 bash "$DISPATCH/install.sh" --validate gh extra
[ ! -s "$TEST_LOG" ] || fail 'validation invoked an adapter'
run check 0 bash "$DISPATCH/install.sh" --check
has check 'Summary: 7/7 tools installed'
[ "$(grep -c ' check$' "$TEST_LOG")" = 14 ] || fail 'check frequency changed'
: >"$TEST_LOG"
run strictcheck 1 env FAIL_TOOL=orca bash "$DISPATCH/install.sh" --check-status
[ "$(grep -c ' check$' "$TEST_LOG")" = 14 ] || fail 'strict check added an extra probe'
run compatiblecheck 0 env FAIL_TOOL=orca bash "$DISPATCH/install.sh" --check
cmp "$SB/strictcheck.out" "$SB/compatiblecheck.out"
run skip 0 env TOOLS_SKIP=gh-stack bash "$DISPATCH/install.sh" --check
has skip 'gh (skipped)'; has skip 'gh-stack (skipped)'; has skip 'Summary: 5/7'
run all 0 bash "$DISPATCH/install.sh" --install-all
has all 'Installed: 7'; has all 'Already installed: 0'; has all 'Skipped: 0'
run failedinstall 1 env FAIL_TOOL=orca bash "$DISPATCH/install.sh" --install-all
has failedinstall 'Installed: 6'; has failedinstall 'Failed: 1'
run specific 0 bash "$DISPATCH/install.sh" --install gh_stack
has specific 'gh-stack install'
run toolhelp 0 bash "$DISPATCH/install.sh" --tool-help gh_stack
has toolhelp 'gh-stack --help'; has toolhelp 'gh-stack check'
for option in --install --tool-help; do
  run missing 1 bash "$DISPATCH/install.sh" "$option"; has missing 'requires a tool name'
  run invalid 1 bash "$DISPATCH/install.sh" "$option" unknown; has invalid 'Unknown tool: unknown'
  run regex 1 bash "$DISPATCH/install.sh" "$option" 'gh.*'; has regex 'Unknown tool: gh.*'
done
run unknown 1 bash "$DISPATCH/install.sh" --unknown; has unknown 'Unknown option:'
run help 0 bash "$FIXTURE/install/tools/install.sh" --help
run shorthelp 0 bash "$FIXTURE/install/tools/install.sh" -h
run empty 0 bash "$FIXTURE/install/tools/install.sh"
cmp "$SB/help.out" "$SB/shorthelp.out"; cmp "$SB/help.out" "$SB/empty.out"
has help "$FIXTURE/install/tools/install.sh"
has help './install.sh --tools'; has help './install.sh --tool gh'
run missingtools 0 bash "$FIXTURE/install/tools/install.sh" --check
has missingtools 'Summary: 0/7 tools installed'
run realtoolhelp 1 bash "$FIXTURE/install/tools/install.sh" --tool-help gh
has realtoolhelp 'Tool: gh'
for tool in gh gh-stack playwright-cli chrome-devtools-cli agent-browser orca lizard; do
  run adapterhelp 1 bash "$FIXTURE/install/tools/$tool.sh" --help
  has adapterhelp "./install.sh --tool $tool"
  has adapterhelp 'Internal adapter interface:'
done
echo 'ok: master validation/help/errors, root-directed adapter help, literal names and probe counts'

# Root install actions use only recording adapters, never the actual installers.
cp "$DISPATCH/"*.sh "$FIXTURE/install/tools/"
rm "$FIXTURE/harness/pi/vendor/bad.txt"
export HOME="$SB/root-cli-home" TYPESAFE_API_KEY=fixture EXPECT_REPO=1 ADAPTER_STDERR=1
mkdir -p "$HOME/.claude" "$HOME/.codex"
ALL_TOOLS='gh gh-stack playwright-cli chrome-devtools-cli agent-browser orca lizard'
expect_root_log() {
  local installed="$1" checked="$2" tool
  {
    printf 'git -C %s rev-parse --show-toplevel\n' "$FIXTURE"
    printf 'git -C %s rev-parse --path-format=absolute --git-common-dir\n' "$FIXTURE"
    for tool in $installed; do printf '%s install\n' "$tool"; done
    for tool in $checked; do printf '%s check\n%s check\n' "$tool" "$tool"; done
  } >"$SB/expected-log"
  cmp "$TEST_LOG" "$SB/expected-log" || fail 'root repository/install/check command order'
}
: >"$TEST_LOG"
run rootdefault 0 bash "$FIXTURE/install.sh"
expect_root_log '' "$ALL_TOOLS"
[ ! -s "$SB/rootdefault.err" ] || fail 'default emitted tool installation stderr'
: >"$TEST_LOG"
run rootall 0 bash "$FIXTURE/install.sh" --tools
expect_root_log "$ALL_TOOLS" "$ALL_TOOLS"
for tool in $ALL_TOOLS; do echo "install-stderr:$tool"; done >"$SB/expected-stderr"
cmp "$SB/rootall.err" "$SB/expected-stderr"
lacks rootall 'install-stderr:'
[ "$(grep -c '^== Tools$' "$SB/rootall.out")" = 1 ] || fail 'repeated root report'
awk '/\[self-improve\]/{repo=NR} /^Installing tools/{install=NR} /^== Tools$/{check=NR}
  END { exit !(repo && repo < install && install < check) }' "$SB/rootall.out" || fail 'root phase order'
: >"$TEST_LOG"; : >"$TEST_LOG.env"
run rootskip 0 env TOOLS_SKIP=gh-stack TOOLS_INTERACTIVE=1 bash "$FIXTURE/install.sh" --tools
KEPT_TOOLS='playwright-cli chrome-devtools-cli agent-browser orca lizard'
expect_root_log "$KEPT_TOOLS" "$KEPT_TOOLS"
for tool in $KEPT_TOOLS; do printf '%s|gh-stack|1\n' "$tool"; done >"$SB/expected-env"
cmp "$TEST_LOG.env" "$SB/expected-env"
for tool in gh gh_stack; do
  : >"$TEST_LOG"
  run rootone 0 bash "$FIXTURE/install.sh" --tool "$tool"
  expect_root_log "${tool//_/-}" "$ALL_TOOLS"
  printf 'install-stderr:%s\n' "${tool//_/-}" >"$SB/expected-stderr"
  cmp "$SB/rootone.err" "$SB/expected-stderr"
done
: >"$TEST_LOG"
run rootoneskip 0 env TOOLS_SKIP=gh-stack bash "$FIXTURE/install.sh" --tool gh
expect_root_log gh "$KEPT_TOOLS"
: >"$TEST_LOG"
run rootonefail 9 env FAIL_TOOL=gh FAIL_STATUS=9 bash "$FIXTURE/install.sh" --tool gh
expect_root_log gh "$ALL_TOOLS"; has rootonefail 'Summary: 6/7'
printf 'install-stderr:gh\n' >"$SB/expected-stderr"
cmp "$SB/rootonefail.err" "$SB/expected-stderr"
: >"$TEST_LOG"
run rootallfail 1 env FAIL_TOOL=orca FAIL_STATUS=9 bash "$FIXTURE/install.sh" --tools
expect_root_log "$ALL_TOOLS" "$ALL_TOOLS"; has rootallfail 'Failed: 1'; has rootallfail 'Summary: 6/7'
for tool in $ALL_TOOLS; do echo "install-stderr:$tool"; done >"$SB/expected-stderr"
cmp "$SB/rootallfail.err" "$SB/expected-stderr"

# Missing tools add one shell-safe root suggestion without changing default status.
lacks rootdefault '[tools] Some tools are missing'
: >"$TEST_LOG"
run rootmissing 0 env FAIL_TOOL=orca FAIL_STATUS=9 bash "$FIXTURE/install.sh"
expect_root_log '' "$ALL_TOOLS"
printf -v advice '    bash %q --tools' "$FIXTURE/install.sh"
[ "$(grep -cF -- "$advice" "$SB/rootmissing.out")" = 1 ] || fail 'missing root advice absent or repeated'
has rootmissing "$FIXTURE/install/TOOL_INSTALLATION.md"
run advicequote 0 bash -euc '
  expected="$2"; eval "set -- $1"
  [ "$#" = 3 ] && [ "$1" = bash ] && [ "$2" = "$expected" ] && [ "$3" = --tools ]
' test "$advice" "$FIXTURE/install.sh"
: >"$TEST_LOG"
run rootskipped 0 env TOOLS_SKIP="$ALL_TOOLS" bash "$FIXTURE/install.sh"
expect_root_log '' ''
lacks rootskipped '[tools] Some tools are missing'
echo 'ok: missing tools preserve success and add one quoted root command, skipped/present tools add none'

mkdir -p "$HOME/.pi/agent/npm/node_modules/pi-fallback-models/src"
printf 'changed upstream\n' >"$HOME/.pi/agent/npm/node_modules/pi-fallback-models/src/extension.ts"
for status in 0 9; do
  : >"$TEST_LOG"
  run rootpatch 1 env FAIL_TOOL=gh FAIL_STATUS="$status" bash "$FIXTURE/install.sh" --tool gh
  expect_root_log gh "$ALL_TOOLS"; has rootpatch '== Tools'
  grep -qF 'upstream code changed' "$SB/rootpatch.err" || fail 'root patch error lost'
  grep -qF 'install-stderr:gh' "$SB/rootpatch.err" || fail 'explicit stderr lost'
  grep -qF 'install.sh: a required patch failed' "$SB/rootpatch.err" || fail 'patch final status lost'
done
: >"$TEST_LOG"
run rootomp 1 env PATH="$SB/capabilities:$PATH" OMP_FAIL=1 bash "$FIXTURE/install.sh" --tool gh
lacks rootomp '== Tools'
if grep -qE ' (install|check)$' "$TEST_LOG"; then fail 'immediate OMP failure reached external tools'; fi
grep -qF 'failed to install npm:fixture@1' "$SB/rootomp.err" || fail 'immediate OMP error lost'
echo 'ok: root default/all/selected ordering, env forwarding, separate streams and failure precedence'
