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

# pi-subagents-lite@1.17.1 ignores the symlinked profiles installed by this
# repository because Dirent.isFile() is false for a symlink. Exercise the
# package patch against its original scan shape and prove discovery changes.
subagents="$SB/pi-subagents-lite"
mkdir -p "$subagents/src/agents" "$SB/agent-profiles"
cat > "$subagents/src/agents/agent-discovery.ts" <<'TS'
import * as fs from "node:fs";
import * as path from "node:path";

type AgentConfigFromMd = { name: string; source: string };

function parseAgentFile(content, source): AgentConfigFromMd {
  return { name: content.trim(), source };
}

export async function scanAgentFilesInDir(dirPath, source = "user") {
  try {
    await fs.promises.access(dirPath);
  } catch {
    return [];
  }

  const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
  const mdFiles = entries.filter((e) => e.isFile() && e.name.endsWith(".md"));

  const agents: AgentConfigFromMd[] = [];
  for (const entry of mdFiles) {
    const filePath = path.join(dirPath, entry.name);
    try {
      const content = await fs.promises.readFile(filePath, "utf-8");
      const info = parseAgentFile(content, source);
      if (info.name) {
        agents.push(info);
      }
    } catch {
      // Skip files that can't be read
    }
  }
  return agents;
}
TS
cp "$subagents/src/agents/agent-discovery.ts" "$SB/subagents-agent-discovery.pristine.ts"
printf 'regular\n' > "$SB/agent-profiles/regular.md"
printf 'symlinked\n' > "$SB/symlinked.md"
ln -s "$SB/symlinked.md" "$SB/agent-profiles/symlinked.md"
ln -s "$SB/missing.md" "$SB/agent-profiles/dangling.md"
check_subagents_discovery() {
  python3 - "$subagents/src/agents/agent-discovery.ts" "$SB/agent-discovery.mjs" <<'PY'
import sys
source = open(sys.argv[1]).read()
source = source.replace('type AgentConfigFromMd = { name: string; source: string };\n\n', '')
source = source.replace('function parseAgentFile(content, source): AgentConfigFromMd', 'function parseAgentFile(content, source)')
source = source.replace('const agents: AgentConfigFromMd[] = [];', 'const agents = [];')
open(sys.argv[2], 'w').write(source)
PY
  node - "$SB/agent-discovery.mjs" "$SB/agent-profiles" "$1" <<'JS'
const assert = require("node:assert/strict");
(async () => {
  const [modulePath, dir, expected] = process.argv.slice(2);
  const { scanAgentFilesInDir } = await import(`file://${modulePath}`);
  const names = (await scanAgentFilesInDir(dir)).map((agent) => agent.name).sort();
  assert.deepEqual(names, expected.split(","));
})().catch((error) => { console.error(error); process.exitCode = 1; });
JS
}
check_subagents_discovery regular
apply_package_patch "$subagents" patch-subagents-lite-symlinks "$REPO/harness/pi/patches/pi-subagents-lite-symlink-discovery.patch" src/agents/agent-discovery.ts | grep -q '(patched)'
check_subagents_discovery regular,symlinked
apply_package_patch "$subagents" patch-subagents-lite-symlinks "$REPO/harness/pi/patches/pi-subagents-lite-symlink-discovery.patch" src/agents/agent-discovery.ts | grep -q '(ok)'
echo 'ok: subagents discovery patch finds symlinked profiles and is idempotent'

# Pristine sources from pi-jev@0.7.0 (MIT, license beside the fixture).
# Copy only managed local artifacts: no vendor clones, package installs, secrets,
# real home-directory writes, or model calls occur in this sandbox.
fixture="$REPO/harness/pi/tests/fixtures/pi-jev-0.7.0"
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
  subagents_pkg="$home/.pi/agent/npm/node_modules/pi-subagents-lite"
  mkdir -p "$subagents_pkg/src/agents"
  cp "$SB/subagents-agent-discovery.pristine.ts" "$subagents_pkg/src/agents/agent-discovery.ts"
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
    expected=ok; [ "$run" = 1 ] && expected=patched
    grep -qF "[patch-subagents-lite-symlinks] -> $subagents_pkg ($expected)" "$SB/install-$state-$run.log"
    for config in "$home/.omp/agent/config.yml" "$home/.omp/profiles/work/agent/config.yml"; do
      jq -e '.modelRoles == {"default":"local-standard","slow":"local-premium"} and .composer.shape == "compact" and .statusLine.preset == "custom"' "$config" >/dev/null
    done
  done
  [ ! -e "$retired_package" ] && [ ! -e "$retired_config" ] || { echo 'FAIL: retired delegation state remains' >&2; exit 1; }
  cmp "$REPO/harness/pi/self-improve.json" "$home/.pi/agent/self-improve.json"
  cmp "$REPO/harness/pi/extensions/pi-fallback.json" "$home/.pi/agent/extensions/pi-fallback.json"
  cmp "$REPO/harness/pi/APPEND_SYSTEM.md" "$home/.pi/agent/APPEND_SYSTEM.md"
  cmp "$REPO/harness/omp/APPEND_SYSTEM.md" "$home/.omp/agent/APPEND_SYSTEM.md"
  echo "ok: Jev patches install missing patches, then all report ok; policies copied; OMP modelRoles preserved"
done
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

pkg="$SB/home-15/.pi/agent/npm/node_modules/pi-jev"
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
