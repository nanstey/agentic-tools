// Tests the guard added by pi-subagent-done-requires-summary.patch.
// Usage: node harness/pi/tests/subagent-done-summary.test.mjs <subagent-done.ts>
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { stripTypeScriptTypes } from "node:module";

const [sourcePath] = process.argv.slice(2);
assert(sourcePath, "Pass the patched subagent-done.ts path");
const source = fs.readFileSync(sourcePath, "utf8");
const match = source.match(/export function hasAssistantSummarySinceLastUser\([\s\S]*?\n}\n/);
assert(match, "subagent_done must define the assistant-summary guard");
const hasAssistantSummarySinceLastUser = vm.runInNewContext(
  `${stripTypeScriptTypes(match[0], { mode: "transform" }).replace("export ", "")}\nhasAssistantSummarySinceLastUser`,
);
const message = (role, content) => ({ type: "message", message: { role, content } });

assert.equal(hasAssistantSummarySinceLastUser([]), false);
assert.equal(hasAssistantSummarySinceLastUser([message("user", [])]), false);
assert.equal(hasAssistantSummarySinceLastUser([message("user", []), message("assistant", [])]), false);
assert.equal(
  hasAssistantSummarySinceLastUser([
    message("user", []),
    message("assistant", [{ type: "text", text: "Final summary" }]),
  ]),
  true,
);
assert.equal(
  hasAssistantSummarySinceLastUser([
    message("assistant", [{ type: "text", text: "Old summary" }]),
    message("user", []),
  ]),
  false,
);
assert.match(
  source,
  /!hasSchema\s*&&\s*params\.result === undefined\s*&&\s*!hasAssistantSummarySinceLastUser\(ctx\.sessionManager\.getBranch\(\)\)/,
  "subagent_done must refuse an empty result without an assistant summary",
);
console.log("ok: empty subagent_done is refused until an assistant summary exists; result and structured paths stay available");
