/**
 * Safe actions for `prflow tick`: `cleanup` (archive a clean Orca worktree of a
 * merged or closed PR, and delete eligible local branches, including review
 * branches after either close or merge).
 *
 * Live actions go through `beginDispatch`, which writes the dispatch row, a
 * `started` ledger row, and a `dispatched` event before the side effect. The
 * outcome then moves the row to `done` or `failed` with an `archived` or
 * `action-failed` event. A crash in between leaves an open row that the next
 * tick reconciles (`verify`) or marks stale when its lease runs out.
 *
 * Dry runs make the same read-only checks and announce each action once per
 * item version as a `dry-run` event, without writing a dispatch.
 */

import { deleteBranchArgs, safeBranch } from "./adapters/git.ts";
import { archiveArgs, isBusy, isReviewBranch, parseAgents, parseTerminals, parseWorktrees, piSessions } from "./adapters/orca.ts";
import { classifyWorktree } from "./core/classify.ts";
import { leaseUntil } from "./core/rails.ts";
import type { Classification, Kind, WorktreeItem } from "../../../../lib/pr/types.ts";
import { beginDispatch, finishDispatch, legacyHandled, type TickContext } from "./dispatch.ts";
import type { ScanResult } from "./scan.ts";
import type { Dispatch, Store } from "./store.ts";
import type { Act, TickDeps, TickOptions, Verify } from "./tick.ts";

const short = (s: string, n = 300) => (s.length > n ? `${s.slice(0, n)}...` : s);

/** Ledger-backed "say it once": emit `event` only the first time `ref` is seen. */
export function once(store: Store, now: number, ref: string, outcome: string, ev: { type: "needs-decision" | "dry-run"; item: string; version: string; kind: Kind; detail: string }): void {
  if (store.addLedger({ at: now, item: ev.item, version: ev.version, kind: ev.kind, outcome, detail: ev.detail, source: "prflow", ref }))
    store.appendEvent(now, ev);
}

/** Why a dry run would not act, mirroring the checks `beginDispatch` makes before the rails. */
export function dryRunBlocked(store: Store, item: string, version: string, kind: Kind, trigger: string | null): string | null {
  if (store.systemPaused() !== null) return "prflow paused";
  if (store.item(item)?.paused) return "item paused";
  const d = store.findDispatch(item, version, kind);
  if (d && d.state !== "failed" && d.state !== "stale") return `dispatch #${d.id} ${d.state}`;
  if (!d && legacyHandled(store, item, version, kind, trigger)) return "legacy";
  return null;
}

interface Run {
  deps: TickDeps;
  store: Store;
  ctx: TickContext;
  dryRun: boolean;
}

/** Start a live dispatch (row and event first), run `effect`, and record the outcome. */
async function live(
  r: Run,
  req: { item: string; version: string; kind: Kind; trigger: string | null; command: string; target?: string },
  effect: () => Promise<{ ok: boolean; detail: string }>,
  success: "archived",
): Promise<void> {
  const { store, ctx } = r;
  const start = beginDispatch(store, ctx, { item: req.item, version: req.version, kind: req.kind, trigger: req.trigger, event: { type: "dispatched", detail: req.command } });
  if (!start.ok) return;
  const d = store.transition(start.dispatch.id, "launched", ctx.now, { leaseUntil: leaseUntil(ctx.rails, ctx.now), detail: req.target ?? null });
  const out = await effect();
  const ev = { item: d.item, version: d.version, kind: d.kind, dispatchId: d.id };
  const now = r.deps.now();
  if (out.ok) {
    finishDispatch(store, now, d, "done", out.detail);
    store.appendEvent(now, { ...ev, type: success, detail: short(out.detail) });
  } else {
    finishDispatch(store, now, d, "failed", out.detail);
    store.appendEvent(now, { ...ev, type: "action-failed", detail: short(out.detail) });
  }
}

/**
 * Dry runs honour the per-tick start cap so they show what one live tick would
 * do. An action announced in an earlier tick takes no slot, as a done dispatch
 * would not in a live tick.
 */
export function dryRunSlot(r: Pick<Run, "store" | "ctx">, ref: string): boolean {
  if (r.store.hasLedgerRef(ref)) return false;
  if (r.ctx.starts >= r.ctx.rails.startsPerTick) return false;
  r.ctx.starts++;
  return true;
}

/** Dispatch version for a cleanup: PR state plus the worktree path (one PR may have several). */
export const cleanupVersion = (c: Classification, w: WorktreeItem): string => `${c.version}:${w.path}`;

async function cleanup(r: Run, w: WorktreeItem): Promise<void> {
  const { deps, store, ctx } = r;
  const c = classifyWorktree(w);
  if (!c || (w.pr.state !== "MERGED" && w.pr.state !== "CLOSED")) return;
  const version = cleanupVersion(c, w);
  if (dryRunBlocked(store, c.key, version, "cleanup", null)) return;
  // Review worktrees persist while the PR is open. Before archival, verify the
  // Orca sessions so a closed PR cannot remove a worktree under a running Pi.
  let reviewerSessions: ReturnType<typeof piSessions> = [];
  if (w.branch.startsWith("prflow-review/")) {
    let id: string | undefined;
    try {
      id = parseWorktrees(await deps.orcaWorktrees(), []).find((x) => x.path === w.path)?.id;
      if (!id) throw new Error("worktree is no longer listed with an Orca id");
      const [agents, terminals] = await Promise.all([deps.orcaAgents(), deps.orcaTerminals(id)]);
      if (!agents.ok || !terminals.ok) throw new Error(agents.stderr || terminals.stderr || "Orca session read failed");
      reviewerSessions = piSessions(id, parseAgents(agents.stdout), parseTerminals(terminals.stdout));
      if (store.openDispatches().some((d) => d.worktree === id) || reviewerSessions.some(isBusy) || reviewerSessions.some((s) => store.openDispatches().some((d) => d.sessionHandle === s.handle))) {
        once(store, ctx.now, `ask:cleanup-busy:${c.key}:${version}`, "needs-decision", { type: "needs-decision", item: c.key, version, kind: "cleanup", detail: `PR ${w.pr.state}; review worktree ${w.path} has a busy Pi session or an open dispatch. prflow will not archive it` });
        return;
      }
      if (reviewerSessions.some((s) => !store.hasLedgerRef(`prflow-launched:${s.handle}`))) {
        once(store, ctx.now, `ask:cleanup-owned:${c.key}:${version}`, "needs-decision", { type: "needs-decision", item: c.key, version, kind: "cleanup", detail: `PR ${w.pr.state}; review worktree ${w.path} has a Pi session prflow did not launch. Close or move it before archiving` });
        return;
      }
    } catch (e) {
      once(store, ctx.now, `ask:cleanup-sessions:${c.key}:${version}`, "needs-decision", { type: "needs-decision", item: c.key, version, kind: "cleanup", detail: `PR ${w.pr.state}; cannot verify sessions in review worktree ${w.path}: ${(e as Error).message}. prflow will not archive it` });
      return;
    }
  }
  // Fresh checks right before acting; unknown counts as not clean.
  const dirty = await deps.gitDirty(w.path);
  const reviewBranch = isReviewBranch(w.branch);
  const unpushed = reviewBranch ? 0 : await deps.gitUnpushed(w.path, w.pr.headSha);
  if (dirty !== 0 || unpushed !== 0) {
    const why = [
      dirty === null ? "uncommitted state unknown" : dirty ? `${dirty} uncommitted file(s)` : null,
      unpushed === null ? "unpushed commits unknown" : unpushed ? `${unpushed} unpushed commit(s)` : null,
    ].filter(Boolean);
    once(store, ctx.now, `ask:cleanup:${c.key}:${version}:${dirty}:${unpushed}`, "needs-decision", {
      type: "needs-decision",
      item: c.key,
      version,
      kind: "cleanup",
      detail: `PR ${w.pr.state}; worktree ${w.path} has ${why.join(" and ")}. prflow will not archive it; keep it or archive it by hand`,
    });
    return;
  }
  // A merged PR's local branch goes too, pinned to the commit checked above.
  let target: { gitDir: string; branch: string; sha: string } | null = null;
  let keep = "branch kept";
  if (w.pr.state === "MERGED" || (w.pr.state === "CLOSED" && reviewBranch)) {
    const info = await deps.branchInfo(w.path);
    if (info?.branch && info.branch === w.branch && safeBranch(info.branch)) target = { gitDir: info.gitDir, branch: info.branch, sha: info.sha };
    else keep = `local branch ${w.branch} kept: ${!info ? "branch state unknown" : !info.branch ? "HEAD is detached" : info.branch !== w.branch ? `worktree is on ${info.branch}` : "unusual branch name"}`;
  }
  const closeSessions = reviewerSessions.filter((s) => s.kind === "terminal" && store.hasLedgerRef(`prflow-launched:${s.handle}`));
  const command = [...closeSessions.map((s) => `orca-ide terminal close --terminal ${s.handle} --json`), `orca-ide ${archiveArgs(w.path).join(" ")}`, ...(target ? [`git ${deleteBranchArgs(target.gitDir, target.branch, target.sha).join(" ")}`] : [])].join("; ");
  if (r.dryRun) {
    const ref = `dry-run:cleanup:${c.key}:${version}`;
    if (!dryRunSlot(r, ref)) return;
    once(store, ctx.now, ref, "dry-run", { type: "dry-run", item: c.key, version, kind: "cleanup", detail: `would run: ${command}` });
    return;
  }
  await live(
    r,
    { item: c.key, version, kind: "cleanup", trigger: null, command },
    async () => {
      for (const session of closeSessions) {
        const closed = await deps.closeTerminal(session.handle);
        if (!closed.ok) return { ok: false, detail: `could not close idle reviewer ${session.handle}: ${closed.stderr.trim() || closed.stdout.trim()}` };
      }
      const res = await deps.archiveWorktree(w.path);
      if (!res.ok) return { ok: false, detail: `orca-ide worktree rm: ${res.stderr.trim() || res.stdout.trim()}` };
      if (target) {
        const del = await deps.deleteBranch(target.gitDir, target.branch, target.sha);
        keep = del.ok ? `deleted local branch ${target.branch}` : `local branch ${target.branch} kept: ${del.stderr.trim() || "git update-ref failed"}`;
      }
      return { ok: true, detail: `archived ${w.path} (PR ${w.pr.state}; ${keep})` };
    },
    "archived",
  );
}

/** The tick's action step: archive eligible worktrees. */
export function makeAct(deps: TickDeps, store: Store): Act {
  return async (ctx: TickContext, result: ScanResult, _items: Classification[], opts: TickOptions) => {
    const r: Run = { deps, store, ctx, dryRun: opts.dryRun };
    for (const w of result.worktrees) await cleanup(r, w);
  };
}

/** Settle cleanup dispatches when the archived worktree is no longer listed. */
export function makeVerify(worktreesScanned: boolean): (result: ScanResult) => Verify {
  return (result) => (d: Dispatch) => {
    if (d.kind === "cleanup" && worktreesScanned) {
      const path = d.version.slice(d.version.indexOf(":") + 1);
      if (!result.worktrees.some((w) => w.path === path)) return { state: "done", detail: `worktree ${path} is no longer listed` };
    }
    return null;
  };
}
