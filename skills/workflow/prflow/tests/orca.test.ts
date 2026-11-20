import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assertReadOnly, jobLogArgs } from "../scripts/adapters/gh.ts";
import {
  agentListArgs,
  archiveArgs,
  assertOrca,
  closeArgs,
  interruptArgs,
  waitIdleArgs,
  isBusy,
  launchArgs,
  matchWorktree,
  parseAgents,
  parseLaunch,
  parseWaitIdle,
  parseSend,
  parseTerminals,
  piSessions,
  sendArgs,
  terminalListArgs,
  worktreeListArgs,
  assertWorktreeName,
  assertWorktreeSet,
  worktreeNameArgs,
  worktreeSetArgs,
  findReviewWorktree,
  parseCreatedWorktree,
  repoIdFor,
  reviewSlug,
  reviewWorktreeArgs,
  assertWorktreeUnparent,
  detachedEnv,
  ORCA_CALLER_ENV,
  worktreeUnparentArgs,
  type OrcaWorktree,
} from "../scripts/adapters/orca.ts";

const WT = "repo1::/w/x";

describe("assertOrca", () => {
  it("allows exactly the reads, launch, send, close, and archive calls", () => {
    for (const a of [
      worktreeListArgs(),
      agentListArgs(),
      terminalListArgs(WT),
      launchArgs(WT, "brief"),
      sendArgs("term_abc-1", "s", "b"),
      sendArgs("orca_session_id:pi_1", "s", "b"),
      closeArgs("term_abc"),
      interruptArgs("term_abc"),
      waitIdleArgs("term_abc"),
      archiveArgs("/w/x"),
      reviewWorktreeArgs("17a840f6-fff8-4935", "guest-widgets-598", 598),
    ])
      assert.doesNotThrow(() => assertOrca(a), a.join(" "));
  });

  it("allows exactly one persistent review worktree per PR", () => {
    const ok = reviewWorktreeArgs("rid1", "x-5", 5);
    assert.deepEqual(ok, ["worktree", "create", "--repo", "id:rid1", "--name", "prflow-review-x-5", "--branch", "prflow-review/x-5", "--pr", "5", "--no-parent", "--setup", "run", "--json"]);
    const swap = (i: number, v: string) => ok.map((x, j) => (j === i ? v : x));
    for (const a of [
      [...ok.slice(0, -1), "--agent", "pi", "--json"],
      [...ok.slice(0, -1), "--prompt", "x", "--json"],
      [...ok.slice(0, -1), "--activate", "--json"],
      swap(3, "id:rid1::/w/x"),
      swap(3, "path:/w/x"),
      swap(5, "my-task"),
      swap(5, "prflow-review-x-6"),
      swap(7, "main"),
      swap(7, "prflow-review/x-6"),
      swap(9, "6"),
      swap(10, "--parent-worktree"),
      swap(12, "skip"),
      reviewWorktreeArgs("rid1", "../x-5", 5),
      reviewWorktreeArgs("rid1", "x-05", 5),
      reviewWorktreeArgs("rid1", "x-0-c0ffee11", 0),
      ["worktree", "create", "--name", "prflow-review-x-5-c0ffee11", "--json"],
    ])
      assert.throws(() => assertOrca(a), /prflow: orca-ide worktree create/, a.join(" "));
  });

  it("allows only exact review status writes and rejects unsafe fields", () => {
    const args = worktreeSetArgs("/w/prflow-review-x-5", "reviewing", "queued c0ffee11", "--unread");
    assert.doesNotThrow(() => assertWorktreeSet(args, "/w/prflow-review-x-5"));
    for (const bad of [
      worktreeSetArgs("/w/other", "reviewing", "queued"),
      worktreeSetArgs("/w/prflow-review-parent/other", "reviewing", "queued"),
      worktreeSetArgs("/w/prflow-review-x-5", "../unsafe", "queued"),
      worktreeSetArgs("/w/prflow-review-x-5", "reviewing", "line\nbreak"),
      [...args.slice(0, -1), "--force", "--json"],
    ]) assert.throws(() => assertWorktreeSet(bad, "/w/prflow-review-x-5"));
  });

  it("allows only an exact display-name write on a review worktree folder", () => {
    const args = worktreeNameArgs("/w/prflow-review-x-5", "c/t219-converted-giftcert-followup");
    assert.deepEqual(args, ["worktree", "set", "--worktree", "path:/w/prflow-review-x-5", "--display-name", "c/t219-converted-giftcert-followup", "--json"]);
    assert.doesNotThrow(() => assertWorktreeName(args, "/w/prflow-review-x-5"));
    assert.doesNotThrow(() => assertOrca(args));
    for (const bad of [
      worktreeNameArgs("/w/other", "feature"),
      worktreeNameArgs("/w/prflow-review-parent/other", "feature"),
      worktreeNameArgs("/w/../prflow-review-x-5", "feature"),
      worktreeNameArgs("relative/prflow-review-x-5", "feature"),
      worktreeNameArgs("/w/prflow-review-x-5", ""),
      worktreeNameArgs("/w/prflow-review-x-5", "--force"),
      worktreeNameArgs("/w/prflow-review-x-5", "line\nbreak"),
      [...args.slice(0, -1), "--workspace-status", "done", "--json"],
      ["worktree", "set", "--worktree", "path:/w/prflow-review-x-5", "--display-name", "feature", "--pr", "null", "--json"],
    ]) {
      assert.throws(() => assertWorktreeName(bad), bad.join(" "));
      assert.throws(() => assertOrca(bad), bad.join(" "));
    }
    assert.throws(() => assertWorktreeName(args, "/w/prflow-review-x-6"));
  });

  it("rejects terminal send, other agents, worktree creation, and anything malformed", () => {
    for (const a of [
      ["terminal", "send", "--terminal", "term_a", "--text", "hi", "--enter", "--json"],
      ["terminal", "send", "--terminal", "term_a", "--text", "hi", "--json"],
      ["terminal", "send", "--terminal", "term_a", "--text", "\x03", "--json"],
      ["terminal", "send", "--terminal", "term_a", "--text", "\x1b", "--enter", "--json"],
      ["terminal", "send", "--terminal", "term_a", "--text", "\x1b", "--interrupt", "--json"],
      ["terminal", "send", "--terminal", "term_a", "--text", "\x1b\x1b", "--json"],
      interruptArgs("orca_session_id:pi_1"),
      ["terminal", "wait", "--terminal", "term_a", "--for", "exit", "--timeout-ms", "30000", "--json"],
      ["terminal", "wait", "--terminal", "term_a", "--for", "tui-idle", "--timeout-ms", "999999", "--json"],
      ["agent", "launch", "--agent", "codex", "--surface", "terminal", "--worktree", `id:${WT}`, "--prompt", "x", "--json"],
      ["agent", "launch", "--agent", "pi", "--surface", "chat", "--worktree", `id:${WT}`, "--prompt", "x", "--json"],
      launchArgs(WT, ""),
      launchArgs("repo1::/w/../etc", "x"),
      ["agent", "launch", "--agent", "pi", "--surface", "terminal", "--worktree", "active", "--prompt", "x", "--json"],
      ["worktree", "create", "--name", "x", "--json"],
      ["worktree", "rm", "--worktree", "path:/w/x", "--force", "--json"],
      sendArgs("@all", "s", "b"),
      sendArgs("run:1", "s", "b"),
      sendArgs("term_a", "", "b"),
      [...sendArgs("term_a", "s", "b"), "--type", "worker_done"],
      closeArgs("orca_session_id:pi_1"),
      ["terminal", "close", "--worktree", `id:${WT}`, "--all", "--json"],
      ["automations", "list", "--json"],
      ["orchestration", "task-create", "--json"],
      [],
    ])
      assert.throws(() => assertOrca(a), /prflow: orca-ide/, a.join(" "));
  });
});

describe("review worktrees", () => {
  const list = (rows: unknown[]) => JSON.stringify({ result: { worktrees: rows } });
  const main = (repoId: string, path: string, project = "github:github.com-work/acme/widgets") => ({ id: `${repoId}::${path}`, repoId, path, branch: "refs/heads/main", projectId: project, isMainWorktree: true });

  it("names a stable slug from repo and number", () => {
    assert.equal(reviewSlug("Checkfront/guest-widgets", 598, "D5F5DA28"), "guest-widgets-598");
  });

  it("finds the Orca repo id from the main worktree, preferring the clone named after the repo", () => {
    assert.deepEqual(repoIdFor(list([main("r1", "/c/widgets")]), "Acme/Widgets"), { id: "r1", path: "/c/widgets" });
    assert.deepEqual(repoIdFor(list([main("r1", "/c/widgets-2"), main("r2", "/c/widgets")]), "acme/widgets"), { id: "r2", path: "/c/widgets" });
    assert.equal(repoIdFor(list([main("r1", "/c/w-2"), main("r2", "/c/w-3")]), "acme/widgets"), null);
    assert.equal(repoIdFor(list([main("r1", "/c/widgets", "github:acme/other")]), "acme/widgets"), null);
    assert.equal(repoIdFor(list([]), "acme/widgets"), null);
  });

  it("finds a review worktree by its branch, with Orca's numeric suffix", () => {
    const row = (branch: string, linkedPr: number | null = 5): OrcaWorktree => ({ id: `r1::/w/${branch}`, path: `/w/${branch}`, branch, repo: "acme/x", linkedPr });
    assert.equal(findReviewWorktree([row("prflow-review/x-5")], "Acme/x", 5, "x-5")?.path, "/w/prflow-review/x-5");
    assert.equal(findReviewWorktree([row("prflow-review/x-5-2")], "Acme/x", 5, "x-5")?.branch, "prflow-review/x-5-2");
    assert.equal(findReviewWorktree([row("prflow-review/x-5x")], "Acme/x", 5, "x-5"), null);
    assert.equal(findReviewWorktree([row("prflow-review/x-5", 9)], "Acme/x", 5, "x-5"), null);
    assert.equal(findReviewWorktree([row("feature")], "Acme/x", 5, "x-5-c0ffee11"), null);
  });

  it("reads the created worktree from the reply, and Orca errors", () => {
    assert.deepEqual(parseCreatedWorktree(JSON.stringify({ ok: true, result: { worktree: { id: "r1::/w/a", path: "/w/a" }, lineage: null, workspaceLineage: null } })), { id: "r1::/w/a", path: "/w/a", nested: false });
    assert.equal(parseCreatedWorktree(JSON.stringify({ ok: true, result: { worktree: { id: "r1::/w/a", path: "/w/a" }, lineage: null, workspaceLineage: { parentWorkspaceKey: "folder:bot" } } }))?.nested, true);
    assert.equal(parseCreatedWorktree(JSON.stringify({ ok: true, result: { created: true } })), null);
    assert.throws(() => parseCreatedWorktree(JSON.stringify({ ok: false, error: { code: "exists", message: "taken" } })), /exists: taken/);
  });
});

describe("gh job log read", () => {
  it("allows only the exact --log-failed read", () => {
    assert.doesNotThrow(() => assertReadOnly(jobLogArgs("Acme/x", "777")));
    for (const a of [
      ["run", "view", "--job", "777", "-R", "Acme/x", "--log"],
      ["run", "view", "--job", "x", "-R", "Acme/x", "--log-failed"],
      ["run", "view", "--job", "777", "-R", "Acme/x", "--log-failed", "--web"],
      ["run", "rerun", "--job", "777", "-R", "Acme/x", "--log-failed"],
    ])
      assert.throws(() => assertReadOnly(a), /prflow/, a.join(" "));
  });
});

describe("matchWorktree", () => {
  const w = (path: string, branch: string, linkedPr: number | null, repo = "acme/x"): OrcaWorktree => ({ id: `r::${path}`, path, branch, repo, linkedPr });
  it("prefers the linked PR, then the head branch", () => {
    const rows = [w("/b", "feat", null), w("/a", "other", 5)];
    assert.equal((matchWorktree(rows, "Acme/x", 5, "feat") as { worktree: OrcaWorktree }).worktree.path, "/a");
    assert.equal((matchWorktree(rows, "Acme/x", 6, "feat") as { worktree: OrcaWorktree }).worktree.path, "/b");
  });
  it("ignores other repos and worktrees linked to another PR, and reports ambiguity", () => {
    assert.equal(matchWorktree([w("/a", "feat", null, "acme/y"), w("/b", "feat", 9)], "Acme/x", 5, "feat").ok, false);
    const amb = matchWorktree([w("/a", "feat", null), w("/b", "feat", null)], "Acme/x", 5, "feat");
    assert.deepEqual(amb, { ok: false, reason: "several Orca worktrees match (/a, /b)" });
  });
});

describe("Pi sessions", () => {
  const agents = JSON.stringify({
    ok: true,
    result: {
      agents: [
        { orcaSessionId: "s1", kind: "terminal", agent: "pi", state: "working", worktreeId: WT, paneKey: "t1:l1", lastAssistantMessage: null, updatedAt: 100 },
        { orcaSessionId: "s2", kind: "terminal", agent: "codex", state: "done", worktreeId: WT, paneKey: "t2:l1", updatedAt: 100 },
        { orcaSessionId: "pi_c", kind: "chat", agent: "pi", state: "done", worktreeId: WT, paneKey: "structured:x", lastAssistantMessage: "hi", updatedAt: 50 },
        { orcaSessionId: "s4", kind: "terminal", agent: "pi", state: "done", worktreeId: "other::/o", paneKey: "t9:l1", updatedAt: 1 },
      ],
    },
  });
  const terms = JSON.stringify({
    ok: true,
    result: {
      terminals: [
        { handle: "term_1", worktreeId: WT, tabId: "t1", leafId: "l1", agentIdentity: "pi", lastOutputAt: 200 },
        { handle: "term_2", worktreeId: WT, tabId: "t2", leafId: "l1", agentIdentity: "codex", lastOutputAt: 300 },
        { handle: "term_3", worktreeId: WT, tabId: "t3", leafId: "l1", agentIdentity: "pi", lastOutputAt: 10 },
        { handle: "term_4", worktreeId: WT, tabId: "t4", leafId: "l1", lastOutputAt: 10 },
      ],
    },
  });

  it("joins agent rows to terminals by pane and keeps only Pi", () => {
    const ss = piSessions(WT, parseAgents(agents), parseTerminals(terms));
    assert.deepEqual(ss, [
      { handle: "term_1", kind: "terminal", sessionId: "s1", state: "working", lastActivityAt: 200, lastMessage: null },
      { handle: "term_3", kind: "terminal", sessionId: null, state: "unknown", lastActivityAt: 10, lastMessage: null },
      { handle: "orca_session_id:pi_c", kind: "chat", sessionId: "pi_c", state: "done", lastActivityAt: 50, lastMessage: "hi" },
    ]);
    assert.deepEqual(ss.map(isBusy), [true, true, false]);
  });

  it("surfaces Orca errors", () => {
    assert.throws(() => parseAgents(JSON.stringify({ ok: false, error: { code: "runtime_down", message: "no" } })), /agent list: runtime_down: no/);
  });

  it("reads a tui-idle wait reply", () => {
    assert.equal(parseWaitIdle(JSON.stringify({ ok: true, result: { wait: { condition: "tui-idle", satisfied: true } } })), true);
    assert.equal(parseWaitIdle(JSON.stringify({ ok: true, result: { wait: { condition: "tui-idle", satisfied: false } } })), false);
    assert.equal(parseWaitIdle(JSON.stringify({ ok: false, error: { code: "timeout" } })), false);
    assert.equal(parseWaitIdle("not json"), false);
  });

  it("parses launch and send replies", () => {
    assert.deepEqual(parseLaunch(JSON.stringify({ ok: true, result: { launch: { outcome: { kind: "terminal", handle: "term_9" }, prompt: { outcome: "journaled" }, receipt: { detail: "cli" } } } })), {
      handle: "term_9",
      kind: "terminal",
      promptDelivered: true,
      detail: "prompt journaled; cli",
    });
    assert.equal(parseLaunch(JSON.stringify({ ok: true, result: { agentTerminalHandle: "term_old" } })).promptDelivered, false);
    assert.throws(() => parseLaunch(JSON.stringify({ ok: true, result: {} })), /no agent handle/);
    assert.equal(parseSend(JSON.stringify({ ok: true, result: { message: { id: "m1" } } })), "m1");
  });
});

describe("top-level review worktrees", () => {
  it("drops the caller's Orca identity from the create environment and keeps the connection", () => {
    const env = { PATH: "/bin", ORCA_TERMINAL_HANDLE: "term_bot", ORCA_AGENT_SESSION_ID: "s1", ORCA_AGENT_SESSION_SPAWN_TOKEN: "t", ORCA_BOT_TOOLS_TOKEN: "b", ORCA_WORKSPACE_ID: "folder:bot", ORCA_WORKTREE_ID: "folder:bot", ORCA_ENVIRONMENT: "local", ORCA_PAIRING_CODE: "p", ORCA_USER_DATA_PATH: "/u", ORCA_CLI_COMMAND: "/c" };
    const out = detachedEnv(env);
    for (const k of ORCA_CALLER_ENV) assert.equal(k in out, false, k);
    assert.deepEqual([out.PATH, out.ORCA_ENVIRONMENT, out.ORCA_PAIRING_CODE, out.ORCA_USER_DATA_PATH, out.ORCA_CLI_COMMAND], ["/bin", "local", "p", "/u", "/c"]);
    assert.equal(env.ORCA_TERMINAL_HANDLE, "term_bot", "the caller's environment is not modified");
  });

  it("allows --no-parent only on a prflow-review- folder", () => {
    const ok = worktreeUnparentArgs("/w/prflow-review-x-5");
    assert.deepEqual(ok, ["worktree", "set", "--worktree", "path:/w/prflow-review-x-5", "--no-parent", "--json"]);
    assert.doesNotThrow(() => assertOrca(ok));
    assert.doesNotThrow(() => assertWorktreeUnparent(ok, "/w/prflow-review-x-5"));
    assert.throws(() => assertWorktreeUnparent(ok, "/w/prflow-review-x-6"), /not the allowed review worktree unparent call/);
    for (const bad of [
      worktreeUnparentArgs("/w/other"),
      worktreeUnparentArgs("/w/prflow-review-x/../other"),
      worktreeUnparentArgs("relative/prflow-review-x-5"),
      ["worktree", "set", "--worktree", "path:/w/prflow-review-x-5", "--no-parent", "--parent-worktree", "active", "--json"],
      ["worktree", "set", "--worktree", "id:r::/w/prflow-review-x-5", "--no-parent", "--json"],
    ]) assert.throws(() => assertOrca(bad), /prflow: orca-ide/, bad.join(" "));
  });
});
