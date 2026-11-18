import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assertReadOnly, parsePr, parsePrRefs, parseSearch, prArgs, PR_QUERY } from "../scripts/adapters/gh.ts";
import { parseWorktrees, repoFromPrUrl, repoFromProjectId } from "../scripts/adapters/orca.ts";
import { HEAD, prResponse, status } from "./fixtures.ts";

describe("assertReadOnly", () => {
  it("allows read calls", () => {
    for (const a of [
      ["search", "prs", "--author", "x"],
      ["pr", "list", "-R", "o/r"],
      ["pr", "view", "1"],
      prArgs("o/r", 1),
    ])
      assert.doesNotThrow(() => assertReadOnly(a));
  });

  it("rejects writes and account switching", () => {
    for (const a of [
      ["pr", "merge", "1"],
      ["pr", "review", "1", "--approve"],
      ["pr", "comment", "1"],
      ["run", "rerun", "1", "--failed"],
      ["auth", "switch"],
      ["api", "repos/o/r/pulls/1/merge", "-X", "PUT"],
      ["api", "graphql", "-f", "query=mutation{x}"],
      ["api", "graphql", "--method=POST", "-f", "query={x}"],
      ["api", "graphql", "-XPOST"],
      ["api", "graphql", "--input", "mutation.json"],
      ["api", "graphql", "-f", "query={viewer{login}}", "--input", "x"],
      ["api", "graphql", "-F", "query=@mutation.graphql"],
      ["api", "graphql", "-f", "query=query{x}", "-F", "o=@file"],
      ["api", "graphql", "-f"],
      ["api", "graphql", "-f", "query=Mutation{x}"],
      ["repo", "delete"],
      [],
    ])
      assert.throws(() => assertReadOnly(a), /prflow/, a.join(" "));
  });
});

describe("gh parsing", () => {
  it("parses search hits", () => {
    assert.deepEqual(parseSearch('[{"number":3,"repository":{"nameWithOwner":"A/b"}}]'), [{ repo: "A/b", number: 3 }]);
  });

  it("parses a PR snapshot", () => {
    const p = parsePr(JSON.stringify(prResponse({ checks: [status("ci", "SUCCESS", null, true)], requests: ["octocat"] })), "A/b", 1, "reviewer", "octocat");
    assert.ok(p);
    assert.equal(p.headSha, HEAD);
    assert.equal(p.role, "reviewer");
    assert.deepEqual(p.checks, [{ typename: "StatusContext", name: "ci", state: "SUCCESS", url: null, isRequired: true }]);
    assert.deepEqual(p.reviewRequests, ["octocat"]);
  });

  it("returns null for a missing PR", () => {
    assert.equal(parsePr('{"data":{"repository":{"pullRequest":null}}}', "A/b", 1, "author", "octocat"), null);
    assert.equal(parsePr('{"data":{"repository":null}}', "A/b", 1, "author", "octocat"), null);
  });

  it("returns null for a PR with no commits ", () => {
    const raw = prResponse() as { data: { repository: { pullRequest: { commits: { nodes: unknown[] } } } } };
    raw.data.repository.pullRequest.commits.nodes = [];
    assert.equal(parsePr(JSON.stringify(raw), "A/b", 1, "author", "octocat"), null);
  });

  it("builds the per-PR query args and requests every field the rules use", () => {
    assert.deepEqual(prArgs("A/b", 7).slice(4), ["-F", "o=A", "-F", "r=b", "-F", "n=7"]);
    for (const f of ["isDraft", "headRefOid", "mergeStateStatus", "reviewDecision", "committedDate", "comments(last:50)", "reviews(last:50)", "reviewThreads(first:100)", "contexts(first:100)"])
      assert.ok(PR_QUERY.includes(f), f);
  });

  it("parses pr view and pr list output", () => {
    const one = { number: 1, state: "MERGED", title: "t", url: "u" };
    assert.deepEqual(parsePrRefs(JSON.stringify(one)), [one]);
    assert.deepEqual(parsePrRefs("[]"), []);
  });
});

describe("orca parsing", () => {
  const list = {
    result: {
      worktrees: [
        { path: "/m", branch: "refs/heads/main", projectId: "github:github.com-alt/acme/x", isMainWorktree: true },
        { path: "/a", branch: "refs/heads/feat", projectId: "github:github.com-alt/acme/x", linkedPR: 12 },
        { path: "/b", branch: "refs/heads/old", projectId: "github:Acme/y", isArchived: true },
        { path: "/c", branch: "refs/heads/z", projectId: "github:someone/tools" },
        { path: "/d", branch: null, projectId: "github:acme/x" },
        { path: "/e", branch: "refs/heads/f" },
      ],
    },
  };

  it("keeps active non-main worktrees of in-scope owners", () => {
    assert.deepEqual(parseWorktrees(JSON.stringify(list), ["Acme"]), [
      { path: "/a", branch: "feat", repo: "acme/x", linkedPr: 12 },
    ]);
  });

  it("keeps every owner when none are configured", () => {
    assert.deepEqual(
      parseWorktrees(JSON.stringify(list), []).map((w) => w.path),
      ["/a", "/c"],
    );
  });

  it("parses repo ids and PR urls", () => {
    assert.equal(repoFromProjectId("github:github.com-alt/acme/widgets"), "acme/widgets");
    assert.equal(repoFromProjectId("folder:/x"), null);
    assert.equal(repoFromPrUrl("https://github.com/Acme/x/pull/5"), "Acme/x");
    assert.equal(repoFromPrUrl("nope"), null);
  });
});
