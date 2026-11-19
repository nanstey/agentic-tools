import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assertReadOnly, jobLogArgs } from "../scripts/adapters/gh.ts";
import {
  agentListArgs,
  archiveArgs,
  assertOrca,
  closeArgs,
  isBusy,
  launchArgs,
  matchWorktree,
  parseAgents,
  parseLaunch,
  parseSend,
  parseTerminals,
  piSessions,
  sendArgs,
  terminalListArgs,
  worktreeListArgs,
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
      archiveArgs("/w/x"),
    ])
      assert.doesNotThrow(() => assertOrca(a), a.join(" "));
  });

  it("rejects terminal send, other agents, worktree creation, and anything malformed", () => {
    for (const a of [
      ["terminal", "send", "--terminal", "term_a", "--text", "hi", "--enter", "--json"],
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
