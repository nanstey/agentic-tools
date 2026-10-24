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
