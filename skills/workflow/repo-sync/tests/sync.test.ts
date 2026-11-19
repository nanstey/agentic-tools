import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { syncAll, syncRepo } from "../scripts/sync.ts";
import { config, err, fakeDeps, ok, ranArgs, repo, scriptRepo, SHA_A, SHA_B } from "./fixtures.ts";

const P = "/repos/app";
const live = { config: config({ reportChanges: ["reported"] }), dryRun: false };
const writes = (args: string[]) => args.filter((a) => a.startsWith("fetch") || a.startsWith("merge"));

describe("syncRepo skips", () => {
  it("dirty: tracked or untracked changes", async () => {
    for (const status of [" M src/a.ts\n", "?? new.txt\n", " M a\n?? b\n"]) {
      const { deps, calls } = fakeDeps(scriptRepo(P, { status }));
      const r = await syncRepo(deps, repo(), live);
      assert.equal(r.status, "skipped");
      assert.equal(r.reason, "dirty");
      assert.deepEqual(writes(ranArgs(calls)), [], "no fetch or merge");
    }
  });

  it("not-on-default: another branch or detached HEAD", async () => {
    const other = await syncRepo(fakeDeps(scriptRepo(P, { current: "feature/x" })).deps, repo(), live);
    assert.deepEqual([other.status, other.reason, other.detail], ["skipped", "not-on-default", "on feature/x, default main"]);
    const { deps, calls } = fakeDeps(scriptRepo(P, { current: "HEAD" }));
    const detached = await syncRepo(deps, repo(), live);
    assert.equal(detached.reason, "not-on-default");
    assert.match(detached.detail ?? "", /detached/);
    assert.deepEqual(writes(ranArgs(calls)), []);
  });

  it("ahead: local commits not on origin", async () => {
    const { deps, calls } = fakeDeps(scriptRepo(P, { counts: [1, 0] }));
    const r = await syncRepo(deps, repo(), live);
    assert.deepEqual([r.status, r.reason], ["skipped", "ahead"]);
    assert.ok(!ranArgs(calls).some((a) => a.startsWith("merge")), "no merge");
  });

  it("diverged: ahead and behind", async () => {
    const { deps, calls } = fakeDeps(scriptRepo(P, { counts: [2, 3] }));
    const r = await syncRepo(deps, repo(), live);
    assert.deepEqual([r.status, r.reason, r.detail], ["skipped", "diverged", "2 ahead, 3 behind origin/main"]);
    assert.ok(!ranArgs(calls).some((a) => a.startsWith("merge")));
  });

  it("no-remote: no identity, a non-origin remote, origin missing at fetch, or a missing origin branch", async () => {
    const none = await syncRepo(fakeDeps(scriptRepo(P)).deps, repo({ remoteName: null, remoteUrl: null }), live);
    assert.deepEqual([none.status, none.reason], ["skipped", "no-remote"]);
    const upstream = await syncRepo(fakeDeps(scriptRepo(P)).deps, repo({ remoteName: "upstream" }), live);
    assert.deepEqual([upstream.reason, upstream.detail], ["no-remote", "remote is upstream, not origin"]);
    const gone = await syncRepo(fakeDeps(scriptRepo(P, { fetch: err("fatal: 'origin' does not appear to be a git repository\nfatal: Could not read") })).deps, repo(), live);
    assert.deepEqual([gone.reason, gone.detail], ["no-remote", "'origin' does not appear to be a git repository"]);
    const missing = await syncRepo(fakeDeps(scriptRepo(P, { count: err("fatal: bad revision 'origin/main'\n") })).deps, repo(), live);
    assert.deepEqual([missing.reason, missing.detail], ["no-remote", "bad revision 'origin/main'"]);
  });

  it("fetch-failed: network errors and timeouts, without merging", async () => {
    for (const [stderr, detail] of [
      ["ssh: Could not resolve hostname github.com-work: Temporary failure in name resolution\nfatal: Could not read from remote repository.", "ssh: Could not resolve hostname github.com-work: Temporary failure in name resolution"],
      ["git fetch origin timed out after 60s", "git fetch origin timed out after 60s"],
    ] as const) {
      const { deps, calls } = fakeDeps(scriptRepo(P, { fetch: err(stderr) }));
      const r = await syncRepo(deps, repo(), live);
      assert.deepEqual([r.status, r.reason, r.detail], ["skipped", "fetch-failed", detail]);
      assert.ok(!ranArgs(calls).some((a) => a.startsWith("merge")));
    }
  });

  it("no-default-branch: no origin/HEAD and no Orca base ref", async () => {
    const r = await syncRepo(fakeDeps(scriptRepo(P, { originHead: err("fatal: ambiguous argument 'origin/HEAD'") })).deps, repo(), live);
    assert.deepEqual([r.status, r.reason], ["skipped", "no-default-branch"]);
  });

  it("falls back to the Orca base ref when origin/HEAD is unset", async () => {
    const { deps, calls } = fakeDeps(scriptRepo(P, { originHead: err("fatal: ambiguous argument") }, "trunk"));
    const r = await syncRepo(deps, repo({ baseRef: "origin/trunk" }), live);
    assert.equal(r.status, "updated");
    assert.equal(r.defaultBranch, "trunk");
    assert.ok(ranArgs(calls).includes("merge --ff-only origin/trunk"));
  });
});

describe("syncRepo re-checks before merging", () => {
  it("skips when the checkout changes during the fetch", async () => {
    for (const [key, later, reason] of [
      ["status --porcelain", ok("?? new.txt\n"), "dirty"],
      ["rev-parse --abbrev-ref HEAD", ok("feature\n"), "not-on-default"],
    ] as const) {
      let n = 0;
      const script = { ...scriptRepo(P), [`${P}|${key}`]: () => (n++ === 0 ? ok(key.startsWith("status") ? "" : "main\n") : later) };
      const { deps, calls } = fakeDeps(script);
      const r = await syncRepo(deps, repo(), live);
      assert.deepEqual([r.status, r.reason], ["skipped", reason]);
      assert.match(r.detail ?? "", /during sync/);
      assert.ok(!ranArgs(calls).some((a) => a.startsWith("merge")), "no merge");
    }
  });
});

describe("syncRepo failures", () => {
  it("merge-failed: the fast-forward is refused", async () => {
    const r = await syncRepo(fakeDeps(scriptRepo(P, { merge: err("fatal: Not possible to fast-forward, aborting.") })).deps, repo(), live);
    assert.deepEqual([r.status, r.reason, r.detail], ["failed", "merge-failed", "Not possible to fast-forward, aborting."]);
  });

  it("error: the checkout cannot be read", async () => {
    const r = await syncRepo(fakeDeps({ [`${P}|rev-parse --abbrev-ref HEAD`]: err("fatal: not a git repository (or any of the parent directories): .git") }).deps, repo(), live);
    assert.deepEqual([r.status, r.reason], ["failed", "error"]);
    assert.match(r.detail ?? "", /not a git repository/);
  });
});

describe("syncRepo success", () => {
  it("up-to-date: fetches but does not merge", async () => {
    const { deps, calls } = fakeDeps(scriptRepo(P, { counts: [0, 0] }));
    const r = await syncRepo(deps, repo(), live);
    assert.equal(r.status, "up-to-date");
    assert.deepEqual(writes(ranArgs(calls)), ["fetch origin main"]);
  });

  it("updated: fetch, then ff-only merge, in that order, and nothing else", async () => {
    const { deps, calls } = fakeDeps(scriptRepo(P));
    const r = await syncRepo(deps, repo(), live);
    assert.deepEqual([r.status, r.commits, r.from, r.to], ["updated", 2, SHA_A, SHA_B]);
    assert.deepEqual(ranArgs(calls), [
      "rev-parse --abbrev-ref HEAD",
      "rev-parse --abbrev-ref origin/HEAD",
      "status --porcelain",
      "fetch origin main",
      "rev-list --left-right --count HEAD...origin/main",
      "rev-parse --abbrev-ref HEAD",
      "status --porcelain",
      "rev-parse HEAD",
      "merge --ff-only origin/main",
      "rev-parse HEAD",
    ]);
    assert.equal(r.log, undefined, "no log for repos outside reportChanges");
  });

  it("collects log (max 10) and paths (max 15) for reportChanges repos", async () => {
    const log = Array.from({ length: 12 }, (_, i) => `c${i} commit ${i}`).join("\n");
    const diff = Array.from({ length: 20 }, (_, i) => `f${i}`).join("\n");
    const { deps } = fakeDeps(scriptRepo(P, { counts: [0, 12], log, diff }));
    const r = await syncRepo(deps, repo({ name: "reported" }), live);
    assert.equal(r.log?.length, 10);
    assert.equal(r.paths?.length, 15);
    assert.equal(r.totalPaths, 20);
  });

  it("dry run makes no fetch and no merge", async () => {
    const { deps, calls } = fakeDeps(scriptRepo(P, { counts: [0, 5] }));
    const r = await syncRepo(deps, repo(), { config: config(), dryRun: true });
    assert.deepEqual([r.status, r.commits], ["would-update", 5]);
    assert.deepEqual(writes(ranArgs(calls)), []);
  });
});

describe("auth", () => {
  const cfg = config({ accounts: [{ login: "work-login", owners: ["WorkOrg"], repos: [] }, { login: "me-login", owners: [], repos: [] }] });

  it("https remotes fetch with GH_TOKEN of the mapped account", async () => {
    const { deps, calls, tokenCalls } = fakeDeps(scriptRepo(P), { tokens: { "work-login": "tok-w" } });
    const r = await syncRepo(deps, repo({ slug: "WorkOrg/app", remoteUrl: "https://github.com/WorkOrg/app.git" }), { config: cfg, dryRun: false });
    assert.equal(r.auth, "https as work-login");
    assert.deepEqual(tokenCalls, ["work-login"]);
    const fetch = calls.find((c) => c.args[0] === "fetch");
    assert.deepEqual(fetch?.env, { GH_TOKEN: "tok-w" });
    assert.equal(calls.filter((c) => c.env).length, 1, "only the fetch gets the token");
  });

  it("ssh remotes, including host aliases, never get a token", async () => {
    const { deps, calls, tokenCalls } = fakeDeps(scriptRepo(P), { tokens: { "work-login": "tok-w" } });
    const r = await syncRepo(deps, repo({ slug: "WorkOrg/app", remoteUrl: "git@github.com-work:WorkOrg/app.git" }), { config: cfg, dryRun: false });
    assert.equal(r.auth, "ssh");
    assert.deepEqual(tokenCalls, []);
    assert.ok(calls.every((c) => !c.env));
  });

  it("https with no token falls back to ambient auth", async () => {
    const { deps, calls } = fakeDeps(scriptRepo(P));
    const r = await syncRepo(deps, repo({ remoteUrl: "https://github.com/me/app.git" }), { config: cfg, dryRun: false });
    assert.equal(r.status, "updated");
    assert.match(r.auth, /ambient/);
    assert.ok(calls.every((c) => !c.env));
  });
});

describe("syncAll", () => {
  it("one repo's failure does not stop the others, and order is kept", async () => {
    const script = {
      ...scriptRepo("/r/a"),
      "/r/b|rev-parse --abbrev-ref HEAD": err("fatal: cannot change to '/r/b': No such file or directory"),
      ...scriptRepo("/r/c", { fetch: err("ssh: connect to host github.com port 22: Network is unreachable") }),
      ...scriptRepo("/r/d", { counts: [0, 0] }),
    };
    const { deps } = fakeDeps(script);
    const repos = ["a", "b", "c", "d"].map((n) => repo({ path: `/r/${n}`, name: n }));
    const out = await syncAll(deps, repos, { ...live, concurrency: 2 });
    assert.deepEqual(out.map((r) => [r.name, r.status]), [["a", "updated"], ["b", "failed"], ["c", "skipped"], ["d", "up-to-date"]]);
  });

  it("a thrown error becomes a failed result", async () => {
    const { deps } = fakeDeps({});
    const out = await syncAll(deps, [repo()], live);
    assert.deepEqual([out[0]?.status, out[0]?.reason], ["failed", "error"]);
    assert.match(out[0]?.detail ?? "", /unexpected git call/);
  });

  it("token lookup happens once per login per run", async () => {
    const cfg = config({ accounts: [{ login: "me-login", owners: [], repos: [] }] });
    const { deps, tokenCalls } = fakeDeps({ ...scriptRepo("/r/a"), ...scriptRepo("/r/b") }, { tokens: { "me-login": "t" } });
    const https = (n: string) => repo({ path: `/r/${n}`, name: n, remoteUrl: `https://github.com/me/${n}.git` });
    await syncAll(deps, [https("a"), https("b")], { config: cfg, dryRun: false, concurrency: 1 });
    assert.deepEqual(tokenCalls, ["me-login"]);
  });
});

