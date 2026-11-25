/**
 * Worktree status step of `prflow tick`: set each development worktree's Orca
 * board column from its sessions and PR (`core/worktree-status.ts`).
 *
 * Skipped: the main checkout, review worktrees (`isReviewWorktree`, which the
 * review flow keeps in its own columns), cards in Blocked or Paused, repos no
 * account covers, repos in `prflow.worktreeStatus.ignore` or the shared
 * `orchestrator.ignore`, and items paused with `prflow pause --item`. A card
 * is written only when its column changes, by status id only (its comment and
 * unread flag stay), and each move emits one `worktree-status` event.
 * `prflow.worktreeStatus.dryRun` (default true) or `tick --dry-run` only
 * announces each move once as a `dry-run` event.
 */
import { isReviewWorktree, parseAgents, parseWorktrees, type AgentRow, type OrcaWorktree } from "./adapters/orca.ts";
import { once } from "./actions.ts";
import { accountFor, type Config } from "./core/config.ts";
import { isIgnored, worktreeColumn, type Column } from "./core/worktree-status.ts";
import type { PrSnapshot } from "../../../../lib/pr/types.ts";
import type { TickContext } from "./dispatch.ts";
import type { ScanResult } from "./scan.ts";
import type { Dispatch, Store } from "./store.ts";
import type { TickDeps, TickOptions } from "./tick.ts";

/** Meta keys: the last announced dry-run move and the last failed target, per worktree id. */
const DRY_KEY = (id: string) => `worktree_status_dry:${id}`;
const FAIL_KEY = (id: string) => `worktree_status_fail:${id}`;

const clip = (s: string, n = 300) => (s.length > n ? `${s.slice(0, n - 3)}...` : s);

/** Main checkout folder name per Orca repo id, for ignore-list matching. */
function mainFolders(json: string): Map<string, string> {
  const out = new Map<string, string>();
  const rows = (JSON.parse(json) as { result?: { worktrees?: { repoId?: string; path?: string; isMainWorktree?: boolean }[] } }).result?.worktrees ?? [];
  for (const r of rows) if (r.isMainWorktree && r.repoId && r.path) out.set(r.repoId, r.path.split("/").filter(Boolean).at(-1) ?? "");
  return out;
}

/** The busy session or open prflow dispatch in this worktree, described; `null` when none. */
export function runningIn(w: OrcaWorktree, agents: AgentRow[], open: Dispatch[]): string | null {
  const a = agents.find((x) => x.worktreeId === w.id && x.state === "working");
  if (a) return `${a.agent || "agent"} ${a.kind || "session"} working`;
  const d = open.find((x) => x.worktree === w.id);
  if (d) return `prflow ${d.kind} dispatch #${d.id} ${d.state}`;
  return null;
}

/** The scanned open PR of this worktree: the linked one, else the one on its branch. */
export function openPrFor(w: OrcaWorktree, prs: PrSnapshot[]): PrSnapshot | null {
  const inRepo = prs.filter((p) => p.repo.toLowerCase() === w.repo && p.state === "OPEN");
  const hits = w.linkedPr !== null ? inRepo.filter((p) => p.number === w.linkedPr) : inRepo.filter((p) => p.branch === w.branch);
  return hits.find((p) => p.role === "author") ?? hits[0] ?? null;
}

/** The tick's worktree status step. Runs only when worktrees are scanned. */
export function makeWorktreeStatus(deps: TickDeps, store: Store, cfg: Config) {
  const name = (id: string | null | undefined): string => {
    if (!id) return "none";
    const state = Object.entries(cfg.taskStatuses).find(([, v]) => v === id)?.[0];
    return state ?? id;
  };
  return async (ctx: TickContext, result: ScanResult, opts: TickOptions): Promise<void> => {
    if (!cfg.worktrees) return;
    const dryRun = opts.worktreeStatusDryRun ?? true;
    const { blocked, paused } = cfg.taskStatuses;
    // Fresh reads: earlier steps this tick may have moved cards or started sessions.
    let raw: string;
    let rows: OrcaWorktree[];
    let agents: AgentRow[];
    try {
      raw = await deps.orcaWorktrees();
      rows = parseWorktrees(raw, []);
      const r = await deps.orcaAgents();
      if (!r.ok) return; // Without the agent list, running sessions are unknown: move nothing.
      agents = parseAgents(r.stdout);
    } catch {
      return;
    }
    const folders = mainFolders(raw);
    const open = store.openDispatches().filter((d) => d.worktree !== null);
    for (const w of rows) {
      const from = w.workspaceStatus ?? null;
      if (!w.id || isReviewWorktree(w.branch, w.path.split("/").filter(Boolean).at(-1) ?? "")) continue;
      if (from !== null && (from === blocked || from === paused)) continue;
      if (!accountFor(cfg, w.repo)) continue;
      const repoId = w.id.split("::")[0] ?? "";
      if (isIgnored(cfg.worktreeStatus.ignore, [w.repo, w.repo.split("/")[1] ?? "", folders.get(repoId) ?? ""])) continue;
      const pr = openPrFor(w, result.prs);
      const gone = result.worktrees.find((x) => x.path === w.path)?.pr ?? null;
      const item = pr ? `${pr.repo}#${pr.number}` : gone ? `${w.repo}#${gone.number}` : `${w.repo}@${w.branch}`;
      if (store.item(item)?.paused) continue;
      const decision = worktreeColumn(runningIn(w, agents, open), pr, gone);
      if (!decision) continue;
      const status = cfg.taskStatuses[decision.state];
      if (!status) {
        once(store, ctx.now, `ask:worktree-status-unconfigured:${decision.state}`, "needs-decision", {
          type: "needs-decision", item, version: decision.state, kind: "worktree-status",
          detail: `taskStatus.statuses.${decision.state} is not configured; prflow cannot move worktrees to ${decision.state}`,
        });
        continue;
      }
      if (status === from) {
        if (store.getMeta(DRY_KEY(w.id))) store.setMeta(DRY_KEY(w.id), "");
        continue;
      }
      await move(w, item, from, status, decision.state, decision.reason);
    }

    async function move(w: OrcaWorktree, item: string, from: string | null, status: string, state: Column, reason: string): Promise<void> {
      const detail = `${w.path}: ${name(from)} -> ${state} (${reason})`;
      const change = `${from ?? ""}>${status}`;
      if (dryRun) {
        if (store.getMeta(DRY_KEY(w.id)) === change) return;
        store.setMeta(DRY_KEY(w.id), change);
        store.appendEvent(ctx.now, { type: "dry-run", item, version: state, kind: "worktree-status", detail: `would move ${detail}` });
        return;
      }
      // A refused call (the guard throws) is reported like a failed one; the tick goes on.
      const res = await deps.setWorktreeStatus(w.id, w.branch, status).catch((e: unknown) => ({ ok: false, stdout: "", stderr: (e as Error).message }));
      const now = deps.now();
      if (!res.ok) {
        // One failure event per target; the next tick retries quietly.
        if (store.getMeta(FAIL_KEY(w.id)) === status) return;
        store.setMeta(FAIL_KEY(w.id), status);
        store.appendEvent(now, { type: "action-failed", item, version: state, kind: "worktree-status", detail: clip(`orca-ide worktree set ${w.path}: ${res.stderr.trim() || res.stdout.trim()}`) });
        return;
      }
      if (store.getMeta(FAIL_KEY(w.id))) store.setMeta(FAIL_KEY(w.id), "");
      store.appendEvent(now, { type: "worktree-status", item, version: state, kind: "worktree-status", detail });
    }
  };
}
