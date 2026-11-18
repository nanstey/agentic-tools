import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEFAULT_CONFIG, plan, scan, type CmdResult, type Deps } from "../scripts/scan.ts";
import { prResponse } from "./fixtures.ts";

const okJson = (v: unknown): CmdResult => ({ ok: true, stdout: JSON.stringify(v), stderr: "" });
const fail = (stderr: string): CmdResult => ({ ok: false, stdout: "", stderr });
const hit = (repo: string, number: number) => ({ number, repository: { nameWithOwner: repo } });

interface Fake {
  own?: unknown[];
  asked?: unknown[];
  prs?: Record<string, CmdResult>;
  refs?: Record<string, CmdResult>;
  worktrees?: unknown[];
  dirty?: number | null;
}

function fakeDeps(f: Fake) {
  const calls: string[][] = [];
  const deps: Deps = {
    async gh(args) {
      calls.push(args);
      if (args[0] === "search") return okJson(args.includes("--author") ? (f.own ?? []) : (f.asked ?? []));
      if (args[0] === "api") {
        const v = (k: string) => args.find((a) => a.startsWith(`${k}=`))?.slice(k.length + 1);
        return f.prs?.[`${v("o")}/${v("r")}#${v("n")}`] ?? fail("Could not resolve");
      }
      if (args[0] === "pr") return f.refs?.[args.join(" ")] ?? okJson([]);
      return fail("unexpected");
    },
    async orcaWorktrees() {
      return JSON.stringify({ result: { worktrees: f.worktrees ?? [] } });
    },
    async gitDirty() {
      return f.dirty === undefined ? 0 : f.dirty;
    },
  };
  return { deps, calls };
}

describe("scan", () => {
  it("searches own non-draft PRs and review requests scoped to owners", async () => {
    const { deps, calls } = fakeDeps({});
    await scan(deps, DEFAULT_CONFIG);
    const [own, asked] = calls;
    assert.deepEqual(own, ["search", "prs", "--author", "noelcf", "--draft=false", "--state", "open", "--limit", "50", "--json", "number,repository", "--owner", "Checkfront"]);
    assert.deepEqual(asked, ["search", "prs", "--review-requested", "noelcf", "--state", "open", "--limit", "50", "--json", "number,repository", "--owner", "Checkfront"]);
  });

  it("drops the owner filter when no owners are configured", async () => {
    const { deps, calls } = fakeDeps({});
    await scan(deps, { ...DEFAULT_CONFIG, owners: [], worktrees: false });
    assert.ok(calls.every((c) => !c.includes("--owner")));
  });

  it("fetches each PR once with its role and records failures", async () => {
    const { deps } = fakeDeps({
      own: [hit("A/x", 1), hit("A/x", 2)],
      asked: [hit("A/y", 3), hit("A/x", 1)],
      prs: { "A/x#1": okJson(prResponse()), "A/y#3": okJson(prResponse({ decision: null })) },
    });
    const r = await scan(deps, { ...DEFAULT_CONFIG, worktrees: false });
    assert.deepEqual(r.prs.map((p) => `${p.repo}#${p.number}:${p.role}`), ["A/x#1:author", "A/y#3:reviewer"]);
    assert.deepEqual(r.errors, ["A/x#2: Could not resolve"]);
    assert.deepEqual(plan(r, DEFAULT_CONFIG).map((c) => c.kind), ["merge-ready", "review-requested"]);
  });

  it("reports a failed search as an error", async () => {
    const { deps } = fakeDeps({});
    const d: Deps = { ...deps, gh: async (a) => (a[0] === "search" ? fail("rate limited") : deps.gh(a)) };
    const r = await scan(d, { ...DEFAULT_CONFIG, worktrees: false });
    assert.equal(r.errors.length, 2);
    assert.match(r.errors[0] ?? "", /rate limited/);
  });

  it("finds worktrees of closed PRs by link or branch", async () => {
    const wt = (path: string, branch: string, linkedPR: number | null = null) => ({
      path,
      branch: `refs/heads/${branch}`,
      projectId: "github:github.com-work/checkfront/x",
      linkedPR,
    });
    const ref = (number: number, state: string) => ({ number, state, title: `t${number}`, url: `https://github.com/Checkfront/x/pull/${number}` });
    const list = (b: string) => `pr list -R checkfront/x --head ${b} --state all --limit 10 --json number,state,title,url`;
    const { deps } = fakeDeps({
      worktrees: [wt("/linked", "a", 5), wt("/merged", "b"), wt("/reopened", "c"), wt("/none", "d"), wt("/err", "e")],
      refs: {
        "pr view 5 -R checkfront/x --json number,state,title,url": okJson(ref(5, "CLOSED")),
        [list("b")]: okJson([ref(6, "CLOSED"), ref(8, "MERGED")]),
        [list("c")]: okJson([ref(7, "CLOSED"), ref(9, "OPEN")]),
        [list("e")]: fail("boom"),
      },
      dirty: 2,
    });
    const r = await scan(deps, DEFAULT_CONFIG);
    assert.deepEqual(
      r.worktrees.map((w) => [w.path, w.repo, w.pr.number, w.pr.state, w.dirtyFiles]),
      [
        ["/linked", "Checkfront/x", 5, "CLOSED", 2],
        ["/merged", "Checkfront/x", 8, "MERGED", 2],
      ],
    );
    assert.deepEqual(r.errors, ["checkfront/x e: boom"]);
    assert.deepEqual(plan(r, DEFAULT_CONFIG).map((c) => `${c.kind}:${c.owner}`), ["cleanup:you", "cleanup:you"]);
  });

  it("survives an Orca failure", async () => {
    const { deps } = fakeDeps({});
    const r = await scan({ ...deps, orcaWorktrees: async () => { throw new Error("orca down"); } }, DEFAULT_CONFIG);
    assert.deepEqual(r.errors, ["orca worktree list: orca down"]);
  });
});
