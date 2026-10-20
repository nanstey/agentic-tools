#!/usr/bin/env bash
# Offline applicator regression tests. No installed packages are modified.
set -euo pipefail
REPO="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$REPO"
SB="$(mktemp -d)"
trap 'rm -rf "$SB"' EXIT
# Load definitions only, without running the installer or reading local secrets.
source "$REPO/install/modules/patches.sh"
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
patches=(pi-jev.patch pi-jev-prompt-guard.patch pi-jev-self-improve-thinking.patch)
labels=(patch-jev-client patch-jev-prompt-guard patch-jev-self-improve-thinking)
# All subsets include pristine, existing-only, prompt-guard-only, the usual
# existing+prompt-guard state, and fully patched packages.
for state in {0..7}; do
  home="$SB/home-$state"
  pkg="$home/.pi/agent/npm/node_modules/pi-jev"
  mkdir -p "$(dirname "$pkg")" "$home/.omp/agent" "$home/.omp/profiles/work/agent"
  cp -R "$fixture" "$pkg"
  printf 'node-linker=hoisted\n' > "$home/.pi/agent/npm/.npmrc"
  for i in 0 1 2; do
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
        TYPESAFE_API_KEY= PI_IMPROVE_NO_ORCA=1 bash install.sh
    ) > "$SB/install-$state-$run.log" 2>&1 || {
      tail -n 30 "$SB/install-$state-$run.log" >&2; exit 1
    }
    for i in 0 1 2; do
      expected=ok
      if (( run == 1 && !(state & (1 << i)) )); then expected=patched; fi
      grep -qF "[${labels[$i]}] -> $pkg ($expected)" "$SB/install-$state-$run.log"
    done
    for config in "$home/.omp/agent/config.yml" "$home/.omp/profiles/work/agent/config.yml"; do
      jq -e '.modelRoles == {"default":"local-standard","slow":"local-premium"} and .composer.shape == "compact" and .statusLine.preset == "custom"' "$config" >/dev/null
    done
  done
  cmp "$REPO/harness/pi/self-improve.json" "$home/.pi/agent/self-improve.json"
  cmp "$REPO/harness/pi/extensions/pi-fallback.json" "$home/.pi/agent/extensions/pi-fallback.json"
  cmp "$REPO/harness/pi/APPEND_SYSTEM.md" "$home/.pi/agent/APPEND_SYSTEM.md"
  cmp "$REPO/harness/omp/APPEND_SYSTEM.md" "$home/.omp/agent/APPEND_SYSTEM.md"
  echo "ok: Jev patch state $state installs missing patches, then all report ok; policies copied; OMP modelRoles preserved"
done

# Evaluate the installed fixture's real flag default, construction, and router.
# Stub only model capability helpers; no Pi SDK or third-party modules are needed.
node - "$pkg" <<'JS'
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const { stripTypeScriptTypes } = require("node:module");
const pkg = process.argv[2];
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
(async () => {
  for (const [name, markers, initial, enabled, override] of [
    ["main", {}, "medium", true],
    ["named subagent", { PI_SUBAGENT_NAME: "worker" }, "high", false],
    ["worker", { PI_SELF_IMPROVE_CHILD: "worker" }, "medium", false],
    ["reflect", { PI_SELF_IMPROVE_CHILD: "reflect" }, "medium", false],
    ["worker with explicit Jev flag", { PI_SELF_IMPROVE_CHILD: "worker" }, "medium", false, true],
  ]) {
    let level = initial;
    const context = {
      process: { env: { PI_JEV_THINKING: "1", ...markers } },
      envAutoEnabledFor: () => true,
      Boolean,
      AutoThinkingRouter,
    };
    context.pi = {
      getFlag: () => override ?? vm.runInNewContext(flagDefault, context),
      setThinkingLevel: (next) => { level = next; },
    };
    const router = vm.runInNewContext(construction, context);
    assert.equal(router.enabled, enabled, name);
    await router.route("security root cause", {
      model: { api: "anthropic-messages", compat: { forceAdaptiveThinking: true } },
      thinkingLevel: initial,
    });
    assert.equal(level, enabled ? "xhigh" : initial, name);
    console.log(`ok: ${name} ${enabled ? "keeps automatic thinking" : "retains selected or inherited thinking"}`);
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
JS
