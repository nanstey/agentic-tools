import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import { main } from "../scripts/cli.ts";
import { realDeps, type Deps } from "../scripts/deps.ts";
import { gitArgs } from "../scripts/git.ts";

const root = mkdtempSync(join(tmpdir(), "repo-sync-it-"));
after(() => rmSync(root, { recursive: true, force: true }));

/** Setup git directly for the integration fixture. */
const git = (cwd: string, ...args: string[]) =>
  execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", "-c", "commit.gpgsign=false", "-c", "init.defaultBranch=main", ...args], { cwd, encoding: "utf8" }).trim();

const remote = join(root, "remote.git");
const seed = join(root, "seed");
const path = (name: string) => join(root, name);

function commit(dir: string, file: string, text: string, msg: string) {
  writeFileSync(join(dir, file), text);
  git(dir, "add", file);
  git(dir, "commit", "-qm", msg);
}

function clone(name: string) {
  git(root, "clone", "-q", remote, name);
  return path(name);
}

/** Everything repo-sync could change in a checkout. */
function snapshot(dir: string) {
  return {
    head: git(dir, "rev-parse", "HEAD"),
    branch: git(dir, "rev-parse", "--abbrev-ref", "HEAD"),
    heads: git(dir, "for-each-ref", "refs/heads", "--format=%(refname) %(objectname)"),
    status: git(dir, "status", "--porcelain"),
    a: readFileSync(join(dir, "a.txt"), "utf8"),
    stash: git(dir, "stash", "list"),
  };
}

const NAMES = ["clean", "reported", "dirty", "untracked", "diverged", "other-branch", "ahead"] as const;
const before_: Record<string, ReturnType<typeof snapshot>> = {};
let newHead = "";

before(() => {
  git(root, "init", "-q", "--bare", remote);
  git(root, "clone", "-q", remote, "seed");
  commit(seed, "a.txt", "one\n", "one");
  git(seed, "push", "-q", "origin", "HEAD:main");
  git(remote, "symbolic-ref", "HEAD", "refs/heads/main");

  for (const n of ["clean", "reported", "dirty", "untracked", "diverged", "other-branch"]) clone(n);
  writeFileSync(join(path("dirty"), "a.txt"), "local edit\n");
  writeFileSync(join(path("untracked"), "new.txt"), "untracked\n");
  commit(path("diverged"), "local.txt", "mine\n", "local work");
  git(path("other-branch"), "checkout", "-q", "-b", "feature");

  // Origin moves on: everything cloned above is now behind.
  commit(seed, "a.txt", "two\n", "two");
  commit(seed, "b.txt", "bee\n", "add b");
  git(seed, "push", "-q", "origin", "HEAD:main");
  newHead = git(seed, "rev-parse", "HEAD");

  // Ahead only: cloned at the new head, then a local commit.
  clone("ahead");
  commit(path("ahead"), "local.txt", "mine\n", "local work");

  for (const n of NAMES) before_[n] = snapshot(path(n));
});

describe("real git: run against temporary clones", () => {
  it("fast-forwards clean checkouts and leaves every other checkout untouched", async () => {
    const list = JSON.stringify({ ok: true, result: { repos: NAMES.map((n) => ({ id: n, path: path(n), displayName: n, kind: "git", executionHostId: "local", gitRemoteIdentity: { remoteName: "origin", remoteUrl: remote } })) } });
    const deps: Deps = { ...realDeps(), orcaRepos: async () => ({ ok: true, stdout: list, stderr: "" }) };
    const env = { AGENTIC_TOOLS_CONFIG: join(root, "config.json"), XDG_STATE_HOME: join(root, "state"), XDG_CONFIG_HOME: join(root, "config") };
    writeFileSync(env.AGENTIC_TOOLS_CONFIG, JSON.stringify({ accounts: [], repoSync: { reportChanges: ["reported"] } }));
    let out = "";
    const io = { deps, env, now: () => Date.now(), out: (s: string) => (out += s), err: (s: string) => assert.fail(s) };

    // A dry run first changes nothing at all.
    assert.equal(await main(["run", "--dry-run"], io), 0);
    for (const n of NAMES) assert.deepEqual(snapshot(path(n)), before_[n], `${n} unchanged by dry run`);
    assert.match(out, /clean\s+up-to-date as of last fetch  \[local\]/, "dry run does not fetch");
    out = "";

    assert.equal(await main(["run"], io), 0);

    for (const n of ["clean", "reported"]) {
      const s = snapshot(path(n));
      assert.equal(s.head, newHead, `${n} fast-forwarded`);
      assert.equal(s.branch, "main");
      assert.equal(s.status, "");
      assert.equal(s.a, "two\n");
    }
    for (const n of ["dirty", "untracked", "diverged", "other-branch", "ahead"]) assert.deepEqual(snapshot(path(n)), before_[n], `${n} untouched`);

    const short = (sha: string) => sha.slice(0, 7);
    assert.match(out, new RegExp(`^reported: pulled 2 commits on main \\(${short(before_.clean!.head)}\\.\\.${short(newHead)}\\)\\n  [0-9a-f]+ add b\\n  [0-9a-f]+ two\\n  changed paths \\(2\\):\\n    a.txt\\n    b.txt\\n$`));

    const last = JSON.parse(readFileSync(join(root, "state", "repo-sync", "last-run.json"), "utf8")).repos;
    const reason = (n: string) => last[path(n)].reason ?? last[path(n)].status;
    assert.deepEqual(NAMES.map(reason), ["updated", "updated", "dirty", "dirty", "diverged", "not-on-default", "ahead"]);

    // Second run: stuck checkouts are reported once, healthy ones stay quiet.
    out = "";
    await main(["run"], io);
    assert.equal(
      out,
      [
        "dirty: skipped (dirty) for 2 runs: 1 changed path",
        "untracked: skipped (dirty) for 2 runs: 1 changed path",
        "diverged: skipped (diverged) for 2 runs: 1 ahead, 2 behind origin/main",
        "other-branch: skipped (not-on-default) for 2 runs: on feature, default main (if origin's default branch changed: git remote set-head origin --auto)",
        "ahead: skipped (ahead) for 2 runs: 1 ahead of origin/main",
      ].join("\n") + "\n",
    );
    out = "";
    await main(["run"], io);
    assert.equal(out, "", "third run is quiet");
  });

  it("reports an unreachable remote as a fetch failure without touching the checkout", async () => {
    const dir = clone("unreachable");
    git(dir, "remote", "set-url", "origin", join(root, "gone.git"));
    const s = snapshot(dir);
    const list = JSON.stringify({ ok: true, result: { repos: [{ id: "u", path: dir, displayName: "unreachable", kind: "git", gitRemoteIdentity: { remoteName: "origin", remoteUrl: join(root, "gone.git") } }] } });
    const deps: Deps = { ...realDeps(), orcaRepos: async () => ({ ok: true, stdout: list, stderr: "" }) };
    let out = "";
    const code = await main(["run"], { deps, env: { XDG_STATE_HOME: join(root, "state2"), XDG_CONFIG_HOME: join(root, "config") }, now: () => Date.now(), out: (t) => (out += t), err: () => {} });
    assert.equal(code, 0);
    assert.match(out, /^unreachable: fetch failed: .*gone\.git/);
    assert.deepEqual(snapshot(dir), s);
  });
});

describe("real git: merge safety", () => {
  it("refuses to overwrite an ignored local file that upstream starts tracking", async () => {
    const up = join(root, "ignored-seed");
    git(root, "init", "-q", up);
    commit(up, ".gitignore", ".env\n", "ignore env");
    const local = join(root, "ignored-local");
    git(root, "clone", "-q", up, local);
    writeFileSync(join(local, ".env"), "SECRET=local\n");
    writeFileSync(join(up, ".gitignore"), "");
    writeFileSync(join(up, ".env"), "SECRET=upstream\n");
    git(up, "add", ".gitignore", ".env");
    git(up, "commit", "-qm", "track env");
    git(local, "fetch", "-q", "origin");
    const before = git(local, "rev-parse", "HEAD");
    const m = await realDeps().git(local, gitArgs.merge("main"));
    assert.equal(m.ok, false);
    assert.equal(readFileSync(join(local, ".env"), "utf8"), "SECRET=local\n");
    assert.equal(git(local, "rev-parse", "HEAD"), before);
  });
});
