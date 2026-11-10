#!/usr/bin/env bash
# Offline applicator regression tests. No installed packages are modified.
set -euo pipefail
REPO="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$REPO"
SB="$(mktemp -d)"
trap 'rm -rf "$SB"' EXIT
# Load definitions only, without running the installer or reading local secrets.
source "$REPO/install/modules/patches.sh"
source "$REPO/install/modules/pi.sh"
pkg="$SB/package"
mkdir -p "$pkg/src"
printf 'first\nsecond\n' > "$pkg/src/test.ts"
printf '%s\n' '--- a/src/test.ts' '+++ b/src/test.ts' '@@ -1,2 +1,2 @@' '-first' '+patched' ' second' > "$SB/test.patch"
apply_package_patch "$pkg" test "$SB/test.patch" src/test.ts | grep -q '(patched)'
apply_package_patch "$pkg" test "$SB/test.patch" src/test.ts | grep -q '(ok)'
echo 'ok: patch applies once, then reports ok'
apply_package_patch "$SB/missing" test "$SB/test.patch" src/test.ts | grep -q 'not installed yet, skipping'
echo 'ok: missing package is skipped'
printf 'changed upstream\nsecond\n' > "$pkg/src/test.ts"
cp "$pkg/src/test.ts" "$SB/before"
if apply_package_patch "$pkg" test "$SB/test.patch" src/test.ts > "$SB/result" 2>&1; then
  echo 'FAIL: changed upstream accepted' >&2; exit 1
fi
cmp "$pkg/src/test.ts" "$SB/before"
grep -q 'upstream code changed' "$SB/result"
echo 'ok: upstream mismatch fails without changing the file'
# A failed later hunk must not leave an earlier hunk applied.
printf '%s\n' '--- a/src/test.ts' '+++ b/src/test.ts' '@@ -1 +1 @@' '-changed upstream' '+patched' '@@ -10 +10 @@' '-absent' '+replacement' > "$SB/multi.patch"
if apply_package_patch "$pkg" test "$SB/multi.patch" src/test.ts > "$SB/result" 2>&1; then
  echo 'FAIL: partial patch accepted' >&2; exit 1
fi
cmp "$pkg/src/test.ts" "$SB/before"
echo 'ok: failed multi-hunk dry run leaves file untouched'

# Strict candidate patch is exact, version-pinned, idempotent, and rejects drift.
candidate_fixture="$REPO/harness/pi/tests/fixtures/pi-subagents-0.22.1"
candidate="$SB/candidate"
cp -R "$candidate_fixture" "$candidate"
REPO_ROOT="$REPO" install_tintinweb_subagents_strict_dispatch_patch "$candidate" | grep -q '(patched)'
REPO_ROOT="$REPO" install_tintinweb_subagents_strict_dispatch_patch "$candidate" | grep -q '(ok)'
cp -R "$candidate_fixture" "$SB/candidate-wrong-version"
python3 - "$SB/candidate-wrong-version/package.json" <<'PY'
import json, sys
p = sys.argv[1]
data = json.load(open(p)); data["version"] = "0.22.2"
open(p, "w").write(json.dumps(data))
PY
if REPO_ROOT="$REPO" install_tintinweb_subagents_strict_dispatch_patch "$SB/candidate-wrong-version" >"$SB/result" 2>&1; then
  echo 'FAIL: candidate wrong version accepted' >&2; exit 1
fi
grep -q 'expected 0.22.1' "$SB/result"
cp -R "$candidate_fixture" "$SB/candidate-drift"
printf 'changed upstream\n' > "$SB/candidate-drift/src/index.ts"
if REPO_ROOT="$REPO" install_tintinweb_subagents_strict_dispatch_patch "$SB/candidate-drift" >"$SB/result" 2>&1; then
  echo 'FAIL: candidate drift accepted' >&2; exit 1
fi
grep -q 'upstream code changed' "$SB/result"
# Context drift that a permissive applicator could relocate must still fail: this
# policy patch only applies at its exact upstream context.
cp -R "$candidate_fixture" "$SB/candidate-near-context-drift"
python3 - "$SB/candidate-near-context-drift/src/index.ts" <<'PY'
import sys
path = sys.argv[1]
source = open(path).read()
old = 'import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";'
assert old in source
open(path, "w").write(source.replace(old, old + ' // near-context drift'))
PY
cp "$SB/candidate-near-context-drift/src/index.ts" "$SB/before-near-context-drift"
if REPO_ROOT="$REPO" install_tintinweb_subagents_strict_dispatch_patch "$SB/candidate-near-context-drift" >"$SB/result" 2>&1; then
  echo 'FAIL: strict candidate patch accepted near-context drift' >&2; exit 1
fi
cmp "$SB/candidate-near-context-drift/src/index.ts" "$SB/before-near-context-drift"
grep -q 'upstream code changed' "$SB/result"
echo 'ok: strict candidate patch is version-pinned, idempotent, and rejects drift with --fuzz=0'

# Evaluate exact-model resolution against a patched fixture. This exercises the
# fail-closed availability path rather than merely checking patch text.
node - "$candidate/src/index.ts" "$candidate/src/types.ts" <<'JS'
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const { stripTypeScriptTypes } = require("node:module");
const source = fs.readFileSync(process.argv[2], "utf8");
// Parse complete patched fixture targets before extracting the behavior seam.
stripTypeScriptTypes(source, { mode: "transform" });
stripTypeScriptTypes(fs.readFileSync(process.argv[3], "utf8"), { mode: "transform" });
const start = source.indexOf("function resolveExactAvailableModel");
const end = source.indexOf("\n\n/** Requested, pre-spawn", start);
assert(start >= 0 && end > start, "strict resolver exists");
const fn = stripTypeScriptTypes(source.slice(start, end), { mode: "transform" });
const resolve = vm.runInNewContext(`${fn}\nresolveExactAvailableModel`);
assert.match(resolve("haiku", { getAvailable: () => [], find: () => undefined }).error, /exact provider/);
assert.match(resolve("anthropic/claude-haiku-5-5", { find: () => undefined }).error, /Cannot verify model availability/);
const model = { provider: "anthropic", id: "claude-haiku-5-5" };
assert.equal(resolve("anthropic/claude-haiku-5-5", { getAvailable: () => [model], find: () => model }).model, model);
assert.match(resolve("anthropic/CLAUDE-haiku-5-5", { getAvailable: () => [model], find: () => model }).error, /unavailable/);
console.log("ok: strict candidate resolver requires exact authenticated models and fails closed");
JS
for required in 'params.model == null || params.thinking == null' 'must not pin a model' 'MANAGED_DELEGATION_MODELS.has' 'MANAGED_DELEGATION_SELECTIONS' 'getSupportedThinkingLevels' 'Only managed delegation-* profiles may spawn agents'; do
  grep -qF "$required" "$candidate/src/index.ts" || { echo "FAIL: strict candidate behavior missing $required" >&2; exit 1; }
done

# Exercise the policy seams against hostile local overrides without importing Pi.
node - "$candidate/src/index.ts" <<'JS'
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const { stripTypeScriptTypes } = require("node:module");
const source = fs.readFileSync(process.argv[2], "utf8");
const start = source.indexOf("/** Exact models permitted by the managed APPEND_SYSTEM.md delegation table. */");
const end = source.indexOf("\n\nexport function renderRunningAgentStatus", start);
assert(start >= 0 && end > start, "strict policy helpers exist");
const helpers = stripTypeScriptTypes(source.slice(start, end), { mode: "transform" });
const files = new Set(["/global/agents/delegation-worker.md"]);
const contents = new Map();
const policy = vm.runInNewContext(`${helpers}\n({ isManagedDelegationType, freshSpawnTypeError, managedDelegationPolicyError, managedThinkingError, modelProvenance })`, {
  existsSync: (path) => files.has(path) || contents.has(path),
  readFileSync: (path) => contents.get(path),
  realpathSync: (path) => path,
  join: (...parts) => parts.join("/"),
  getAgentDir: () => "/global",
  getSupportedThinkingLevels: () => ["low", "medium"],
});
const globalWorker = { source: "global", sourcePath: "/global/agents/delegation-worker.md" };
const accepted = { model: "openai-codex/gpt-5.6-terra", thinking: "medium" };
assert.equal(policy.managedDelegationPolicyError("delegation-worker", accepted, globalWorker, "/project"), undefined, "accepted call");
assert.match(policy.managedDelegationPolicyError("delegation-worker", { thinking: "medium" }, globalWorker, "/project"), /requires explicit/);
assert.match(policy.managedDelegationPolicyError("delegation-worker", { model: accepted.model, thinking: null }, globalWorker, "/project"), /requires explicit/);
assert.match(policy.managedDelegationPolicyError("delegation-worker", accepted, { ...globalWorker, model: accepted.model }, "/project"), /must not pin a model/);
assert.match(policy.managedDelegationPolicyError("delegation-worker", accepted, { ...globalWorker, thinking: "medium" }, "/project"), /must not pin thinking/);
assert.match(policy.managedDelegationPolicyError("delegation-worker", { model: "anthropic/claude-sonnet-5-5", thinking: "medium" }, globalWorker, "/project"), /outside/);
assert.match(policy.managedDelegationPolicyError("delegation-worker", { model: accepted.model, thinking: "low" }, globalWorker, "/project"), /Model\/thinking selection/);
assert.match(policy.managedDelegationPolicyError("delegation-worker", accepted, { source: "project", sourcePath: "/project/.pi/agents/delegation-worker.md" }, "/project"), /global managed agents directory/);
const projectSettings = "/project/.pi/subagents.json";
contents.set(projectSettings, '{"maxSubagentDepth":2}');
assert.match(policy.managedDelegationPolicyError("delegation-worker", accepted, globalWorker, "/project"), /conflicts/);
contents.set(projectSettings, '{"maxSubagentDepth":1}');
assert.equal(policy.managedDelegationPolicyError("delegation-worker", accepted, globalWorker, "/project"), undefined, "matching project setting");
assert.match(policy.managedThinkingError({ provider: "openai-codex", id: "gpt-5.6-terra" }, "high"), /not supported/);
assert.equal(policy.managedThinkingError({ provider: "openai-codex", id: "gpt-5.6-terra" }, "medium"), undefined);
assert.equal(policy.isManagedDelegationType("general-purpose"), false, "non-delegation spawn is rejected by execute gate");
assert.match(policy.freshSpawnTypeError("general-purpose", false), /Only managed/);
assert.equal(policy.freshSpawnTypeError("general-purpose", true), undefined, "resume preserves upstream type behavior");
assert.deepEqual(JSON.parse(JSON.stringify(policy.modelProvenance({ requestedModel: accepted.model, requestedThinking: "medium", initialModelId: accepted.model, initialThinking: "medium", modelId: accepted.model, thinking: "medium" }))), {
  requested: { model: accepted.model, thinking: "medium" },
  initial: { model: accepted.model, thinking: "medium" },
  final: { model: accepted.model, thinking: "medium", evidence: "effective-at-start" },
});
console.log("ok: strict policy behavior rejects hostile overrides and preserves accepted-call provenance");
JS
[ -f "$candidate_fixture/LICENSE" ] && grep -q 'MIT License' "$candidate_fixture/LICENSE"
echo 'ok: candidate fixture includes upstream MIT LICENSE'

# Pristine sources from pi-jev@0.7.0 (MIT, license beside the fixture).
# Copy only managed local artifacts: no vendor clones, package installs, secrets,
# real home-directory writes, or model calls occur in this sandbox.
fixture="$REPO/harness/pi/tests/fixtures/pi-jev-0.7.0"
candidate_fixture="$REPO/harness/pi/tests/fixtures/pi-subagents-0.22.1"
sandbox_repo="$SB/repo"
mkdir -p "$sandbox_repo/harness/pi" "$sandbox_repo/harness/omp/status-line" "$sandbox_repo/install/tools" "$SB/bin"
cp "$REPO/install.sh" "$sandbox_repo/"
cp "$REPO/install/main.sh" "$sandbox_repo/install/"
cp -R "$REPO/install/modules" "$sandbox_repo/install/"
cp -R "$REPO/agents" "$sandbox_repo/"
find "$REPO/harness/pi" -maxdepth 1 -type f ! -name README.md -exec cp {} "$sandbox_repo/harness/pi/" \;
cp -R "$REPO/harness/pi/patches" "$REPO/harness/pi/extensions" "$REPO/harness/pi/bin" "$REPO/harness/pi/prompts" "$sandbox_repo/harness/pi/"
cp "$REPO/harness/omp/APPEND_SYSTEM.md" "$sandbox_repo/harness/omp/"
cp "$REPO/harness/omp/status-line/apply.sh" "$sandbox_repo/harness/omp/status-line/"
printf '#!/bin/sh\nexit 0\n' > "$SB/bin/pi"
# Emulate OMP's config API with JSON (valid YAML), retaining all unowned keys.
cat > "$SB/bin/omp" <<'PY'
#!/usr/bin/python3
import json, os, sys
if sys.argv[1:2] == ["install"]:
    raise SystemExit(0)
assert sys.argv[1:2] == ["config"], sys.argv
filename = os.path.join(os.environ["PI_CODING_AGENT_DIR"], "config.yml")
with open(filename) as f:
    config = json.load(f)
value = config
parts = sys.argv[3].split(".")
for part in parts[:-1]:
    value = value.setdefault(part, {})
if sys.argv[2] == "get":
    value = value.get(parts[-1], "")
    print(value if isinstance(value, str) else json.dumps(value, separators=(",", ":")))
else:
    assert sys.argv[2] == "set", sys.argv
    try:
        setting = json.loads(sys.argv[4])
    except ValueError:
        setting = sys.argv[4]
    value[parts[-1]] = setting
    with open(filename, "w") as f:
        json.dump(config, f)
PY
chmod +x "$SB/bin/pi" "$SB/bin/omp"
cat > "$SB/bin/pnpm" <<'SH'
#!/bin/sh
printf 'pnpm %s\n' "$*" >> "${PNPM_LOG:?}"
exit "${PNPM_STATUS:-0}"
SH
chmod +x "$SB/bin/pnpm"

retired_name="@maplezzk/pi-""interactive""-subagents"
for outcome in success failure; do
  agent_dir="$SB/retired-$outcome"
  package_dir="$agent_dir/npm/node_modules/$retired_name"
  config_dir="$agent_dir/extensions/pi-""interactive""-subagents"
  mkdir -p "$package_dir" "$config_dir"
  printf '{"dependencies":{"%s":"1.0.0"}}\n' "$retired_name" > "$agent_dir/npm/package.json"
  : > "$package_dir/marker"
  : > "$config_dir/marker"
  status=0
  if [ "$outcome" = success ]; then
    PATH="$SB/bin:$PATH" PNPM_LOG="$SB/pnpm-$outcome.log" remove_retired_delegation_state "$agent_dir" || status=$?
    [ "$status" -eq 0 ] || { echo "FAIL: pnpm removal success returned $status" >&2; exit 1; }
    grep -qF -- "--dir $agent_dir/npm remove $retired_name" "$SB/pnpm-$outcome.log"
    [ ! -e "$package_dir" ] && [ ! -e "$config_dir" ] || { echo 'FAIL: successful pnpm removal left retired state' >&2; exit 1; }
  else
    PATH="$SB/bin:$PATH" PNPM_LOG="$SB/pnpm-$outcome.log" PNPM_STATUS=7 remove_retired_delegation_state "$agent_dir" || status=$?
    [ "$status" -eq 1 ] || { echo "FAIL: pnpm removal failure returned $status" >&2; exit 1; }
    [ -e "$package_dir" ] && [ -e "$config_dir" ] || { echo 'FAIL: failed pnpm removal removed retired state' >&2; exit 1; }
  fi
done
echo 'ok: retired delegation pnpm removal success and failure paths'

patches=(pi-jev.patch pi-jev-prompt-guard.patch pi-jev-conservative-thinking.patch pi-jev-self-improve-thinking.patch)
labels=(patch-jev-client patch-jev-prompt-guard patch-jev-conservative-thinking patch-jev-self-improve-thinking)
# All 16 subsets exercise pristine, partial, and fully patched packages.
# Verify both patch orders against fresh pristine fixtures, independent of the installer matrix.
for first in prompt-guard conservative-thinking; do
  pkg="$SB/order-$first"
  mkdir -p "$pkg"
  cp -R "$fixture/." "$pkg/"
  patch -p1 -s -f -d "$pkg" < "$REPO/harness/pi/patches/pi-jev-$first.patch"
  if [[ "$first" == prompt-guard ]]; then
    second=conservative-thinking
  else
    second=prompt-guard
  fi
  patch -p1 -s -f -d "$pkg" < "$REPO/harness/pi/patches/pi-jev-$second.patch"
  echo "ok: $first then $second patches apply to pristine pi-jev fixture"
done
changed_pkg="$SB/changed-conservative-thinking"
cp -R "$fixture" "$changed_pkg"
python3 - "$changed_pkg/src/thinking.ts" <<'PY'
import sys
path = sys.argv[1]
source = open(path).read()
old = "  private running = false;"
assert old in source
open(path, "w").write(source.replace(old, "  private running = true;"))
PY
if patch -p1 -s -f --dry-run -d "$changed_pkg" < "$REPO/harness/pi/patches/pi-jev-conservative-thinking.patch" >/dev/null 2>&1; then
  echo 'FAIL: conservative thinking patch accepted changed upstream' >&2; exit 1
fi
echo 'ok: conservative thinking patch rejects changed upstream context'
for state in {0..15}; do
  home="$SB/home-$state"
  pkg="$home/.pi/agent/npm/node_modules/pi-jev"
  mkdir -p "$(dirname "$pkg")" "$home/.omp/agent" "$home/.omp/profiles/work/agent"
  cp -R "$fixture" "$pkg"
  candidate_pkg="$home/.pi/agent/npm/node_modules/@tintinweb/pi-subagents"
  mkdir -p "$candidate_pkg"
  cp -R "$candidate_fixture/." "$candidate_pkg/"
  agent_profiles="$home/.pi/agent/agents"
  mkdir -p "$agent_profiles"
  printf 'user-owned scout
' > "$agent_profiles/scout.md"
  for role in scout researcher planner worker reviewer-openai reviewer-anthropic; do
    for tier in quick standard high premium; do
      printf 'retired %s-%s
' "$role" "$tier" > "$agent_profiles/$role-$tier.md"
      printf '%s-%s.md
' "$role" "$tier" >> "$agent_profiles/.agentic-tools-pi-agents"
    done
  done
  retired_package="$home/.pi/agent/npm/node_modules/@maplezzk/pi-""interactive""-subagents"
  retired_config="$home/.pi/agent/extensions/pi-""interactive""-subagents"
  mkdir -p "$retired_package" "$retired_config"
  : > "$retired_package/marker"
  : > "$retired_config/marker"
  printf 'node-linker=hoisted\n' > "$home/.pi/agent/npm/.npmrc"
  for i in 0 1 2 3; do
    if (( state & (1 << i) )); then
      patch -p1 -s -f -d "$pkg" < "$REPO/harness/pi/patches/${patches[$i]}"
    fi
  done
  for config in "$home/.omp/agent/config.yml" "$home/.omp/profiles/work/agent/config.yml"; do
    printf '%s\n' '{"modelRoles":{"default":"local-standard","slow":"local-premium"},"composer":{"shape":"compact"}}' > "$config"
  done
  for run in 1 2; do
    (
      cd "$sandbox_repo"
      HOME="$home" PI_CODING_AGENT_DIR="$home/.pi/agent" PATH="$SB/bin:/usr/bin:/bin" \
        TYPESAFE_API_KEY= PI_IMPROVE_NO_ORCA=1 DURABLE_SKIP=1 bash install.sh
    ) > "$SB/install-$state-$run.log" 2>&1 || {
      tail -n 30 "$SB/install-$state-$run.log" >&2; exit 1
    }
    for i in 0 1 2 3; do
      expected=ok
      if (( run == 1 && !(state & (1 << i)) )); then expected=patched; fi
      grep -qF "[${labels[$i]}] -> $pkg ($expected)" "$SB/install-$state-$run.log"
    done
    expected_candidate=ok
    [ "$run" = 1 ] && expected_candidate=patched
    grep -qF "[patch-tintinweb-subagents-strict-dispatch] -> $candidate_pkg ($expected_candidate)" "$SB/install-$state-$run.log"
    if [ "$run" = 1 ]; then
      grep -qF "[pi-agents] -> $agent_profiles (0 ok, 5 copied, 24 removed)" "$SB/install-$state-$run.log"
    else
      grep -qF "[pi-agents] -> $agent_profiles (5 ok)" "$SB/install-$state-$run.log"
    fi
    python3 - "$REPO/agents" "$agent_profiles" <<'PY2'
from pathlib import Path
import sys
src, installed = map(Path, sys.argv[1:])
expected = sorted(x.name for x in src.glob("delegation-*.md"))
assert expected == sorted(x.name for x in installed.glob("delegation-*.md"))
assert (installed / "scout.md").read_text() == "user-owned scout\n"
assert not list(installed.glob("*-standard.md"))
PY2
    for config in "$home/.omp/agent/config.yml" "$home/.omp/profiles/work/agent/config.yml"; do
      jq -e '.modelRoles == {"default":"local-standard","slow":"local-premium"} and .composer.shape == "compact" and .statusLine.preset == "custom"' "$config" >/dev/null
    done
  done
  [ ! -e "$retired_package" ] && [ ! -e "$retired_config" ] || { echo 'FAIL: retired delegation state remains' >&2; exit 1; }
  cmp "$REPO/harness/pi/self-improve.json" "$home/.pi/agent/self-improve.json"
  cmp "$REPO/harness/pi/extensions/pi-fallback.json" "$home/.pi/agent/extensions/pi-fallback.json"
  cmp "$REPO/harness/pi/APPEND_SYSTEM.md" "$home/.pi/agent/APPEND_SYSTEM.md"
  cmp "$REPO/harness/omp/APPEND_SYSTEM.md" "$home/.omp/agent/APPEND_SYSTEM.md"
  echo "ok: candidate strict patch, copied role profiles, and Jev patches are idempotent"
done

# A first install must not leave managed profiles usable while Pi has not yet
# installed the candidate. A successful rerun enables them only after patching.
home="$SB/home-candidate-absent"
agent_dir="$home/.pi/agent"
agent_profiles="$agent_dir/agents"
mkdir -p "$agent_profiles" "$home/.omp/agent"
printf '%s\n' '{"modelRoles":{"default":"local-standard","slow":"local-premium"},"composer":{"shape":"compact"}}' > "$home/.omp/agent/config.yml"
printf 'stale managed profile\n' > "$agent_profiles/delegation-worker.md"
printf 'delegation-worker.md\n' > "$agent_profiles/.agentic-tools-pi-agents"
if (
  cd "$sandbox_repo"
  HOME="$home" PI_CODING_AGENT_DIR="$agent_dir" PATH="$SB/bin:/usr/bin:/bin" \
    TYPESAFE_API_KEY= PI_IMPROVE_NO_ORCA=1 DURABLE_SKIP=1 bash install.sh
) > "$SB/install-candidate-absent.log" 2>&1; then
  echo 'FAIL: candidate-absent install accepted' >&2; exit 1
fi
grep -q 'managed delegation remains disabled' "$SB/install-candidate-absent.log"
grep -q 'strict dispatch patch unavailable' "$SB/install-candidate-absent.log"
[ ! -e "$agent_profiles/delegation-worker.md" ] || { echo 'FAIL: absent candidate left managed profile enabled' >&2; exit 1; }
[ ! -e "$agent_profiles/.agentic-tools-pi-agents" ] || { echo 'FAIL: absent candidate left managed manifest' >&2; exit 1; }
candidate_pkg="$agent_dir/npm/node_modules/@tintinweb/pi-subagents"
mkdir -p "$candidate_pkg"
cp -R "$candidate_fixture/." "$candidate_pkg/"
(
  cd "$sandbox_repo"
  HOME="$home" PI_CODING_AGENT_DIR="$agent_dir" PATH="$SB/bin:/usr/bin:/bin" \
    TYPESAFE_API_KEY= PI_IMPROVE_NO_ORCA=1 DURABLE_SKIP=1 bash install.sh
) > "$SB/install-candidate-enabled.log" 2>&1 || { tail -n 30 "$SB/install-candidate-enabled.log" >&2; exit 1; }
grep -qF "[patch-tintinweb-subagents-strict-dispatch] -> $candidate_pkg (patched)" "$SB/install-candidate-enabled.log"
[ -f "$agent_profiles/delegation-worker.md" ] || { echo 'FAIL: patched candidate did not enable managed profiles' >&2; exit 1; }
echo 'ok: first install fails closed and patched reinstall enables managed profiles'

# Lite retirement must preserve package state when pnpm fails, and remove only Lite on success.
for outcome in success failure; do
  agent_dir="$SB/lite-$outcome"
  lite_pkg="$agent_dir/npm/node_modules/pi-subagents-lite"
  candidate_pkg="$agent_dir/npm/node_modules/@tintinweb/pi-subagents"
  mkdir -p "$lite_pkg" "$candidate_pkg"
  printf '{"dependencies":{"pi-subagents-lite":"1.17.1"}}\n' > "$agent_dir/npm/package.json"
  status=0
  if [ "$outcome" = success ]; then
    PATH="$SB/bin:$PATH" PNPM_LOG="$SB/lite-$outcome.log" remove_retired_lite_subagents_state "$agent_dir" || status=$?
    [ "$status" -eq 0 ] || { echo 'FAIL: Lite removal success failed' >&2; exit 1; }
    [ ! -e "$lite_pkg" ] && [ -d "$candidate_pkg" ] || { echo 'FAIL: Lite success altered wrong package state' >&2; exit 1; }
  else
    PATH="$SB/bin:$PATH" PNPM_LOG="$SB/lite-$outcome.log" PNPM_STATUS=9 remove_retired_lite_subagents_state "$agent_dir" || status=$?
    [ "$status" -eq 1 ] || { echo 'FAIL: Lite pnpm failure accepted' >&2; exit 1; }
    [ -d "$lite_pkg" ] && [ -d "$candidate_pkg" ] || { echo 'FAIL: Lite pnpm failure changed package state' >&2; exit 1; }
  fi
done
echo 'ok: Lite retirement preserves state on pnpm failure and preserves the candidate'

# Candidate patch failure must aggregate after independent Jev patch attempts.
home="$SB/home-candidate-failure"
pkg="$home/.pi/agent/npm/node_modules/pi-jev"
candidate_pkg="$home/.pi/agent/npm/node_modules/@tintinweb/pi-subagents"
mkdir -p "$(dirname "$pkg")" "$candidate_pkg" "$home/.omp/agent" "$home/.omp/profiles/work/agent"
cp -R "$fixture" "$pkg"
cp -R "$candidate_fixture/." "$candidate_pkg/"
agent_profiles="$home/.pi/agent/agents"
mkdir -p "$agent_profiles"
printf 'managed profile\n' > "$agent_profiles/delegation-worker.md"
printf 'delegation-worker.md\n' > "$agent_profiles/.agentic-tools-pi-agents"
printf 'node-linker=hoisted\n' > "$home/.pi/agent/npm/.npmrc"
printf 'changed upstream\n' > "$candidate_pkg/src/index.ts"
for config in "$home/.omp/agent/config.yml" "$home/.omp/profiles/work/agent/config.yml"; do
  printf '%s\n' '{"modelRoles":{"default":"local-standard","slow":"local-premium"},"composer":{"shape":"compact"}}' > "$config"
done
if (
  cd "$sandbox_repo"
  HOME="$home" PI_CODING_AGENT_DIR="$home/.pi/agent" PATH="$SB/bin:/usr/bin:/bin" \
    TYPESAFE_API_KEY= PI_IMPROVE_NO_ORCA=1 DURABLE_SKIP=1 bash install.sh
) > "$SB/install-candidate-failure.log" 2>&1; then
  echo 'FAIL: changed candidate source accepted' >&2; exit 1
fi
grep -qF '[patch-tintinweb-subagents-strict-dispatch] upstream code changed' "$SB/install-candidate-failure.log"
[ ! -e "$agent_profiles/delegation-worker.md" ] || { echo 'FAIL: failed patch left managed profile enabled' >&2; exit 1; }
grep -qF "[patch-jev-client] -> $pkg (patched)" "$SB/install-candidate-failure.log"
grep -qF 'install.sh: a required patch failed' "$SB/install-candidate-failure.log"
echo 'ok: candidate strict-patch failure aggregates after independent patches'

# A failed patch remains an installer failure, but the modular loop still runs
# the unrelated Jev patches before install_main reports PATCH_FAILED.
home="$SB/home-failed-thinking"
pkg="$home/.pi/agent/npm/node_modules/pi-jev"
mkdir -p "$(dirname "$pkg")" "$home/.omp/agent" "$home/.omp/profiles/work/agent"
cp -R "$fixture" "$pkg"
printf 'node-linker=hoisted\n' > "$home/.pi/agent/npm/.npmrc"
for config in "$home/.omp/agent/config.yml" "$home/.omp/profiles/work/agent/config.yml"; do
  printf '%s\n' '{"modelRoles":{"default":"local-standard","slow":"local-premium"},"composer":{"shape":"compact"}}' > "$config"
done
python3 - "$pkg/extensions/index.ts" <<'PY'
import sys
path = sys.argv[1]
source = open(path).read()
old = 'const autoThinking = new AutoThinkingRouter(pi, Boolean(pi.getFlag("jev-thinking")));'
assert old in source
open(path, "w").write(source.replace(old, 'const autoThinking = upstreamRouter(pi);'))
PY
if (
  cd "$sandbox_repo"
  HOME="$home" PI_CODING_AGENT_DIR="$home/.pi/agent" PATH="$SB/bin:/usr/bin:/bin" \
    TYPESAFE_API_KEY= PI_IMPROVE_NO_ORCA=1 DURABLE_SKIP=1 bash install.sh
) > "$SB/install-failed-thinking.log" 2>&1; then
  echo 'FAIL: failed self-improve thinking patch accepted' >&2; exit 1
fi
grep -qF "[patch-jev-client] -> $pkg (patched)" "$SB/install-failed-thinking.log"
grep -qF "[patch-jev-prompt-guard] -> $pkg (patched)" "$SB/install-failed-thinking.log"
grep -qF "[patch-jev-conservative-thinking] -> $pkg (patched)" "$SB/install-failed-thinking.log"
grep -qF '[patch-jev-self-improve-thinking] upstream code changed' "$SB/install-failed-thinking.log"
grep -qF '[patch-fallback] ' "$SB/install-failed-thinking.log"
grep -qF 'install.sh: a required patch failed' "$SB/install-failed-thinking.log" || {
  cat "$SB/install-failed-thinking.log" >&2
  exit 1
}
echo 'ok: failed self-improve thinking patch aggregates after unrelated patches run'

home="$SB/home-ok"
pkg="$home/.pi/agent/npm/node_modules/pi-jev"
mkdir -p "$(dirname "$pkg")"
cp -R "$fixture" "$pkg"
for patch_file in "${patches[@]}"; do
  patch -p1 -s -f -d "$pkg" < "$REPO/harness/pi/patches/$patch_file"
done

pkg="$SB/home-ok/.pi/agent/npm/node_modules/pi-jev"
# Evaluate the installed fixture's real flag default, construction, and conservative router.
# Stub only model capability helpers; no Pi SDK or third-party modules are needed.
node - "$pkg" "$REPO/harness/pi/tests/fixtures/pi-jev-skill-wrapped-prompt.txt" <<'JS'
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const { stripTypeScriptTypes } = require("node:module");
const [pkg, fixture] = process.argv.slice(2);
try {
  stripTypeScriptTypes("class X { constructor(public x: string) {} }", { mode: "transform" });
} catch (error) {
  if (error?.code !== "ERR_INVALID_ARG_VALUE") throw error;
  console.log("ok: conservative thinking runtime evaluation skipped (Node lacks TypeScript transform mode)");
  process.exit(0);
}
const source = fs.readFileSync(`${pkg}/extensions/index.ts`, "utf8");
const flagDefault = source.match(/pi\.registerFlag\("jev-thinking", \{[\s\S]*?default: (.+),/)[1];
const construction = source.match(/const autoThinking = (new AutoThinkingRouter\([\s\S]*?\));/)[1];
const routerSource = stripTypeScriptTypes(
  fs.readFileSync(`${pkg}/src/thinking.ts`, "utf8").replace(/^import .*;\n/gm, ""),
  { mode: "transform" },
).replace(/^export /gm, "");
const AutoThinkingRouter = vm.runInNewContext(`${routerSource}\nAutoThinkingRouter`, {
  clampThinkingLevel: (_model, level) => level,
  getSupportedThinkingLevels: () => ["off", "minimal", "low", "medium", "high", "xhigh"],
});
const model = { api: "anthropic-messages", compat: { forceAdaptiveThinking: true } };
function routerAt(initial) {
  let level = initial;
  let router;
  const pi = { setThinkingLevel: (next) => { router.observe(next, level); level = next; } };
  router = new AutoThinkingRouter(pi, true);
  return { router, context: () => ({ model, thinkingLevel: level }), level: () => level, setExternal: (next) => { const old = level; level = next; router.observe(next, old); } };
}
(async () => {
  for (const [name, markers, initial, enabled, override] of [
    ["main", {}, "medium", true],
    ["worker", { PI_SELF_IMPROVE_CHILD: "worker" }, "medium", false],
    ["reflect", { PI_SELF_IMPROVE_CHILD: "reflect" }, "medium", false],
    ["worker with explicit Jev flag", { PI_SELF_IMPROVE_CHILD: "worker" }, "medium", false, true],
  ]) {
    let level = initial;
    const context = { process: { env: { PI_JEV_THINKING: "1", ...markers } }, envAutoEnabledFor: () => true, Boolean, AutoThinkingRouter };
    context.pi = { getFlag: () => override ?? vm.runInNewContext(flagDefault, context), setThinkingLevel: (next) => { level = next; } };
    const router = vm.runInNewContext(construction, context);
    assert.equal(router.enabled, enabled, name);
    await router.route("security root cause", { model, thinkingLevel: initial });
    assert.equal(level, enabled ? "high" : initial, name);
  }
  let state = routerAt("medium");
  await state.router.route(fs.readFileSync(fixture, "utf8"), state.context());
  assert.equal(state.level(), "medium", "skill wrapper is ignored");
  for (const prompt of ["debug why X fails", "security root cause", "diagnose this failure", "investigate this regression", "architecture review"]) {
    state = routerAt("medium"); await state.router.route(prompt, state.context());
    assert.equal(state.level(), "high", prompt);
  }
  for (const prompt of ["Please don't think harder", "don't ever think harder", "do not use xhigh", "never use ultrathink"]) {
    state = routerAt("medium"); await state.router.route(prompt, state.context());
    assert.equal(state.level(), "medium", `${prompt} is not an explicit request`);
  }
  for (const prompt of ["ultrathink this", "think hard about this", "use xhigh", "no problem, think hard about this", "Array<string>; ultrathink"]) {
    state = routerAt("medium"); await state.router.route(prompt, state.context());
    assert.equal(state.level(), "high", `${prompt} is capped by medium baseline`);
    state = routerAt("high"); await state.router.route(prompt, state.context());
    assert.equal(state.level(), "xhigh", `${prompt} reaches xhigh from high baseline`);
  }
  state = routerAt("low"); await state.router.route("debug why X fails", state.context());
  assert.equal(state.level(), "medium", "low baseline caps debug");
  for (const prompt of ["ok", "list files"]) {
    state = routerAt("medium"); await state.router.route(prompt, state.context());
    assert.equal(state.level(), "minimal", prompt);
  }
  for (const prompt of ["> ultrathink", "```\nsecurity root cause\n```", "<context>think hard</context>", "2026-10-20 ERROR security root cause", "# Handoff\nultrathink"]) {
    state = routerAt("medium"); await state.router.route(prompt, state.context());
    assert.equal(state.level(), "medium", `ignored content: ${prompt}`);
  }
  state = routerAt("medium");
  await state.router.route("debug why X fails", state.context());
  await state.router.route("ordinary request", state.context());
  assert.equal(state.level(), "medium", "router changes do not ratchet the baseline");
  state = routerAt("medium");
  await state.router.route("debug why X fails", state.context());
  assert.equal(state.level(), "high", "medium baseline routes debug to high");
  state.setExternal("high");
  await state.router.route("ultrathink this", state.context());
  assert.equal(state.level(), "xhigh", "manual reselection of the applied level becomes the baseline");
  state.setExternal("low");
  await state.router.route("debug why X fails", state.context());
  assert.equal(state.level(), "medium", "external baseline changes are honored");
  console.log("ok: conservative user-owned thinking policy and baseline caps");
})().catch((error) => { console.error(error); process.exitCode = 1; });
JS
