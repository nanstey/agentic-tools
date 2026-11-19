import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { defaultPaths, loadConfig, SKILL_DIR } from "../scripts/config.ts";
import { accountFor, DEFAULT_ACTIONS, DEFAULT_RAILS, parseConfig } from "../scripts/core/config.ts";

const parse = (v: unknown) => parseConfig(JSON.stringify(v), "cfg.json");

describe("parseConfig", () => {
  it("parses the committed example", () => {
    const cfg = parseConfig(readFileSync(join(SKILL_DIR, "config.example.json"), "utf8"), "example");
    assert.deepEqual(cfg.accounts.map((a) => a.login), ["work-login", "personal-login"]);
    assert.equal(cfg.limit, 50);
    assert.equal(cfg.worktrees, true);
  });

  it("fills defaults", () => {
    assert.deepEqual(parse({ accounts: [{ login: "a" }] }), {
      accounts: [{ login: "a", owners: [], repos: [] }],
      limit: 50,
      worktrees: true,
      rails: DEFAULT_RAILS,
      actions: DEFAULT_ACTIONS,
    });
  });

  it("defaults to dry run and accepts an explicit switch", () => {
    assert.equal(DEFAULT_ACTIONS.dryRun, true);
    assert.equal(parse({ accounts: [{ login: "a" }], actions: { dryRun: false } }).actions.dryRun, false);
  });

  it("overrides single rails and keeps the other defaults", () => {
    const cfg = parse({ accounts: [{ login: "a" }], rails: { perHour: 2, leaseMinutes: 10 } });
    assert.deepEqual(cfg.rails, { ...DEFAULT_RAILS, perHour: 2, leaseMinutes: 10 });
  });

  const bad: [string, unknown, RegExp][] = [
    ["invalid JSON", undefined, /invalid JSON/],
    ["no accounts", { accounts: [] }, /non-empty array/],
    ["unknown top key", { accounts: [{ login: "a" }], token: "x" }, /unknown key "token"/],
    ["unknown account key", { accounts: [{ login: "a", token: "x" }] }, /accounts\[0\]: unknown key "token"/],
    ["missing login", { accounts: [{ owners: ["o"] }] }, /accounts\[0\]\.login/],
    ["owners not strings", { accounts: [{ login: "a", owners: [1] }] }, /accounts\[0\]\.owners/],
    ["bad login", { accounts: [{ login: " a" }] }, /accounts\[0\]\.login must be a GitHub login/],
    ["bad owner", { accounts: [{ login: "a", owners: ["acme "] }] }, /owners entry "acme " must be a GitHub owner/],
    ["empty repo part", { accounts: [{ login: "a", repos: ["acme/"] }] }, /must be owner\/repo/],
    ["bad repo", { accounts: [{ login: "a", repos: ["nope"] }] }, /must be owner\/repo/],
    ["duplicate login", { accounts: [{ login: "a", owners: ["o"] }, { login: "A", owners: ["p"] }] }, /listed twice/],
    ["two unscoped", { accounts: [{ login: "a" }, { login: "b" }] }, /at most one/],
    ["shared owner", { accounts: [{ login: "a", owners: ["O"] }, { login: "b", owners: ["o"] }] }, /owner o is assigned to both a and b/],
    ["rails not object", { accounts: [{ login: "a" }], rails: [] }, /rails must be an object/],
    ["unknown rail", { accounts: [{ login: "a" }], rails: { turbo: 1 } }, /rails: unknown key "turbo"/],
    ["zero rail", { accounts: [{ login: "a" }], rails: { perDay: 0 } }, /rails\.perDay must be an integer/],
    ["fractional rail", { accounts: [{ login: "a" }], rails: { perDay: 1.5 } }, /rails\.perDay/],
    ["actions not object", { accounts: [{ login: "a" }], actions: true }, /actions must be an object/],
    ["unknown action key", { accounts: [{ login: "a" }], actions: { merge: true } }, /actions: unknown key "merge"/],
    ["dryRun not boolean", { accounts: [{ login: "a" }], actions: { dryRun: "no" } }, /actions\.dryRun must be a boolean/],
    ["bad limit", { accounts: [{ login: "a" }], limit: 0 }, /limit/],
    ["bad worktrees", { accounts: [{ login: "a" }], worktrees: "yes" }, /worktrees/],
  ];
  for (const [name, v, re] of bad)
    it(`rejects ${name}`, () => {
      assert.throws(() => parseConfig(v === undefined ? "{" : JSON.stringify(v), "cfg.json"), (e: Error) => {
        assert.match(e.message, /^cfg\.json: /);
        assert.match(e.message, re);
        return true;
      });
    });
});

describe("accountFor", () => {
  const cfg = parse({
    accounts: [
      { login: "work", owners: ["Acme"], repos: ["Partner/shared"] },
      { login: "oss", repos: ["Acme/public"] },
      { login: "me" },
    ],
  });
  it("prefers an exact repo, then an owner, then the unscoped account", () => {
    assert.equal(accountFor(cfg, "acme/public")?.login, "oss");
    assert.equal(accountFor(cfg, "ACME/x")?.login, "work");
    assert.equal(accountFor(cfg, "partner/shared")?.login, "work");
    assert.equal(accountFor(cfg, "partner/other")?.login, "me");
  });
  it("returns null when no account covers the repo", () => {
    assert.equal(accountFor(parse({ accounts: [{ login: "w", owners: ["Acme"] }] }), "x/y"), null);
  });
});

describe("loadConfig", () => {
  const file = JSON.stringify({ accounts: [{ login: "fromfile" }] });
  const files = (m: Record<string, string>) => (p: string) => m[p] ?? null;
  const whoami = async () => "active";

  it("uses --user with flag scope and ignores files", async () => {
    const l = await loadConfig({ user: "u", owners: ["O"], repos: ["X/y"] }, whoami, files({ "/a": file }), ["/a"]);
    assert.equal(l.source, "--user");
    assert.deepEqual(l.config.accounts, [{ login: "u", owners: ["O"], repos: ["X/y"] }]);
  });
  it("requires an explicit config file to exist", async () => {
    await assert.rejects(loadConfig({ config: "/missing" }, whoami, files({}), []), /config file not found: \/missing/);
    const l = await loadConfig({ config: "/c" }, whoami, files({ "/c": file }), []);
    assert.equal(l.config.accounts[0]?.login, "fromfile");
  });
  it("takes the first default path that exists", async () => {
    const l = await loadConfig({}, whoami, files({ "/b": file }), ["/a", "/b"]);
    assert.equal(l.source, "/b");
  });
  it("falls back to the active gh account", async () => {
    const l = await loadConfig({ owners: ["O"] }, whoami, files({ "/a": file }), ["/a"]);
    assert.equal(l.source, "active gh account");
    assert.deepEqual(l.config.accounts, [{ login: "active", owners: ["O"], repos: [] }]);
  });
  it("looks in the skill dir, then XDG config", () => {
    assert.deepEqual(defaultPaths({ XDG_CONFIG_HOME: "/x" }, "/h"), [join(SKILL_DIR, "config.json"), "/x/prflow/config.json"]);
    assert.deepEqual(defaultPaths({}, "/h")[1], "/h/.config/prflow/config.json");
  });
});
