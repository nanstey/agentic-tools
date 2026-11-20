import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { loadConfig } from "../scripts/config.ts";
import { accountFor, parseConfig, reportsChanges } from "../scripts/config.ts";
import { changeBlock, nextState, renderDryRun, renderRun, renderStatus, runEvents } from "../scripts/report.ts";
import { baseBranch, parseRemote, parseRepoList, transport } from "../scripts/repos.ts";
import type { LastRun, RepoResult } from "../scripts/types.ts";
import { config, ORCA_LIST, SHA_A, SHA_B } from "./fixtures.ts";

describe("config", () => {
  it("parses shared accounts and repoSync.reportChanges", () => {
    const c = parseConfig(JSON.stringify({ $comment: "x", accounts: [{ login: "work", owners: ["WorkOrg"] }], repoSync: { reportChanges: ["repo"] } }), "c.json");
    assert.deepEqual(c.reportChanges, ["repo"]);
    assert.deepEqual(c.accounts, [{ login: "work", owners: ["WorkOrg"], repos: [] }]);
    assert.deepEqual(parseConfig('{"accounts": []}', "c").accounts, []);
    assert.deepEqual(parseConfig('{"prflow": false}', "c").reportChanges, []);
  });

  it("rejects bad shared and repoSync input with the source in the message", () => {
    for (const [text, msg] of [
      ["{", /c.json: invalid JSON/],
      ["[]", /must be a JSON object/],
      ['{"other": 1}', /unknown key "other"/],
      ['{"repoSync": []}', /: repoSync must be an object/],
      ['{"repoSync": null}', /: repoSync must be an object/],
      ['{"accounts": "x"}', /accounts must be an array/],
      ['{"repoSync": {"reportChanges": "x"}}', /repoSync.reportChanges must be an array of strings/],
      ['{"accounts": [{"login": "a", "token": "x"}]}', /unknown key "token"/],
      ['{"accounts": [{"login": "a", "repos": ["nope"]}]}', /must be owner\/repo/],
      ['{"accounts": [{"login": "a"}, {"login": "b"}]}', /at most one account/],
    ] as const) assert.throws(() => parseConfig(text, "c.json"), msg, text);
  });

  it("maps a repo to an account: repos entry, then owner, then unscoped", () => {
    const c = config({ accounts: [{ login: "work", owners: ["WorkOrg"], repos: [] }, { login: "side", owners: [], repos: ["WorkOrg/shared"] }, { login: "me", owners: [], repos: [] }] });
    assert.equal(accountFor(c, "workorg/app")?.login, "work");
    assert.equal(accountFor(c, "WorkOrg/shared")?.login, "side");
    assert.equal(accountFor(c, "someone/else")?.login, "me");
    assert.equal(accountFor(c, null)?.login, "me");
    assert.equal(accountFor(config(), "a/b"), null);
  });

  it("matches reportChanges by display name, folder name, or owner/repo", () => {
    const c = config({ reportChanges: ["Reported", "org/docs"] });
    assert.ok(reportsChanges(c, { name: "reported", path: "/x/y", slug: null }));
    assert.ok(reportsChanges(c, { name: "renamed", path: "/x/reported", slug: null }));
    assert.ok(reportsChanges(c, { name: "d", path: "/x/d", slug: "Org/Docs" }));
    assert.ok(!reportsChanges(c, { name: "other", path: "/x/other", slug: "org/other" }));
  });

  it("accepts the shipped config.example.json", () => {
    const text = readFileSync(join(import.meta.dirname, "../../../../config.example.json"), "utf8");
    assert.deepEqual(parseConfig(text, "config.example.json").reportChanges, ["my-repo"]);
  });

  it("loads an explicit file, then the first default path, then defaults", () => {
    const files: Record<string, string> = { "/a.json": '{"repoSync":{"reportChanges":["a"]}}', "/d2.json": '{"repoSync":{"reportChanges":["d2"]}}' };
    const read = (p: string) => files[p] ?? null;
    const load = (explicit: string | undefined, paths: string[]) => loadConfig({ explicit, paths }, read);
    assert.deepEqual(load("/a.json", ["/d2.json"]).config.reportChanges, ["a"]);
    assert.throws(() => load("/missing.json", []), /not found/);
    assert.equal(load(undefined, ["/d1.json", "/d2.json"]).source, "/d2.json");
    assert.equal(load(undefined, ["/d1.json"]).source, "defaults");
  });

  it("loads accounts and repoSync settings from one shared file", () => {
    const file = JSON.stringify({ accounts: [{ login: "shared" }], prflow: { rails: {} }, repoSync: { reportChanges: ["reported"] } });
    const result = loadConfig({ paths: ["/shared.json"] }, (path) => path === "/shared.json" ? file : null);
    assert.deepEqual(result.config.accounts.map((account) => account.login), ["shared"]);
    assert.deepEqual(result.config.reportChanges, ["reported"]);
    assert.equal(result.source, "/shared.json");
  });
});

describe("remotes and the Orca repo list", () => {
  it("parses scp-like, ssh, and https remotes, including SSH host aliases", () => {
    assert.deepEqual(parseRemote("git@github.com-work:WorkOrg/app.git"), { host: "github.com-work", owner: "WorkOrg", repo: "app" });
    assert.deepEqual(parseRemote("ssh://git@github.com:22/me/app.git"), { host: "github.com", owner: "me", repo: "app" });
    assert.deepEqual(parseRemote("https://github.com/me/app"), { host: "github.com", owner: "me", repo: "app" });
    assert.equal(parseRemote("/srv/git/app.git"), null);
    assert.equal(parseRemote(null), null);
    assert.equal(transport("git@github.com-work:a/b.git"), "ssh");
    assert.equal(transport("ssh://git@h/a/b"), "ssh");
    assert.equal(transport("https://github.com/a/b"), "https");
    assert.equal(transport("/srv/git/app.git"), "other");
  });

  it("keeps local git repos and drops folder, hidden, and other-host entries", () => {
    const repos = parseRepoList(JSON.stringify(ORCA_LIST));
    assert.deepEqual(repos.map((r) => r.name), ["work", "web", "local-only"]);
    assert.deepEqual(repos[0], { id: "r1", path: "/repos/work", name: "work", slug: "WorkOrg/work", remoteName: "origin", remoteUrl: "git@github.com-work:WorkOrg/work.git", baseRef: null });
    assert.equal(repos[1]?.baseRef, "origin/trunk");
    assert.equal(repos[2]?.remoteName, null);
    assert.throws(() => parseRepoList("nope"), /invalid JSON/);
    assert.throws(() => parseRepoList('{"ok": false}'), /missing result.repos/);
  });

  it("accepts only supported origin or local base-ref forms", () => {
    for (const [ref, branch] of [["origin/main", "main"], ["refs/remotes/origin/develop", "develop"], ["refs/heads/release", "release"], ["origin/feature/topic", "feature/topic"], ["refs/heads/feature/topic", "feature/topic"], ["main", "main"]] as const)
      assert.equal(baseBranch(ref), branch);
    for (const ref of ["upstream/main", "refs/remotes/upstream/main"])
      assert.equal(baseBranch(ref), null);
    assert.equal(baseBranch(null), null);
  });
});

const res = (over: Partial<RepoResult>): RepoResult => ({ path: "/r/app", name: "app", slug: "me/app", status: "up-to-date", auth: "ssh", ...over });
const dirty = res({ status: "skipped", reason: "dirty", detail: "2 changed paths" });
const fetchFail = res({ status: "skipped", reason: "fetch-failed", detail: "Could not resolve hostname" });
const at = (n: number) => `2026-01-0${n}T00:00:00.000Z`;

/** Run `results` through `nextState` repeatedly, returning each run's output. */
function runs(...seq: RepoResult[][]): string[] {
  let prev: LastRun | null = null;
  return seq.map((results, i) => {
    const { state, notices } = nextState(prev, results, at(i + 1));
    prev = state;
    return renderRun(notices, results);
  });
}

describe("streaks and scheduler output", () => {
  it("prints a skip once it persists for 2 runs, then stays quiet", () => {
    assert.deepEqual(runs([dirty], [dirty], [dirty], [dirty]), ["", "app: skipped (dirty) for 2 runs: 2 changed paths\n", "", ""]);
  });

  it("prints again after the reason changes and the new reason persists", () => {
    const behindBranch = res({ status: "skipped", reason: "not-on-default", detail: "on feat, default main" });
    assert.deepEqual(runs([dirty], [dirty], [behindBranch], [behindBranch], [behindBranch]), [
      "",
      "app: skipped (dirty) for 2 runs: 2 changed paths\n",
      "",
      "app: skipped (not-on-default) for 2 runs: on feat, default main (if origin's default branch changed: git remote set-head origin --auto)\n",
      "",
    ]);
  });

  it("a healthy run resets the streak", () => {
    assert.deepEqual(runs([dirty], [res({})], [dirty], [dirty]), ["", "", "", "app: skipped (dirty) for 2 runs: 2 changed paths\n"]);
  });

  it("prints fetch and merge failures on their first run, once", () => {
    const merge = res({ status: "failed", reason: "merge-failed", detail: "Not possible to fast-forward" });
    assert.deepEqual(runs([fetchFail], [fetchFail], [merge], [merge]), [
      "app: fetch failed: Could not resolve hostname\n",
      "",
      "app: merge failed: Not possible to fast-forward\n",
      "",
    ]);
  });

  it("drops repos that are no longer tracked", () => {
    const first = nextState(null, [dirty], at(1)).state;
    assert.deepEqual(Object.keys(nextState(first, [], at(2)).state.repos), []);
  });

  it("orders failures, stuck skips, then change reports; quiet successes print nothing", () => {
    const prev = nextState(null, [res({ path: "/r/s", name: "stuck", status: "skipped", reason: "ahead", detail: "1 ahead of origin/main" })], at(1)).state;
    const results = [
      res({ path: "/r/q", name: "quiet", status: "updated", commits: 3, from: SHA_A, to: SHA_B }),
      res({ path: "/r/s", name: "stuck", status: "skipped", reason: "ahead", detail: "1 ahead of origin/main" }),
      res({ path: "/r/t", name: "reported", status: "updated", branch: "main", commits: 1, from: SHA_A, to: SHA_B, log: ["bbbbbbb add notes"], paths: ["notes.md"], totalPaths: 1 }),
      res({ path: "/r/f", name: "flaky", status: "skipped", reason: "fetch-failed", detail: "timed out after 60s" }),
      res({ path: "/r/u", name: "fine" }),
    ];
    const { notices } = nextState(prev, results, at(2));
    assert.equal(
      renderRun(notices, results),
      "flaky: fetch failed: timed out after 60s\n\nstuck: skipped (ahead) for 2 runs: 1 ahead of origin/main\n\nreported: pulled 1 commit on main (aaaaaaa..bbbbbbb)\n  bbbbbbb add notes\n  changed paths (1):\n    notes.md\n",
    );
    assert.equal(renderRun([], [res({ status: "updated", commits: 2 })]), "");
  });

  it("truncates change reports to 10 commits and 15 paths", () => {
    const text = changeBlock(res({ status: "updated", branch: "main", commits: 12, from: SHA_A, to: SHA_B, log: Array.from({ length: 10 }, (_, i) => `c${i}`), paths: Array.from({ length: 15 }, (_, i) => `p${i}`), totalPaths: 40 }));
    assert.match(text, /^app: pulled 12 commits on main \(aaaaaaa\.\.bbbbbbb\)/);
    assert.match(text, /  c9\n  \.\.\. and 2 more\n/);
    assert.match(text, /changed paths \(40\):\n/);
    assert.match(text, /    p14\n    \.\.\. and 25 more$/);
  });

  it("logs every pull, the first run of each skip streak, and a run summary", () => {
    const first = nextState(null, [dirty], at(1)).state;
    assert.deepEqual(runEvents(first, [dirty], at(1)).map((e) => e.kind), ["skipped", "run"]);
    const results = [dirty, res({ path: "/r/b", status: "updated", commits: 1, from: SHA_A, to: SHA_B })];
    const second = nextState(first, results, at(2)).state;
    const events = runEvents(second, results, at(2));
    assert.deepEqual(events.map((e) => e.kind), ["updated", "run"]);
    assert.deepEqual(events.at(-1)?.counts, { updated: 1, upToDate: 0, skipped: 1, failed: 0 });
  });
});

describe("human output", () => {
  it("dry run lists every repo with its auth", () => {
    const text = renderDryRun([res({ status: "would-update", commits: 4 }), res({ ...dirty, name: "long-name", path: "/r/l" })], true);
    assert.match(text, /^repo-sync dry run: no fetch, no merge, no state written\nnote: repo-sync is paused/);
    assert.match(text, /app        would-update  4 behind as of last fetch  \[ssh\]/);
    assert.match(text, /long-name  skipped \(dirty\)  2 changed paths  \[ssh\]/);
  });

  it("status shows the last run, streaks, and pause", () => {
    assert.equal(renderStatus(null, null), "no runs yet\n");
    const { state } = nextState(nextState(null, [dirty], at(1)).state, [dirty], at(2));
    const text = renderStatus(state, "holiday");
    assert.match(text, /^paused: holiday\nlast run: 2026-01-02/);
    assert.match(text, /app  skipped \(dirty\)  2 changed paths  \(2 runs\)/);
  });
});
