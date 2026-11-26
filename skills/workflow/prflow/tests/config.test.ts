import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { defaultPaths, loadConfig } from "../scripts/config.ts";
import { accountFor, DEFAULT_ACTIONS, DEFAULT_DISPATCH, DEFAULT_RAILS, DEFAULT_REVIEW, DEFAULT_STATUSES, DEFAULT_WORKTREE_STATUS, parseConfig, projectFor } from "../scripts/core/config.ts";

const prflowKeys = ["limit", "worktrees", "rails", "actions", "dispatch", "review", "worktreeStatus", "reviewBots"];
const parse = (v: unknown) => {
  const value = v as Record<string, unknown>;
  const prflow = Object.fromEntries(Object.entries(value).filter(([key]) => prflowKeys.includes(key)));
  const shared = Object.fromEntries(Object.entries(value).filter(([key]) => !prflowKeys.includes(key)));
  return parseConfig(JSON.stringify({ ...shared, prflow }), "cfg.json");
};

describe("parseConfig", () => {
  it("parses the committed example", () => {
    const cfg = parseConfig(readFileSync(join(import.meta.dirname, "../../../../config.example.json"), "utf8"), "example");
    assert.deepEqual(cfg.accounts.map((a) => a.login), ["work-login", "personal-login"]);
    assert.equal(cfg.limit, 50);
    assert.equal(cfg.worktrees, true);
    assert.deepEqual(cfg.reviewBots, ["coderabbitai"]);
  });

  it("reads prflow.reviewBots", () => {
    assert.deepEqual(parse({ accounts: [{ login: "a" }], reviewBots: ["CodeRabbitAI", "other[bot]"] }).reviewBots, ["CodeRabbitAI", "other[bot]"]);
    assert.throws(() => parse({ accounts: [{ login: "a" }], reviewBots: "coderabbitai" }), /prflow\.reviewBots must be an array of non-empty strings/);
    assert.throws(() => parse({ accounts: [{ login: "a" }], reviewBots: [""] }), /prflow\.reviewBots must be an array of non-empty strings/);
  });

  it("accepts a comment in the prflow section", () => {
    const cfg = parseConfig('{"accounts":[{"login":"a"}],"prflow":{"$comment":"options below"}}', "cfg.json");
    assert.equal(cfg.limit, 50);
  });

  it("ignores top-level sections it does not own", () => {
    const cfg = parseConfig('{"accounts":[{"login":"a"}],"taskStatus":{"statuses":{}},"futureTool":{"anything":1},"orchestrator":{"review":{"autoPost":true},"ignore":["x"]},"prflow":{"limit":5}}', "cfg.json");
    assert.equal(cfg.limit, 5);
    assert.throws(() => parseConfig('{"accounts":[{"login":"a"}],"futureTool":{},"prflow":{"token":"x"}}', "cfg.json"), /cfg\.json: prflow\.unknown key "token"/);
  });

  it("reads Orca status ids from the shared taskStatus section", () => {
    const cfg = parseConfig('{"accounts":[{"login":"a"}],"taskStatus":{"statuses":{"blocked":"status-6","paused":"status-6-2"}}}', "cfg.json");
    assert.deepEqual(cfg.taskStatuses, { ...DEFAULT_STATUSES, blocked: "status-6", paused: "status-6-2" });
    assert.throws(() => parseConfig('{"accounts":[{"login":"a"}],"taskStatus":{"statuses":{"stuck":"x"}}}', "cfg.json"), /cfg\.json: taskStatus\.statuses has unknown state "stuck"/);
  });

  it("ignores repoSync's section", () => {
    assert.equal(parseConfig('{"accounts":[{"login":"a"}],"repoSync":false}', "cfg.json").accounts[0]?.login, "a");
  });

  it("rejects a prflow section that is not an object", () => {
    for (const v of ["[]", "null"])
      assert.throws(() => parseConfig(`{"accounts":[{"login":"a"}],"prflow":${v}}`, "cfg.json"), /^Error: cfg\.json: prflow must be an object$/);
  });

  it("fills defaults", () => {
    assert.deepEqual(parse({ accounts: [{ login: "a" }] }), {
      accounts: [{ login: "a", owners: [], repos: [] }],
      limit: 50,
      worktrees: true,
      rails: DEFAULT_RAILS,
      actions: DEFAULT_ACTIONS,
      dispatch: DEFAULT_DISPATCH,
      review: DEFAULT_REVIEW,
      taskStatuses: DEFAULT_STATUSES,
      worktreeStatus: DEFAULT_WORKTREE_STATUS,
      reviewBots: [],
    });
  });

  it("defaults worktree status sync to dry run and merges orchestrator.ignore into its ignore list", () => {
    assert.deepEqual(DEFAULT_WORKTREE_STATUS, { dryRun: true, ignore: [] });
    const cfg = parse({ accounts: [{ login: "a" }], actions: { dryRun: false }, dispatch: { dryRun: false }, review: { dryRun: false } });
    assert.equal(cfg.worktreeStatus.dryRun, true);
    const shared = parseConfig(
      JSON.stringify({ accounts: [{ login: "a" }], orchestrator: { ignore: ["expedition", "Acme/Mine"] }, prflow: { worktreeStatus: { dryRun: false, ignore: ["acme/mine", "other"] } } }),
      "cfg.json",
    );
    assert.deepEqual(shared.worktreeStatus, { dryRun: false, ignore: ["acme/mine", "other", "expedition"] });
    assert.throws(() => parse({ accounts: [{ login: "a" }], worktreeStatus: { dryRun: "no" } }), /prflow\.worktreeStatus\.dryRun must be a boolean/);
    assert.throws(() => parse({ accounts: [{ login: "a" }], worktreeStatus: { ignore: [""] } }), /prflow\.worktreeStatus\.ignore must be an array/);
    assert.throws(() => parse({ accounts: [{ login: "a" }], worktreeStatus: { columns: {} } }), /prflow\.worktreeStatus: unknown key "columns"/);
    assert.throws(() => parseConfig('{"accounts":[{"login":"a"}],"orchestrator":{"ignore":"x"}}', "cfg.json"), /cfg\.json: orchestrator\.ignore must be an array/);
  });

  it("defaults review to dry run with 2 reviewers, separately from dispatch and actions", () => {
    assert.deepEqual(DEFAULT_REVIEW, { dryRun: true, maxConcurrent: 2, sessionReviews: 5, idleCloseHours: 24, statuses: { draft: "review-draft", reviewing: "reviewing", changes: "review-changes", approved: "review-approved" } });
    const cfg = parse({ accounts: [{ login: "a" }], actions: { dryRun: false }, dispatch: { dryRun: false } });
    assert.equal(cfg.review.dryRun, true);
    assert.deepEqual(parse({ accounts: [{ login: "a" }], review: { dryRun: false, maxConcurrent: 1 } }).review, { ...DEFAULT_REVIEW, dryRun: false, maxConcurrent: 1 });
  });

  it("defaults dispatch to dry run, separately from actions", () => {
    assert.equal(DEFAULT_DISPATCH.dryRun, true);
    const cfg = parse({ accounts: [{ login: "a" }], actions: { dryRun: false } });
    assert.equal(cfg.actions.dryRun, false);
    assert.equal(cfg.dispatch.dryRun, true);
    assert.equal(parse({ accounts: [{ login: "a" }], dispatch: { dryRun: false } }).dispatch.dryRun, false);
  });

  it("parses project context and matches repos case-insensitively", () => {
    const cfg = parse({ accounts: [{ login: "a" }], dispatch: { projectContext: [{ path: "/docs/sync", folder: "proj", repos: ["Acme/Widgets"] }] } });
    assert.deepEqual(projectFor(cfg.dispatch, "acme/widgets"), { path: "/docs/sync", folder: "proj", repos: ["Acme/Widgets"], owners: [] });
    const byOwner = parse({
      accounts: [{ login: "a" }],
      dispatch: { projectContext: [{ path: "/docs/org", owners: ["Acme"] }, { path: "/docs/sync", repos: ["acme/special"] }] },
    });
    assert.equal(projectFor(byOwner.dispatch, "ACME/anything")?.path, "/docs/org");
    // An exact repo entry wins over an owner entry.
    assert.equal(projectFor(byOwner.dispatch, "acme/special")?.path, "/docs/sync");
    assert.equal(projectFor(byOwner.dispatch, "other/x"), null);
    assert.equal(projectFor(cfg.dispatch, "acme/other"), null);
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
    ["dispatch not object", { accounts: [{ login: "a" }], dispatch: [] }, /dispatch must be an object/],
    ["unknown dispatch key", { accounts: [{ login: "a" }], dispatch: { live: true } }, /dispatch: unknown key "live"/],
    ["dispatch dryRun not boolean", { accounts: [{ login: "a" }], dispatch: { dryRun: 0 } }, /dispatch\.dryRun must be a boolean/],
    ["relative project path", { accounts: [{ login: "a" }], dispatch: { projectContext: [{ path: "docs", repos: [] }] } }, /projectContext\[0\]\.path must be an absolute path/],
    ["project folder escapes", { accounts: [{ login: "a" }], dispatch: { projectContext: [{ path: "/d", folder: "../x", repos: [] }] } }, /folder must be a relative folder name/],
    ["bad project repo", { accounts: [{ login: "a" }], dispatch: { projectContext: [{ path: "/d", repos: ["x"] }] } }, /must be owner\/repo/],
    ["bad project owner", { accounts: [{ login: "a" }], dispatch: { projectContext: [{ path: "/d", owners: ["a/b"] }] } }, /owners entry "a\/b" must be a GitHub user or org/],
    ["project with no repos or owners", { accounts: [{ login: "a" }], dispatch: { projectContext: [{ path: "/d" }] } }, /needs repos or owners/],
    ["review not object", { accounts: [{ login: "a" }], review: true }, /review must be an object/],
    ["unknown review key", { accounts: [{ login: "a" }], review: { post: true } }, /review: unknown key "post"/],
    ["review dryRun not boolean", { accounts: [{ login: "a" }], review: { dryRun: "no" } }, /review\.dryRun must be a boolean/],
    ["review maxConcurrent zero", { accounts: [{ login: "a" }], review: { maxConcurrent: 0 } }, /review\.maxConcurrent must be an integer from 1 to 20/],
    ["review sessionReviews zero", { accounts: [{ login: "a" }], review: { sessionReviews: 0 } }, /sessionReviews must be an integer/],
    ["review idleCloseHours zero", { accounts: [{ login: "a" }], review: { idleCloseHours: 0 } }, /idleCloseHours must be a number/],
    ["invalid review status id", { accounts: [{ login: "a" }], review: { statuses: { draft: "Invalid!" } } }, /review\.statuses\.draft/],
    ["bad limit", { accounts: [{ login: "a" }], limit: 0 }, /limit/],
    ["bad worktrees", { accounts: [{ login: "a" }], worktrees: "yes" }, /worktrees/],
  ];
  for (const [name, v, re] of bad)
    it(`rejects ${name}`, () => {
      assert.throws(() => v === undefined ? parseConfig("{", "cfg.json") : parse(v), (e: Error) => {
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
  it("looks in the repo root, then XDG config", () => {
    assert.deepEqual(defaultPaths({ XDG_CONFIG_HOME: "/x" }, "/h"), [join(import.meta.dirname, "../../../../config.json"), "/x/agentic-tools/config.json"]);
    assert.deepEqual(defaultPaths({}, "/h")[1], "/h/.config/agentic-tools/config.json");
  });
});
