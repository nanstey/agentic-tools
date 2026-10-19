// Offline smoke test against installed packages, without starting a session.
// Usage: node harness/pi/tests/package-extensions.test.mjs <Pi SDK dir> <Pi agent dir>
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [sdkDir, agentDir] = process.argv.slice(2);
assert(sdkDir && agentDir, "Pass the Pi SDK package directory and Pi agent directory");
const { loadExtensions, createExtensionRuntime } = await import(
  pathToFileURL(path.resolve(sdkDir, "dist/core/extensions/loader.js")).href
);
const packages = path.resolve(agentDir, "npm/node_modules");
const diffPath = path.join(packages, "@heyhuynhgiabuu/pi-diff/dist/index.js");
const errors = [];
const originalError = console.error;
console.error = (...args) => errors.push(args.join(" "));
let diff;
try {
  diff = await loadExtensions([diffPath], process.cwd());
} finally {
  console.error = originalError;
}
assert.deepEqual(errors, [], "pi-diff must not swallow an SDK dependency error");
assert.deepEqual(diff.errors, []);
assert.equal(diff.extensions.length, 1);
for (const tool of ["write", "edit", "apply_patch"]) {
  assert(diff.extensions[0].tools.has(tool), `pi-diff must register ${tool}`);
}
console.log("ok: pi-diff loads host SDK and registers write, edit, apply_patch");

// Do not write activity records into the running agent's session.
for (const name of ["PI_SUBAGENT_ID", "PI_SUBAGENT_ACTIVITY_FILE", "PI_SUBAGENT_SESSION"]) {
  delete process.env[name];
}
const widgetPath = path.join(packages, "@maplezzk/pi-interactive-subagents/pi-extension/subagents/subagent-done.ts");
// Control: without denial, caller_ping must register, so the denial assertion below can fail.
const control = await loadExtensions([widgetPath], process.cwd(), undefined, createExtensionRuntime());
assert(control.extensions[0].tools.has("caller_ping"), "control: caller_ping registers when not denied");
process.env.PI_DENY_TOOLS = "caller_ping,write";
process.env.PI_SUBAGENT_NAME = "test-child";
const runtime = createExtensionRuntime();
runtime.getAllTools = () => [{ name: "read" }, { name: "subagent_done" }];
const child = await loadExtensions(
  [path.join(packages, "@maplezzk/pi-interactive-subagents/pi-extension/subagents/subagent-done.ts")],
  process.cwd(), undefined, runtime,
);
assert.deepEqual(child.errors, []);
const extension = child.extensions[0];
assert(!extension.tools.has("caller_ping"), "caller_ping must remain denied");
assert(extension.tools.has("subagent_done"), "subagent_done must remain available");
let widget;
const theme = { fg: (_key, text) => text, bg: (_key, text) => text, bold: (text) => text };
const ctx = { ui: { setWidget: (_name, factory) => { widget = factory({}, theme); } } };
for (const handler of extension.handlers.get("session_start")) await handler({}, ctx);
const collapsed = widget.render(120).join("\n");
assert.match(collapsed, /2 tools/);
assert.doesNotMatch(collapsed, /denied/);
await extension.shortcuts.get("ctrl+j").handler(ctx);
const expanded = widget.render(120).join("\n");
assert.match(expanded, /2 available/);
assert.match(expanded, /read, subagent_done/);
assert.doesNotMatch(expanded, /denied|caller_ping|write/);
console.log("ok: both widget views hide denied tools; caller_ping denial remains enforced");
