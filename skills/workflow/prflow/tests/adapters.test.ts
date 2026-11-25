import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assertReadOnly, jobLogArgs, parsePr, parsePrRefs, parseSearch, prArgs, PR_QUERY } from "../scripts/adapters/gh.ts";
import { assertDeleteBranch, assertReviewFetch, assertReviewReset, deleteBranchArgs, reviewFetchArgs, reviewResetArgs } from "../scripts/adapters/git.ts";
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
    assert.deepEqual(p.commitOids, [HEAD]);
    assert.equal(p.role, "reviewer");
    assert.deepEqual(p.checks, [{ typename: "StatusContext", name: "ci", state: "SUCCESS", url: null, isRequired: true }]);
    assert.deepEqual(p.reviewRequests, ["octocat"]);
  });

  it("returns null for a missing PR", () => {
    assert.equal(parsePr('{"data":{"repository":{"pullRequest":null}}}', "A/b", 1, "author", "octocat"), null);
    assert.equal(parsePr('{"data":{"repository":null}}', "A/b", 1, "author", "octocat"), null);
  });

  it("maps a null GitHub author to the deleted-account ghost representation", () => {
    const raw = prResponse({ comments: [{ createdAt: "2026-01-01", author: null }] });
    const parsed = parsePr(JSON.stringify(raw), "A/b", 1, "author", "octocat");
    assert.equal(parsed?.comments[0]?.author, null);
  });

  it("returns null for a PR with no commits ", () => {
    const raw = prResponse() as { data: { repository: { pullRequest: { commits: { nodes: unknown[] } } } } };
    raw.data.repository.pullRequest.commits.nodes = [];
    assert.equal(parsePr(JSON.stringify(raw), "A/b", 1, "author", "octocat"), null);
  });

  it("builds the per-PR query args and requests every field the rules use", () => {
    assert.deepEqual(prArgs("A/b", 7).slice(4), ["-F", "o=A", "-F", "r=b", "-F", "n=7"]);
    for (const f of ["isDraft", "headRefOid", "mergeStateStatus", "reviewDecision", "commits(last:100)", "committedDate", "comments(last:50,after:$commentsCursor)", "reviews(last:50,after:$reviewsCursor)", "reviewThreads(first:100,after:$threadsCursor)", "contexts(first:100,after:$checksCursor)"])
      assert.ok(PR_QUERY.includes(f), f);
    assert.doesNotMatch(PR_QUERY, /Legacy page-size markers/);
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
        { id: "r1::/a", path: "/a", branch: "refs/heads/feat", projectId: "github:github.com-alt/acme/x", linkedPR: 12 },
        { path: "/b", branch: "refs/heads/old", projectId: "github:Acme/y", isArchived: true },
        { path: "/c", branch: "refs/heads/z", projectId: "github:someone/tools" },
        { path: "/d", branch: null, projectId: "github:acme/x" },
        { path: "/e", branch: "refs/heads/f" },
      ],
    },
  };

  it("keeps active non-main worktrees of in-scope owners", () => {
    assert.deepEqual(parseWorktrees(JSON.stringify(list), ["Acme"]), [
      { id: "r1::/a", path: "/a", branch: "feat", repo: "acme/x", linkedPr: 12, workspaceStatus: null, comment: null, isUnread: null, displayName: null },
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
    ["run", "ci", "42", "--failed", "-R", "Acme/x"],
    ["run", "ci", "42", "-R", "Acme/x"],
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

  it("lets gh job log reads through only in their exact shape", () => {
    assert.doesNotThrow(() => assertReadOnly(jobLogArgs("Acme/x", "42")));
    for (const a of writes) assert.throws(() => assertReadOnly(a), /prflow/, a.join(" "));
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

describe("review git allowlists", () => {
  const sha = "a".repeat(40);
  it("allows exact review fetch/reset writes and rejects unsafe variants", () => {
    assert.doesNotThrow(() => assertReviewFetch(reviewFetchArgs("/w/prflow-review-x-5", 5)));
    assert.doesNotThrow(() => assertReviewReset(reviewResetArgs("/w/prflow-review-x-5", sha)));
    for (const a of [["-C", "/w/../x", "fetch", "origin", "pull/5/head"], ["-C", "/w/x", "fetch", "origin", "pull/5/head"], ["-C", "/w/prflow-review-parent/x", "fetch", "origin", "pull/5/head"], ["-C", "/w/prflow-review-x-5", "fetch", "origin", "main"], ["-C", "/w/prflow-review-x-5", "fetch", "origin", "pull/0/head"]]) assert.throws(() => assertReviewFetch(a));
    for (const a of [["-C", "/w/../x", "reset", "--hard", sha], ["-C", "/w/x", "reset", "--hard", sha], ["-C", "/w/prflow-review-parent/x", "reset", "--hard", sha], ["-C", "/w/prflow-review-x-5", "reset", "--hard", "A".repeat(40)], ["-C", "/w/prflow-review-x-5", "reset", "--hard", sha, "--force"]]) assert.throws(() => assertReviewReset(a));
  });
});

describe("branch deletion allowlist", () => {
  const sha = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
  it("allows exactly git --git-dir <abs> update-ref -d refs/heads/<branch> <sha>", () => {
    assert.deepEqual(deleteBranchArgs("/r/.git", "feat/x", sha), ["--git-dir", "/r/.git", "update-ref", "-d", "refs/heads/feat/x", sha]);
    assert.doesNotThrow(() => assertDeleteBranch(deleteBranchArgs("/r/.git", "feat/x-1.2", sha)));
    const bad = [
      deleteBranchArgs("r/.git", "x", sha),
      deleteBranchArgs("/r/../.git", "x", sha),
      deleteBranchArgs("/r/.git", "-x", sha),
      deleteBranchArgs("/r/.git", "a..b", sha),
      deleteBranchArgs("/r/.git", "a b", sha),
      deleteBranchArgs("/r/.git", "x*", sha),
      deleteBranchArgs("/r/.git", "x.lock", sha),
      deleteBranchArgs("/r/.git", "x", "abc"),
      deleteBranchArgs("/r/.git", "x", ""),
      ["--git-dir", "/r/.git", "update-ref", "-d", "refs/tags/x", sha],
      ["--git-dir", "/r/.git", "update-ref", "-d", "refs/heads/x"],
      ["--git-dir", "/r/.git", "branch", "-D", "x"],
      ["--git-dir", "/r/.git", "push", "origin", ":x"],
      ["--git-dir", "/r/.git", "update-ref", "-d", "refs/heads/x", sha, "--no-deref"],
    ];
    for (const a of bad) assert.throws(() => assertDeleteBranch(a), /not the allowed branch deletion/, a.join(" "));
  });
});
