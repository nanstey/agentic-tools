import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEFAULT_LIMIT, DEFAULT_ACTIONS, DEFAULT_DISPATCH, DEFAULT_RAILS, DEFAULT_REVIEW, type Account, type Config } from "../scripts/core/config.ts";
import { plan, scan, scopes, type CmdResult, type Deps } from "../scripts/scan.ts";
import { ME, prResponse } from "./fixtures.ts";

const account = (login: string, owners: string[] = [], repos: string[] = []): Account => ({ login, owners, repos });
const config = (accounts: Account[], worktrees = true): Config => ({ accounts, limit: DEFAULT_LIMIT, worktrees, rails: DEFAULT_RAILS, actions: DEFAULT_ACTIONS, dispatch: DEFAULT_DISPATCH, review: DEFAULT_REVIEW });
const DEFAULT_CONFIG = config([account(ME, ["Acme"])]);

const okJson = (v: unknown): CmdResult => ({ ok: true, stdout: JSON.stringify(v), stderr: "" });
const fail = (stderr: string): CmdResult => ({ ok: false, stdout: "", stderr });
const hit = (repo: string, number: number) => ({ number, repository: { nameWithOwner: repo } });

interface Fake {
  /** Search hits for an account and role. */
  search?: (login: string, role: "author" | "reviewer") => unknown[];
  own?: unknown[];
  asked?: unknown[];
  prs?: Record<string, CmdResult>;
  refs?: Record<string, CmdResult>;
  worktrees?: unknown[];
  dirty?: number | null;
}

function fakeDeps(f: Fake) {
  const calls: [string, string[]][] = [];
  const deps: Deps = {
    async gh(login, args) {
      calls.push([login, args]);
      if (args[0] === "search") {
        const role = args.includes("--author") ? "author" : "reviewer";
        if (f.search) return okJson(f.search(login, role));
        return okJson(role === "author" ? (f.own ?? []) : (f.asked ?? []));
      }
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

describe("scopes", () => {
  it("splits owners and repos into separate queries; none means unscoped", () => {
    assert.deepEqual(scopes(account("a")), [[]]);
    assert.deepEqual(scopes(account("a", ["O", "P"])), [["--owner", "O", "--owner", "P"]]);
    assert.deepEqual(scopes(account("a", ["O"], ["X/y"])), [["--owner", "O"], ["--repo", "X/y"]]);
  });
});

describe("scan", () => {
  it("searches own non-draft PRs and review requests scoped to owners", async () => {
    const { deps, calls } = fakeDeps({});
    await scan(deps, DEFAULT_CONFIG);
    const [own, asked] = calls;
    assert.deepEqual(own, [ME, ["search", "prs", "--author", ME, "--draft=false", "--state", "open", "--limit", "50", "--json", "number,repository", "--owner", "Acme"]]);
    assert.deepEqual(asked, [ME, ["search", "prs", "--review-requested", ME, "--state", "open", "--limit", "50", "--json", "number,repository", "--owner", "Acme"]]);
  });

  it("drops the owner filter for an unscoped account", async () => {
    const { deps, calls } = fakeDeps({});
    await scan(deps, config([account(ME)], false));
    assert.equal(calls.length, 2);
    assert.ok(calls.every(([, c]) => !c.includes("--owner") && !c.includes("--repo")));
  });

  it("fetches each PR once with its role and records failures", async () => {
    const { deps } = fakeDeps({
      own: [hit("Acme/x", 1), hit("Acme/x", 2)],
      asked: [hit("Acme/y", 3), hit("Acme/x", 1)],
      prs: { "Acme/x#1": okJson(prResponse()), "Acme/y#3": okJson(prResponse({ decision: null })) },
    });
    const r = await scan(deps, config(DEFAULT_CONFIG.accounts, false));
    assert.deepEqual(r.prs.map((p) => `${p.repo}#${p.number}:${p.role}:${p.account}`), [`Acme/x#1:author:${ME}`, `Acme/y#3:reviewer:${ME}`]);
    assert.deepEqual(r.errors, [`${ME}: Acme/x#2: Could not resolve`]);
    assert.deepEqual(plan(r).map((c) => c.kind), ["merge-ready", "review-requested"]);
  });

  it("runs each account with its own login and scope", async () => {
    const work = account("work", ["Acme"], ["Partner/shared"]);
    const personal = account("me");
    const { deps, calls } = fakeDeps({
      search: (login, role) =>
        login === "work"
          ? role === "author" ? [hit("Acme/x", 1), hit("Partner/shared", 2)] : []
          : role === "author"
            ? [hit("me/tool", 3), hit("Acme/x", 9)]
            : [hit("Acme/x", 1)],
      prs: {
        "Acme/x#1": okJson(prResponse()),
        "Partner/shared#2": okJson(prResponse()),
        "me/tool#3": okJson(prResponse()),
      },
    });
    const r = await scan(deps, config([work, personal], false));
    const searches = calls.filter(([, a]) => a[0] === "search").map(([l, a]) => `${l} ${a.slice(2, 4).join(" ")} ${a.slice(-2).join(" ")}`);
    assert.deepEqual(searches.sort(), [
      "me --author me --json number,repository",
      "me --review-requested me --json number,repository",
      "work --author work --owner Acme",
      "work --author work --repo Partner/shared",
      "work --review-requested work --owner Acme",
      "work --review-requested work --repo Partner/shared",
    ]);
    // Acme repos belong to `work`, so the personal account's Acme hits are dropped.
    assert.deepEqual(r.prs.map((p) => `${p.repo}#${p.number}:${p.account}`), ["Acme/x#1:work", "Partner/shared#2:work", "me/tool#3:me"]);
    const fetches = calls.filter(([, a]) => a[0] === "api").map(([l, a]) => `${l} ${a.find((x) => x.startsWith("r="))}`);
    assert.deepEqual(fetches.sort(), ["me r=tool", "work r=shared", "work r=x"]);
    assert.ok(plan(r).every((c) => c.account === (c.repo === "me/tool" ? "me" : "work")));
  });

  it("reports a failed search as an error", async () => {
    const { deps } = fakeDeps({});
    const d: Deps = { ...deps, gh: async (l, a) => (a[0] === "search" ? fail("rate limited") : deps.gh(l, a)) };
    const r = await scan(d, config(DEFAULT_CONFIG.accounts, false));
    assert.equal(r.errors.length, 2);
    assert.match(r.errors[0] ?? "", /^octocat: .*rate limited/);
  });

  it("finds worktrees of closed PRs by link or branch, only in covered repos", async () => {
    const wt = (path: string, branch: string, linkedPR: number | null = null, project = "github.com-alt/acme/x") => ({
      path,
      branch: `refs/heads/${branch}`,
      projectId: `github:${project}`,
      linkedPR,
    });
    const ref = (number: number, state: string) => ({ number, state, title: `t${number}`, url: `https://github.com/Acme/x/pull/${number}`, headRefOid: `sha${number}` });
    const list = (b: string) => `pr list -R acme/x --head ${b} --state all --limit 10 --json number,state,title,url,headRefOid`;
    const { deps, calls } = fakeDeps({
      worktrees: [
        wt("/linked", "a", 5),
        wt("/merged", "b"),
        wt("/reopened", "c"),
        wt("/none", "d"),
        wt("/err", "e"),
        wt("/hidden", "g"),
        wt("/other", "f", 1, "someone/else"),
        wt("/review", "prflow-review/x-5-c0ffee11", 5),
      ],
      refs: {
        "pr view 5 -R acme/x --json number,state,title,url,headRefOid": okJson(ref(5, "CLOSED")),
        [list("b")]: okJson([ref(6, "CLOSED"), ref(8, "MERGED")]),
        [list("c")]: okJson([ref(7, "CLOSED"), ref(9, "OPEN")]),
        [list("e")]: fail("boom"),
        [list("g")]: fail("GraphQL: Could not resolve to a Repository with the name 'acme/x'. (repository)"),
      },
      dirty: 2,
    });
    const r = await scan(deps, DEFAULT_CONFIG);
    assert.deepEqual(
      r.worktrees.map((w) => [w.path, w.repo, w.account, w.pr.number, w.pr.state, w.pr.headSha, w.dirtyFiles]),
      [
        ["/linked", "Acme/x", ME, 5, "CLOSED", "sha5", 2],
        ["/merged", "Acme/x", ME, 8, "MERGED", "sha8", 2],
      ],
    );
    assert.ok(!calls.some(([, a]) => a.includes("someone/else")));
    // Review worktrees are the review flow's to archive, never cleanup candidates.
    assert.ok(!r.worktrees.some((w) => w.path === "/review"));
    assert.deepEqual(r.errors, [`${ME}: acme/x e: boom`]);
    assert.deepEqual(plan(r).map((c) => `${c.kind}:${c.owner}`), ["cleanup:you", "cleanup:you"]);
  });

  it("survives an Orca failure", async () => {
    const { deps } = fakeDeps({});
    const r = await scan({ ...deps, orcaWorktrees: async () => { throw new Error("orca down"); } }, DEFAULT_CONFIG);
    assert.deepEqual(r.errors, ["orca-ide worktree list: orca down"]);
  });
});
