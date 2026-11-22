import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { defaultConfig, isIgnored, loadConfig, parseConfig } from "../scripts/config.ts";

const EXAMPLE = readFileSync(join(import.meta.dirname, "../../../../config.example.json"), "utf8");

test("defaults keep posting off and ignore nothing", () => {
  assert.deepEqual(parseConfig("{}", "c"), { review: { autoPost: false }, ignore: [] });
  assert.deepEqual(parseConfig('{"prflow":{"limit":1},"futureTool":true}', "c"), defaultConfig());
});

test("the shipped config.example.json parses with posting off", () => {
  const cfg = parseConfig(EXAMPLE, "config.example.json");
  assert.equal(cfg.review.autoPost, false);
  assert.deepEqual(cfg.ignore, ["my-archived-repo"]);
});

test("orchestrator section is strict about its own keys", () => {
  assert.deepEqual(parseConfig('{"orchestrator":{"$comment":"x","review":{"$comment":"y","autoPost":true},"ignore":["a","o/b"]}}', "c"), { review: { autoPost: true }, ignore: ["a", "o/b"] });
  assert.throws(() => parseConfig('{"orchestrator":{"other":1}}', "c"), /^Error: c: orchestrator\.unknown key "other"$/);
  assert.throws(() => parseConfig('{"orchestrator":{"review":{"post":true}}}', "c"), /orchestrator\.review: unknown key "post"/);
  assert.throws(() => parseConfig('{"orchestrator":{"review":{"autoPost":"yes"}}}', "c"), /autoPost must be a boolean/);
  assert.throws(() => parseConfig('{"orchestrator":{"review":[]}}', "c"), /review must be an object/);
  assert.throws(() => parseConfig('{"orchestrator":{"ignore":[""]}}', "c"), /ignore must be an array/);
  assert.throws(() => parseConfig('{"orchestrator":[]}', "c"), /orchestrator must be an object/);
});

test("ignore matches display name, folder name, or owner/repo, case-insensitively", () => {
  const cfg = parseConfig('{"orchestrator":{"ignore":["Old-App","acme/legacy"]}}', "c");
  assert.ok(isIgnored(cfg, { name: "old-app" }));
  assert.ok(isIgnored(cfg, { path: "/code/OLD-APP" }));
  assert.ok(isIgnored(cfg, { slug: "ACME/legacy" }));
  assert.ok(!isIgnored(cfg, { name: "legacy", slug: "other/legacy" }));
  assert.ok(!isIgnored(cfg, {}));
});

test("loads the explicit file, then AGENTIC_TOOLS_CONFIG, then defaults", () => {
  const files: Record<string, string> = { "/a.json": '{"orchestrator":{"ignore":["a"]}}', "/e.json": '{"orchestrator":{"ignore":["e"]}}' };
  const read = (p: string) => files[p] ?? null;
  assert.deepEqual(loadConfig("/a.json", { AGENTIC_TOOLS_CONFIG: "/e.json" }, read).config.ignore, ["a"]);
  assert.equal(loadConfig(undefined, { AGENTIC_TOOLS_CONFIG: "/e.json" }, read).source, "/e.json");
  assert.throws(() => loadConfig("/missing.json", {}, read), /not found/);
  assert.equal(loadConfig(undefined, { XDG_CONFIG_HOME: "/none" }, () => null).source, "defaults");
});

test("config.ts prints the effective settings and exits 2 on a bad file", () => {
  const dir = mkdtempSync(join(tmpdir(), "orch-config-"));
  const good = join(dir, "good.json");
  const bad = join(dir, "bad.json");
  writeFileSync(good, '{"orchestrator":{"review":{"autoPost":true}}}');
  writeFileSync(bad, '{"orchestrator":{"nope":1}}');
  const script = join(import.meta.dirname, "../scripts/config.ts");
  const ok = spawnSync(process.execPath, [script, "--config", good], { encoding: "utf8" });
  assert.equal(ok.status, 0, ok.stderr);
  assert.deepEqual(JSON.parse(ok.stdout), { source: good, review: { autoPost: true }, ignore: [] });
  const ko = spawnSync(process.execPath, [script, "--config", bad], { encoding: "utf8" });
  assert.equal(ko.status, 2);
  assert.match(ko.stderr, /orchestrator\.unknown key "nope"/);
});
