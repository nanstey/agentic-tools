// Offline regression test. Only sandbox copies and mocked model calls are used.
// Usage: node harness/pi/tests/fallback-provider-lock.test.mjs <Pi SDK dir> <pi-fallback-models dir>
import assert from "node:assert/strict";
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [sdkDir, packageDir] = process.argv.slice(2);
assert(sdkDir && packageDir, "Pass the Pi SDK and pi-fallback-models package directories");
const { loadExtensions, createExtensionRuntime } = await import(
  pathToFileURL(path.resolve(sdkDir, "dist/core/extensions/loader.js")).href
);
const { createEventBus } = await import(
  pathToFileURL(path.resolve(sdkDir, "dist/core/event-bus.js")).href
);
const sandbox = mkdtempSync(path.join(os.tmpdir(), "fallback-lock-"));
const previousEnv = Object.fromEntries(
  ["PI_CODING_AGENT_DIR", "PI_SUBAGENT_AGENT"].map((key) => [key, process.env[key]]),
);
const anthropic = "anthropic/claude-opus-5-5";
const sonnet = "anthropic/claude-sonnet-5-5";
const openai = "openai-codex/gpt-6.1-sol";
const luna = "openai-codex/gpt-6-luna";
const mixedChain = [openai, sonnet];
const models = new Map([anthropic, sonnet, openai, luna].map((ref) => {
  const [provider, id] = ref.split("/");
  return [ref, { provider, id, contextWindow: 100000 }];
}));

try {
  const extensionPath = path.join(sandbox, "package/src/extension.ts");
  cpSync(path.resolve(packageDir, "src"), path.dirname(extensionPath), { recursive: true });
  let run = 0;
  async function check({ role = "reviewer", baseline = anthropic, chain = mixedChain,
    expected = [sonnet], scope = "global", viaBus = false, missingBaseline = false }) {
    const cwd = path.join(sandbox, String(++run));
    const agentDir = path.join(cwd, "agent");
    process.env.PI_CODING_AGENT_DIR = agentDir;
    if (role === null) delete process.env.PI_SUBAGENT_AGENT;
    else process.env.PI_SUBAGENT_AGENT = role;
    const configPath = scope === "directory"
      ? path.join(cwd, ".pi/pi-fallback.json")
      : path.join(agentDir, "extensions/pi-fallback.json");
    mkdirSync(path.dirname(configPath), { recursive: true });
    // More-specific settings must not bypass the lock.
    writeFileSync(configPath, JSON.stringify({ version: 1, fallbacks: chain }));
    const selected = [];
    const requests = [];
    const retries = [];
    const notices = [];
    let status;
    let extension;
    const ctx = {
      cwd,
      model: missingBaseline ? undefined : models.get(baseline),
      isProjectTrusted: () => true,
      isIdle: () => true,
      getContextUsage: () => ({ tokens: 0 }),
      sessionManager: { getBranch: () => scope === "session" ? [{
        type: "custom", customType: "pi-fallback-settings", data: { fallbacks: chain },
      }] : [] },
      modelRegistry: { find: (provider, id) => models.get(`${provider}/${id}`) },
      ui: {
        setStatus: (_name, value) => { status = value; },
        notify: (message) => notices.push(message),
      },
    };
    async function emit(name, event = {}) {
      for (const handler of extension.handlers.get(name) ?? []) await handler(event, ctx);
    }
    const runtime = createExtensionRuntime();
    runtime.getCommands = () => viaBus ? [{ name: "switch" }] : [];
    runtime.sendUserMessage = (content) => retries.push(content);
    runtime.setModel = async (model) => {
      selected.push(`${model.provider}/${model.id}`);
      ctx.model = model;
      await emit("model_select", { model, source: "set" });
      return true;
    };
    const bus = createEventBus();
    bus.on("pi-switch:request", (data) => {
      requests.push(data.model);
      bus.emit("pi-switch:switched", { to: data.model });
    });
    const loaded = await loadExtensions([extensionPath], cwd, bus, runtime);
    assert.deepEqual(loaded.errors, []);
    [extension] = loaded.extensions;
    await emit("session_start");
    if (missingBaseline) ctx.model = models.get(baseline);
    const content = "Review the sandbox change";
    await emit("message_end", { message: { role: "user", content } });
    // One failure per expected fallback, then one more to exhaust the chain.
    for (let attempt = 0; attempt <= expected.length; attempt++) {
      await emit("agent_end", { messages: [{ role: "assistant", stopReason: "error",
        provider: ctx.model.provider, model: ctx.model.id,
        errorMessage: "400 You're out of extra usage",
      }] });
      await emit("agent_settled");
      assert.deepEqual(selected, expected.slice(0, attempt + 1), `${role}: ${scope}, bus=${viaBus}`);
      assert.deepEqual(requests, viaBus ? selected : [], "No blocked model reaches the switch bus");
      assert.deepEqual(retries, selected.map(() => content), "Only selected models receive retries");
    }
    assert.match(status, /fallbacks exhausted/);
    assert.match(notices.at(-1), /no usable fallback remains/);
    console.log(`ok: ${role ?? "main"}, ${baseline}, ${scope}, bus=${viaBus}, fallbacks=${selected.length}`);
  }

  for (const scope of ["global", "directory", "session"]) {
    for (const viaBus of [false, true]) await check({ scope, viaBus });
  }
  await check({ chain: [openai], expected: [] });
  await check({ baseline: openai, chain: [sonnet, luna], expected: [luna] });
  await check({ baseline: openai, chain: [sonnet], expected: [], viaBus: true });
  await check({ chain: mixedChain, expected: [], missingBaseline: true });
  for (const role of ["worker", "scout", "researcher", "planner", null]) {
    await check({ role, expected: mixedChain });
  }
} finally {
  for (const [key, value] of Object.entries(previousEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  rmSync(sandbox, { recursive: true, force: true });
}
