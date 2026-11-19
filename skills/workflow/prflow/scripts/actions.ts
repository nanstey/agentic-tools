/**
 * Safe actions for `prflow tick`: `rerun` (gh run rerun --failed) and `cleanup`
 * (archive a clean Orca worktree of a merged or closed PR, and delete a merged
 * PR's local branch).
 *
 * Live actions go through `beginDispatch`, which writes the dispatch row, a
 * `started` ledger row, and a `dispatched` event before the side effect. The
 * outcome then moves the row to `done` or `failed` with a `rerun`, `archived`,
 * or `action-failed` event. A crash in between leaves an open row that the next
 * tick reconciles (`verify`) or marks stale when its lease runs out.
 *
 * Dry runs make the same read-only checks and announce each action once per
 * item version as a `dry-run` event, without writing a dispatch.
 */
import { rerunArgs, runViewArgs } from "./adapters/gh.ts";
import { deleteBranchArgs, safeBranch } from "./adapters/git.ts";
import { archiveArgs } from "./adapters/orca.ts";
import { classifyWorktree, summarizeChecks } from "./core/classify.ts";
import { leaseUntil } from "./core/rails.ts";
import type { Classification, Kind, PrSnapshot, WorktreeItem } from "./core/types.ts";
import { beginDispatch, finishDispatch, legacyHandled, pauseItem, type TickContext } from "./dispatch.ts";
import type { ScanResult } from "./scan.ts";
import type { Dispatch, Store } from "./store.ts";
import type { Act, TickDeps, TickOptions, Verify } from "./tick.ts";

const RUN_URL = /^https:\/\/github\.com\/([^/]+\/[^/]+)\/actions\/runs\/(\d+)(?:\/|$)/;

/** Workflow run ids behind the PR's cancelled or failed GitHub Actions check runs. */
export function rerunTargets(pr: PrSnapshot): { runIds: string[]; unknown: string[] } {
  const runIds = new Set<string>();
  const unknown: string[] = [];
  for (const c of pr.checks) {
    if (c.typename !== "CheckRun" || c.status !== "COMPLETED") continue;
    if (c.conclusion === "SUCCESS" || c.conclusion === "SKIPPED" || c.conclusion === "NEUTRAL") continue;
    const m = RUN_URL.exec(c.url ?? "");
    if (m?.[2] && m[1]?.toLowerCase() === pr.repo.toLowerCase()) runIds.add(m[2]);
    else unknown.push(c.name);
  }
  return { runIds: [...runIds].sort(), unknown };
}

const short = (s: string, n = 300) => (s.length > n ? `${s.slice(0, n)}...` : s);

/** Ledger-backed "say it once": emit `event` only the first time `ref` is seen. */
function once(store: Store, now: number, ref: string, outcome: string, ev: { type: "needs-decision" | "dry-run"; item: string; version: string; kind: Kind; detail: string }): void {
  if (store.addLedger({ at: now, item: ev.item, version: ev.version, kind: ev.kind, outcome, detail: ev.detail, source: "prflow", ref }))
    store.appendEvent(now, ev);
}

/** Why a dry run would not act, mirroring the checks `beginDispatch` makes before the rails. */
function dryRunBlocked(store: Store, item: string, version: string, kind: Kind, trigger: string | null): string | null {
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
  req: { item: string; version: string; kind: Kind; trigger: string | null; command: string },
  effect: () => Promise<{ ok: boolean; detail: string }>,
  success: "rerun" | "archived",
): Promise<void> {
  const { store, ctx } = r;
  const start = beginDispatch(store, ctx, { item: req.item, version: req.version, kind: req.kind, trigger: req.trigger, event: { type: "dispatched", detail: req.command } });
  if (!start.ok) return;
  const d = store.transition(start.dispatch.id, "launched", ctx.now, { leaseUntil: leaseUntil(ctx.rails, ctx.now) });
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
function dryRunSlot(r: Run, ref: string): boolean {
  if (r.store.hasLedgerRef(ref)) return false;
  if (r.ctx.starts >= r.ctx.rails.startsPerTick) return false;
  r.ctx.starts++;
  return true;
}

/**
 * Dispatch version for the next rerun of `version`: the first rerun uses the
 * item version itself, later ones `<version>~r<n>`. `null` once
 * `rerunsPerVersion` reruns are done (the checks were cancelled again each time).
 */
export function nextRerunVersion(store: Store, item: string, version: string, limit: number): string | null {
  for (let n = 1; n <= limit; n++) {
    const v = n === 1 ? version : `${version}~r${n}`;
    if (store.findDispatch(item, v, "rerun")?.state !== "done") return v;
  }
  return null;
}

async function rerun(r: Run, c: Classification, pr: PrSnapshot): Promise<void> {
  const { deps, store, ctx } = r;
  const trigger = c.triggers.find((t) => t.kind === "rerun")?.detail ?? null;
  // Never while any check is still running.
  if (summarizeChecks(pr.checks).pending) return;
  const limit = ctx.rails.rerunsPerVersion;
  const version = nextRerunVersion(store, c.key, c.version, limit);
  if (version === null) {
    // Cancelled again after every allowed rerun: pause once per version and ask.
    if (r.dryRun || store.systemPaused() !== null || store.item(c.key)?.paused) return;
    const ref = `rerun-limit:${c.key}:${c.version}`;
    if (store.addLedger({ at: ctx.now, item: c.key, version: c.version, kind: "rerun", outcome: "abandoned", detail: `${limit} reruns`, source: "prflow", ref }))
      pauseItem(store, ctx.now, c.key, `checks cancelled again after ${limit} reruns at this version; rerun by hand or push a fix, then \`prflow resume --item ${c.key}\``, { version: c.version, kind: "rerun" });
    return;
  }
  if (dryRunBlocked(store, c.key, version, "rerun", trigger)) return;
  const { runIds, unknown } = rerunTargets(pr);
  if (runIds.length === 0) {
    once(store, ctx.now, `ask:rerun:${c.key}:${c.version}`, "needs-decision", {
      type: "needs-decision",
      item: c.key,
      version: c.version,
      kind: "rerun",
      detail: `cancelled checks have no GitHub Actions run prflow can rerun (${unknown.join(", ")}); rerun them by hand`,
    });
    return;
  }
  // Re-check each run: GitHub must report it completed.
  for (const id of runIds) {
    const v = await deps.gh(c.account, runViewArgs(c.repo, id));
    if (!v.ok) return;
    let status: string | undefined;
    try {
      status = (JSON.parse(v.stdout) as { status?: string }).status;
    } catch {
      return;
    }
    if (status !== "completed") return;
  }
  const command = runIds.map((id) => `gh ${rerunArgs(c.repo, id).join(" ")}`).join("; ");
  if (r.dryRun) {
    const ref = `dry-run:rerun:${c.key}:${version}`;
    if (!dryRunSlot(r, ref)) return;
    once(store, ctx.now, ref, "dry-run", { type: "dry-run", item: c.key, version, kind: "rerun", detail: `would run: ${command}` });
    return;
  }
  await live(
    r,
    { item: c.key, version, kind: "rerun", trigger, command },
    async () => {
      const failed: string[] = [];
      for (const id of runIds) {
        const res = await deps.rerunFailed(c.account, c.repo, id);
        if (!res.ok) failed.push(`run ${id}: ${res.stderr.trim()}`);
      }
      return failed.length ? { ok: false, detail: failed.join("; ") } : { ok: true, detail: `reran failed and cancelled jobs in run ${runIds.join(", ")}` };
    },
    "rerun",
  );
}

/** Dispatch version for a cleanup: PR state plus the worktree path (one PR may have several). */
export const cleanupVersion = (c: Classification, w: WorktreeItem): string => `${c.version}:${w.path}`;

async function cleanup(r: Run, w: WorktreeItem): Promise<void> {
  const { deps, store, ctx } = r;
  const c = classifyWorktree(w);
  if (!c || (w.pr.state !== "MERGED" && w.pr.state !== "CLOSED")) return;
  const version = cleanupVersion(c, w);
  if (dryRunBlocked(store, c.key, version, "cleanup", null)) return;
  // Fresh checks right before acting; unknown counts as not clean.
  const dirty = await deps.gitDirty(w.path);
  const unpushed = await deps.gitUnpushed(w.path, w.pr.headSha);
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
  if (w.pr.state === "MERGED") {
    const info = await deps.branchInfo(w.path);
    if (info?.branch && info.branch === w.branch && safeBranch(info.branch)) target = { gitDir: info.gitDir, branch: info.branch, sha: info.sha };
    else keep = `local branch ${w.branch} kept: ${!info ? "branch state unknown" : !info.branch ? "HEAD is detached" : info.branch !== w.branch ? `worktree is on ${info.branch}` : "unusual branch name"}`;
  }
  const command = [`orca-ide ${archiveArgs(w.path).join(" ")}`, ...(target ? [`git ${deleteBranchArgs(target.gitDir, target.branch, target.sha).join(" ")}`] : [])].join("; ");
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

/** The tick's action step: reruns first, then worktree cleanups. */
export function makeAct(deps: TickDeps, store: Store): Act {
  return async (ctx: TickContext, result: ScanResult, items: Classification[], opts: TickOptions) => {
    const r: Run = { deps, store, ctx, dryRun: opts.dryRun };
    const prs = new Map(result.prs.map((p) => [`${p.repo}#${p.number}`, p]));
    for (const c of items) {
      const pr = prs.get(c.key);
      if (c.kind === "rerun" && pr && pr.role === "author") await rerun(r, c, pr);
    }
    for (const w of result.worktrees) await cleanup(r, w);
  };
}

/**
 * Settle open rerun and cleanup dispatches left by an interrupted tick:
 * a rerun is done when the same head has checks running again; a cleanup is
 * done when its worktree is no longer listed (only when worktrees were scanned).
 */
export function makeVerify(worktreesScanned: boolean): (result: ScanResult) => Verify {
  return (result) => (d: Dispatch) => {
    if (d.kind === "rerun") {
      const pr = result.prs.find((p) => `${p.repo}#${p.number}`.toLowerCase() === d.item.toLowerCase());
      if (pr && pr.headSha.slice(0, 8) === d.version.slice(0, 8) && summarizeChecks(pr.checks).pending)
        return { state: "done", detail: "checks are running again on the same head" };
      return null;
    }
    if (d.kind === "cleanup" && worktreesScanned) {
      const path = d.version.slice(d.version.indexOf(":") + 1);
      if (!result.worktrees.some((w) => w.path === path)) return { state: "done", detail: `worktree ${path} is no longer listed` };
    }
    return null;
  };
}
