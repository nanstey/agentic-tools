/** Shared fakes for state, dispatch, and tick tests. */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after } from "node:test";
import { assertReadOnly, assertRerun, rerunArgs } from "../scripts/adapters/gh.ts";
import { assertDeleteBranch, deleteBranchArgs } from "../scripts/adapters/git.ts";
import { agentListArgs, archiveArgs, assertArchive, assertOrca, closeArgs, interruptArgs, launchArgs, sendArgs, terminalListArgs, waitIdleArgs } from "../scripts/adapters/orca.ts";
import { DEFAULT_ACTIONS, DEFAULT_DISPATCH, DEFAULT_LIMIT, DEFAULT_RAILS, type Config, type Rails } from "../scripts/core/config.ts";
import type { CmdResult } from "../scripts/scan.ts";
import { Store } from "../scripts/store.ts";
import type { TickDeps } from "../scripts/tick.ts";
import { ME } from "./fixtures.ts";

const dirs: string[] = [];
after(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
});

/** A fresh store in a temp directory, removed after the test file. */
export function tempStore(): Store {
  const dir = mkdtempSync(join(tmpdir(), "prflow-test-"));
  dirs.push(dir);
  return Store.open(dir);
}

export const T0 = Date.parse("2026-01-12T17:00:00Z");
export const MIN = 60_000;

export const cfg = (rails: Partial<Rails> = {}, worktrees = false): Config => ({
  accounts: [{ login: ME, owners: ["Acme"], repos: [] }],
  limit: DEFAULT_LIMIT,
  worktrees,
  rails: { ...DEFAULT_RAILS, ...rails },
  actions: { ...DEFAULT_ACTIONS },
  dispatch: { ...DEFAULT_DISPATCH, projectContext: [] },
});

export const okJson = (v: unknown): CmdResult => ({ ok: true, stdout: JSON.stringify(v), stderr: "" });
export const fail = (stderr: string): CmdResult => ({ ok: false, stdout: "", stderr });

export interface World {
  clock: number;
  /** Own PRs: `Acme/repo#n` -> PR_QUERY response. */
  prs: Record<string, unknown>;
  /** Search fails with this message when set. */
  searchError?: string;
  /** Search never resolves (to trip the poll budget). */
  hang?: boolean;
  worktrees: unknown[];
  /** `gh pr list/view` responses by `-R repo` and head/number. */
  refs: Record<string, CmdResult>;
  dirty: Record<string, number | null>;
  /** Unpushed commit counts by worktree path (default 0). */
  unpushed: Record<string, number | null>;
  /** `gh run view` status by run id (default "completed"); `null` fails the call. */
  runs: Record<string, string | null>;
  /** Failing rerun or archive results by run id or path. */
  rerunFails: Record<string, string>;
  archiveFails: Record<string, string>;
  /** Branch checked out per worktree path (default from the worktree row); `null` for detached. */
  heads: Record<string, string | null>;
  branchFails: Record<string, string>;
  /** Raw `agent list` rows (`orcaSessionId`, `kind`, `agent`, `state`, `worktreeId`, `paneKey`, ...). */
  agents: Record<string, unknown>[];
  /** Raw `terminal list` rows by worktree id (`handle`, `tabId`, `leafId`, `lastOutputAt`, ...). */
  terminals: Record<string, Record<string, unknown>[]>;
  /** Failing Orca reads or writes, by call name (`agents`, `terminals`, `launch`, `send`, `close`). */
  orcaFails: Record<string, string>;
  /** `gh run view --job <id> --log-failed` output by job id. */
  logs: Record<string, string>;
  /** BRIEF_QUERY responses by `Acme/repo#n`; default derived from `prs`. */
  briefs: Record<string, unknown>;
  /** Launch reply override (raw JSON result). */
  launchReply?: unknown;
  /** The Pi session ignores Escape: it stays busy and never shows its prompt. */
  ignoreEscape?: boolean;
  /** Messages sent with orchestration send: `to | subject | body`. */
  sent: string[];
  /** Side effects performed, e.g. `rerun Acme/x 42`, `archive /w/a`. */
  effects: string[];
  calls: string[][];
}

/** Derive a BRIEF_QUERY response from a PR_QUERY fixture: urls and bodies added. */
export function briefFromPr(pr: unknown): unknown {
  const p = (pr as { data: { repository: { pullRequest: Record<string, unknown> } } }).data.repository.pullRequest;
  type N = { createdAt?: string; submittedAt?: string; body?: string; author: unknown; state?: string };
  const nodes = (x: unknown) => ((x as { nodes: N[] } | undefined)?.nodes ?? []);
  let i = 0;
  const note = (n: N) => ({ ...n, url: `https://github.com/Acme/x/pull/1#c${++i}`, body: n.body ?? `comment ${i}` });
  return {
    data: {
      repository: {
        pullRequest: {
          baseRefName: "main",
          headRefName: p.headRefName ?? "feature",
          comments: { nodes: nodes(p.comments).map(note) },
          reviews: { nodes: nodes(p.reviews).map(note) },
          reviewThreads: {
            nodes: nodes(p.reviewThreads).map((t) => {
              const th = t as unknown as { isResolved: boolean; comments: unknown };
              return { isResolved: th.isResolved, path: "src/a.ts", line: 7, originalLine: 7, comments: { nodes: nodes(th.comments).map(note) } };
            }),
          },
        },
      },
    },
  };
}

export function world(over: Partial<World> = {}): World {
  return {
    clock: T0, prs: {}, worktrees: [], refs: {}, dirty: {}, unpushed: {}, runs: {}, rerunFails: {}, archiveFails: {}, heads: {}, branchFails: {},
    agents: [], terminals: {}, orcaFails: {}, logs: {}, briefs: {}, sent: [], effects: [], calls: [], ...over,
  };
}

export function fakeTickDeps(w: World): TickDeps {
  return {
    now: () => w.clock,
    async gh(_login, args) {
      w.calls.push(["gh", ...args]);
      if (args[0] === "search") {
        if (w.hang) return new Promise<CmdResult>(() => {});
        if (w.searchError) return fail(w.searchError);
        if (args.includes("--review-requested")) return okJson([]);
        return okJson(
          Object.keys(w.prs).map((k) => {
            const [repo, n] = k.split("#");
            return { number: Number(n), repository: { nameWithOwner: repo } };
          }),
        );
      }
      if (args[0] === "api") {
        assertReadOnly(args);
        const v = (k: string) => args.find((a) => a.startsWith(`${k}=`))?.slice(k.length + 1);
        const key = `${v("o")}/${v("r")}#${v("n")}`;
        const pr = w.prs[key];
        if (v("query")?.includes("baseRefName")) return w.briefs[key] ? okJson(w.briefs[key]) : pr ? okJson(briefFromPr(pr)) : fail("Could not resolve");
        return pr ? okJson(pr) : fail("Could not resolve");
      }
      if (args[0] === "run" && args[2] === "--job") {
        assertReadOnly(args);
        const log = w.logs[args[3] ?? ""];
        return log === undefined ? fail("log not found") : { ok: true, stdout: log, stderr: "" };
      }
      if (args[0] === "pr") return w.refs[args.join(" ")] ?? okJson([]);
      if (args[0] === "run" && args[1] === "view") {
        assertReadOnly(args);
        const st = w.runs[args[2] ?? ""];
        return st === null ? fail("run not found") : okJson({ status: st ?? "completed", conclusion: "cancelled" });
      }
      return fail(`unexpected gh ${args.join(" ")}`);
    },
    async orcaWorktrees() {
      return JSON.stringify({ result: { worktrees: w.worktrees } });
    },
    async gitDirty(path) {
      return path in w.dirty ? (w.dirty[path] ?? null) : 0;
    },
    async gitUnpushed(path) {
      return path in w.unpushed ? (w.unpushed[path] ?? null) : 0;
    },
    async rerunFailed(_login, repo, runId) {
      assertRerun(rerunArgs(repo, runId));
      w.effects.push(`rerun ${repo} ${runId}`);
      const err = w.rerunFails[runId];
      return err ? fail(err) : { ok: true, stdout: "", stderr: "" };
    },
    async archiveWorktree(path) {
      assertArchive(archiveArgs(path));
      w.effects.push(`archive ${path}`);
      const err = w.archiveFails[path];
      return err ? fail(err) : okJson({ result: { removed: true } });
    },
    async branchInfo(path) {
      const row = (w.worktrees as { path?: string; branch?: string }[]).find((r) => r.path === path);
      const branch = path in w.heads ? (w.heads[path] ?? null) : (row?.branch?.replace(/^refs\/heads\//, "") ?? null);
      return { gitDir: "/repo/.git", branch, sha: "a".repeat(40) };
    },
    async orcaAgents() {
      assertOrca(agentListArgs());
      w.calls.push(["orca", "agent", "list"]);
      return w.orcaFails.agents ? fail(w.orcaFails.agents) : okJson({ ok: true, result: { agents: w.agents } });
    },
    async orcaTerminals(wt) {
      assertOrca(terminalListArgs(wt));
      w.calls.push(["orca", "terminal", "list", wt]);
      return w.orcaFails.terminals ? fail(w.orcaFails.terminals) : okJson({ ok: true, result: { terminals: w.terminals[wt] ?? [] } });
    },
    async launchPi(wt, prompt) {
      assertOrca(launchArgs(wt, prompt));
      w.effects.push(`launch ${wt}`);
      w.sent.push(`launch ${wt} | ${prompt}`);
      if (w.orcaFails.launch) return fail(w.orcaFails.launch);
      const n = w.effects.filter((e) => e.startsWith("launch")).length;
      const handle = `term_new${n}`;
      (w.terminals[wt] ??= []).push({ handle, worktreeId: wt, tabId: `tab${n}`, leafId: "l", agentIdentity: "pi", lastOutputAt: null });
      return okJson(w.launchReply ?? { ok: true, result: { launch: { outcome: { kind: "terminal", handle }, prompt: { outcome: "handed-to-terminal" }, receipt: { detail: "terminal per setting" } } } });
    },
    async sendToAgent(to, subject, body) {
      assertOrca(sendArgs(to, subject, body));
      w.effects.push(`send ${to}`);
      w.sent.push(`${to} | ${subject} | ${body}`);
      return w.orcaFails.send ? fail(w.orcaFails.send) : okJson({ ok: true, result: { message: { id: `msg_${w.sent.length}` } } });
    },
    async closeTerminal(handle) {
      assertOrca(closeArgs(handle));
      w.effects.push(`close ${handle}`);
      if (w.orcaFails.close) return fail(w.orcaFails.close);
      for (const k of Object.keys(w.terminals)) w.terminals[k] = (w.terminals[k] ?? []).filter((t) => t.handle !== handle);
      return okJson({ ok: true, result: { closed: true } });
    },
    async interruptTerminal(handle) {
      assertOrca(interruptArgs(handle));
      w.effects.push(`interrupt ${handle}`);
      if (w.orcaFails.interrupt) return fail(w.orcaFails.interrupt);
      // Escape ends the turn: the agent goes idle.
      const t = Object.values(w.terminals).flat().find((x) => (x as { handle: string }).handle === handle) as { tabId: string } | undefined;
      if (t && !w.ignoreEscape) for (const a of w.agents as { paneKey: string; state: string }[]) if (a.paneKey === `${t.tabId}:l`) a.state = "done";
      return okJson({ ok: true, result: { send: { accepted: true } } });
    },
    async waitIdle(handle) {
      assertOrca(waitIdleArgs(handle));
      w.calls.push(["orca", "terminal", "wait", handle]);
      return okJson({ ok: true, result: { wait: { handle, condition: "tui-idle", satisfied: !w.ignoreEscape } } });
    },
    async deleteBranch(gitDir, branch, sha) {
      assertDeleteBranch(deleteBranchArgs(gitDir, branch, sha));
      w.effects.push(`delete-branch ${branch}`);
      const err = w.branchFails[branch];
      return err ? fail(err) : { ok: true, stdout: "", stderr: "" };
    },
  };
}
