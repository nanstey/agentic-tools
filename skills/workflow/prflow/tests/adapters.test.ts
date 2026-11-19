import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assertReadOnly, assertRerun, parsePr, parsePrRefs, parseSearch, prArgs, PR_QUERY, rerunArgs, runViewArgs } from "../scripts/adapters/gh.ts";
import { archiveArgs, assertArchive, parseWorktrees, repoFromPrUrl, repoFromProjectId } from "../scripts/adapters/orca.ts";
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

describe("phase 3 allowlist", () => {
  const writes: string[][] = [
    ["run", "rerun", "42", "--failed", "-R", "Acme/x"],
    ["run", "rerun", "42", "-R", "Acme/x"],
    ["run", "cancel", "42", "-R", "Acme/x"],
    ["run", "delete", "42", "-R", "Acme/x"],
    ["run", "watch", "42", "-R", "Acme/x"],
    ["run", "download", "42", "-R", "Acme/x"],
    ["run", "list", "-R", "Acme/x"],
    ["run", "view", "42", "-R", "Acme/x", "--log"],
    ["run", "view", "42", "-R", "Acme/x", "--json", "status", "--web"],
    ["run", "view", "42", "--json", "status"],
    ["run", "view", "abc", "-R", "Acme/x", "--json", "status"],
    ["run", "view", "42", "-R", "Acme/x", "--json", "status;rm"],
    ["workflow", "run", "ci.yml"],
    ["pr", "merge", "1"],
    ["pr", "review", "1", "--approve"],
    ["pr", "comment", "1", "--body", "x"],
    ["auth", "switch"],
  ];

  it("lets gh run view through only in its exact read shape", () => {
    assert.doesNotThrow(() => assertReadOnly(runViewArgs("Acme/x", "42")));
    for (const a of writes) assert.throws(() => assertReadOnly(a), /prflow/, a.join(" "));
  });

  it("allows exactly one write: gh run rerun <id> --failed -R <owner/repo>", () => {
    assert.deepEqual(rerunArgs("Acme/x", "42"), ["run", "rerun", "42", "--failed", "-R", "Acme/x"]);
    assert.doesNotThrow(() => assertRerun(rerunArgs("Acme/x", "42")));
    const others = [
      ...writes.slice(1),
      ["run", "rerun", "42", "--failed"],
      ["run", "rerun", "42", "--failed", "-R", "Acme/x", "--debug"],
      ["run", "rerun", "--job", "7", "-R", "Acme/x"],
      ["run", "rerun", "42", "--failed", "-R", "Acme"],
      ["run", "rerun", "0", "--failed", "-R", "Acme/x"],
      ["run", "rerun", "-1", "--failed", "-R", "Acme/x"],
      ["run", "rerun", "42", "--failed", "-R", "Acme/x;rm"],
      ["run", "rerun", "42", "-R", "Acme/x", "--failed"],
      ["api", "graphql", "-f", "query=query{viewer{login}}"],
    ];
    for (const a of others) assert.throws(() => assertRerun(a), /not the allowed rerun call/, a.join(" "));
  });

  it("allows exactly one Orca write: worktree rm by absolute path, never forced", () => {
    assert.deepEqual(archiveArgs("/w/a"), ["worktree", "rm", "--worktree", "path:/w/a", "--json"]);
    assert.doesNotThrow(() => assertArchive(archiveArgs("/w/a b")));
    const bad = [
      ["worktree", "rm", "--worktree", "path:/w/a", "--json", "--force"],
      ["worktree", "rm", "--worktree", "path:/w/a", "--force"],
      ["worktree", "rm", "--worktree", "path:/w/a", "--delete-branch"],
      ["worktree", "rm", "--worktree", "path:/w/a", "--json", "--run-hooks"],
      ["worktree", "rm", "--worktree", "active", "--json"],
      ["worktree", "rm", "--worktree", "path:w/a", "--json"],
      ["worktree", "rm", "--worktree", "path:/w/../etc", "--json"],
      ["worktree", "rm", "--worktree", "branch:main", "--json"],
      ["worktree", "create", "--worktree", "path:/w/a", "--json"],
      ["worktree", "set", "--worktree", "path:/w/a", "--json"],
    ];
    for (const a of bad) assert.throws(() => assertArchive(a), /not the allowed archive call/, a.join(" "));
  });
});
