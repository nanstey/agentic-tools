/**
 * Unblock step of `prflow tick`: for each Orca worktree in the Blocked column,
 * read its record (written by orca-task-status, `lib/blocked.ts`), evaluate the
 * unblock conditions with read-only gh calls, and once every condition holds,
 * move the card to the state the shared PR-derived rules give
 * (`lib/task-status.ts` `prDecision`, the rules orca-task-status `end` uses),
 * with a comment saying what changed and `--unread`. Emits `unblocked`.
 *
 * A Blocked worktree with no record, or with only `manual`, is reported once
 * as `needs-decision` and never moved. Paused cards and prflow review
 * worktrees are never touched. `prflow.actions.dryRun` (or `tick --dry-run`)
 * only announces the move. Live moves go through `beginDispatch` (kind
 * `unblock`), so pauses, caps, the loop breaker, and per-version dedup apply.
 */
import { evaluate, parseConditions, type BlockedRecord, type Condition, type Facts, type OwnPrFacts } from "../../../../lib/blocked.ts";
import { checkState, prDecision, type CheckState, type Pr } from "../../../../lib/task-status.ts";
import { parsePr, parsePrRefs, prArgs } from "./adapters/gh.ts";
import { isReviewBranch, parseWorktrees, type OrcaWorktree } from "./adapters/orca.ts";
import { dryRunBlocked, dryRunSlot, once } from "./actions.ts";
import { accountFor, type Config } from "./core/config.ts";
import { leaseUntil } from "./core/rails.ts";
import type { Check, PrSnapshot } from "./core/types.ts";
import { beginDispatch, finishDispatch, type TickContext } from "./dispatch.ts";
import type { Store } from "./store.ts";
import type { TickDeps, TickOptions } from "./tick.ts";

/** Longest comment the Orca allowlist accepts (`assertTaskStatusSet`). */
const MAX_COMMENT = 200;

const clip = (s: string, n = MAX_COMMENT) => (s.length > n ? `${s.slice(0, n - 3)}...` : s);

const toCheckState = (c: Check): CheckState =>
  checkState(c.typename === "CheckRun" ? { __typename: "CheckRun", status: c.status, conclusion: c.conclusion } : { __typename: "StatusContext", state: c.state });

/** prflow's PR snapshot in the shape the shared PR-derived rules take. */
export function toPr(s: PrSnapshot): Pr {
  const state = s.state === "MERGED" || s.state === "CLOSED" ? s.state : "OPEN";
  return {
    number: s.number, state, isDraft: s.isDraft, mergedAt: null, reviewDecision: s.reviewDecision ?? "",
    mergeStateStatus: s.mergeStateStatus, headRefOid: s.headSha, checks: s.checks.map(toCheckState),
  };
}

export function ownFacts(s: PrSnapshot): OwnPrFacts {
  const pr = toPr(s);
  return {
    number: pr.number, state: pr.state, headSha: pr.headRefOid, reviewDecision: pr.reviewDecision, checks: pr.checks,
    required: s.checks.filter((c) => c.isRequired).map(toCheckState),
  };
}

/** Dispatch version of one record: a new Blocked record is new work. */
export const unblockVersion = (r: BlockedRecord): string => `blocked@${r.setAt}`;

type Read<T> = { ok: true; value: T } | { ok: false };

interface Ctx {
  deps: TickDeps;
  store: Store;
  cfg: Config;
  ctx: TickContext;
  dryRun: boolean;
}

/** The branch PR number: the record's, else Orca's link, else the newest PR on the branch (an open one first). */
async function prNumber(c: Ctx, login: string, w: OrcaWorktree, rec: BlockedRecord): Promise<Read<number | null>> {
  if (rec.pr !== null) return { ok: true, value: rec.pr };
  if (w.linkedPr !== null) return { ok: true, value: w.linkedPr };
  const r = await c.deps.gh(login, ["pr", "list", "-R", w.repo, "--head", w.branch, "--state", "all", "--limit", "10", "--json", "number,state,title,url"]);
  if (!r.ok) return { ok: false };
  const refs = parsePrRefs(r.stdout);
  if (!refs.length) return { ok: true, value: null };
  const pick = refs.filter((p) => p.state === "OPEN");
  return { ok: true, value: (pick.length ? pick : refs).reduce((a, b) => (b.number > a.number ? b : a)).number };
}

async function ownPr(c: Ctx, login: string, repo: string, n: number | null): Promise<Read<PrSnapshot | null>> {
  if (n === null) return { ok: true, value: null };
  const r = await c.deps.gh(login, prArgs(repo, n));
  if (!r.ok) return { ok: false };
  return { ok: true, value: parsePr(r.stdout, repo, n, "author", login) };
}

async function otherStates(c: Ctx, fallback: string, conditions: Condition[]): Promise<Read<Record<string, string>>> {
  const out: Record<string, string> = {};
  for (const x of conditions) {
    if (x.kind !== "pr-merged") continue;
    const login = accountFor(c.cfg, x.repo)?.login ?? fallback;
    const r = await c.deps.gh(login, ["pr", "view", String(x.number), "-R", x.repo, "--json", "state"]);
    if (!r.ok) return { ok: false };
    try {
      out[`${x.repo}#${x.number}`.toLowerCase()] = String((JSON.parse(r.stdout) as { state?: string }).state ?? "");
    } catch {
      return { ok: false };
    }
  }
  return { ok: true, value: out };
}

async function one(c: Ctx, w: OrcaWorktree, rec: BlockedRecord | undefined): Promise<void> {
  const { deps, store, cfg, ctx } = c;
  const account = accountFor(cfg, w.repo);
  if (!account) return;
  const fallbackItem = `${w.repo}@${w.branch}`;
  if (!rec || rec.path !== w.path) {
    once(store, ctx.now, `ask:blocked-no-record:${w.id}`, "needs-decision", {
      type: "needs-decision", item: w.linkedPr !== null ? `${w.repo}#${w.linkedPr}` : fallbackItem, version: "no-record", kind: "unblock",
      detail: `blocked with no unblock condition: ${w.path}. Set one (orca-task-status set blocked --reason <why> --until <condition>) or move the card by hand`,
    });
    return;
  }
  const conditions = parseConditions(rec.conditions);
  const version = unblockVersion(rec);
  const prKey = (n: number | null) => (n !== null ? `${rec.repo ?? w.repo}#${n}` : fallbackItem);
  if (conditions.every((x) => x.kind === "manual")) {
    once(store, ctx.now, `ask:blocked-manual:${w.id}:${rec.setAt}`, "needs-decision", {
      type: "needs-decision", item: prKey(rec.pr ?? w.linkedPr), version, kind: "unblock",
      detail: `blocked with no unblock condition (manual): ${rec.reason}. ${w.path} waits for you`,
    });
    return;
  }
  // Facts, read-only. A failed read skips this worktree until the next tick.
  const num = await prNumber(c, account.login, w, rec);
  if (!num.ok) return;
  const repo = rec.repo ?? w.repo;
  const snap = await ownPr(c, account.login, repo, num.value);
  if (!snap.ok) return;
  const others = await otherStates(c, account.login, conditions);
  if (!others.ok) return;
  const facts: Facts = { pr: snap.value ? ownFacts(snap.value) : null, others: others.value };
  const item = prKey(num.value);
  const ev = evaluate(conditions, facts);
  if (ev.stuck) {
    once(store, ctx.now, `ask:blocked-stuck:${w.id}:${rec.setAt}:${ev.stuck}`, "needs-decision", {
      type: "needs-decision", item, version, kind: "unblock", detail: `blocked on a condition that can no longer hold: ${ev.stuck}. ${w.path} needs a new condition or a person`,
    });
    return;
  }
  if (!ev.holds) return;

  // Target state: the same PR-derived rules orca-task-status `end` uses.
  const [dirty, head] = await Promise.all([deps.gitDirty(w.path), deps.worktreeHead(w.path)]);
  const decision = prDecision(snap.value ? toPr(snap.value) : null, { dirty: dirty !== 0, head: head ?? "" });
  const status = cfg.taskStatuses[decision.state];
  if (!status || status === cfg.taskStatuses.blocked) {
    once(store, ctx.now, `ask:blocked-status:${w.id}:${rec.setAt}:${decision.state}`, "needs-decision", {
      type: "needs-decision", item, version, kind: "unblock",
      detail: `${w.path} can leave Blocked (${ev.met.join("; ")}) but taskStatus.statuses.${decision.state} is not configured; move it by hand`,
    });
    return;
  }
  const comment = clip(`unblocked: ${ev.met.join("; ")}`);
  const detail = `${w.path}: blocked -> ${decision.state} (${decision.reason}); ${comment}`;
  if (c.dryRun) {
    if (dryRunBlocked(store, item, version, "unblock", null)) return;
    const ref = `dry-run:unblock:${w.id}:${version}`;
    if (!dryRunSlot(c, ref)) return;
    once(store, ctx.now, ref, "dry-run", { type: "dry-run", item, version, kind: "unblock", detail: `would move ${detail}` });
    return;
  }
  const start = beginDispatch(store, ctx, { item, version, kind: "unblock", event: { type: "dispatched", detail: `move ${detail}` } });
  if (!start.ok) return;
  const d = store.transition(start.dispatch.id, "launched", ctx.now, { leaseUntil: leaseUntil(ctx.rails, ctx.now), detail: w.id });
  const evt = { item: d.item, version: d.version, kind: d.kind, dispatchId: d.id };
  // Fresh check right before the write: someone may have moved the card meanwhile.
  let still = false;
  try {
    still = parseWorktrees(await deps.orcaWorktrees(), []).some((x) => x.id === w.id && x.workspaceStatus === cfg.taskStatuses.blocked);
  } catch (e) {
    finishDispatch(store, deps.now(), d, "failed", `orca-ide worktree list: ${(e as Error).message}`);
    store.appendEvent(deps.now(), { ...evt, type: "action-failed", detail: clip(`orca-ide worktree list: ${(e as Error).message}`, 300) });
    return;
  }
  if (!still) {
    finishDispatch(store, deps.now(), d, "done", `${w.path} already left Blocked`);
    return;
  }
  const res = await deps.setTaskStatus(w.id, status, comment);
  const now = deps.now();
  if (!res.ok) {
    const why = `orca-ide worktree set: ${res.stderr.trim() || res.stdout.trim()}`;
    finishDispatch(store, now, d, "failed", why);
    store.appendEvent(now, { ...evt, type: "action-failed", detail: clip(why, 300) });
    return;
  }
  deps.clearBlocked(w.id, rec.setAt);
  finishDispatch(store, now, d, "done", detail);
  store.appendEvent(now, { ...evt, type: "unblocked", detail });
}

/** The tick's unblock step. Runs only when worktrees are scanned and a Blocked status id is configured. */
export function makeUnblock(deps: TickDeps, store: Store, cfg: Config) {
  return async (ctx: TickContext, opts: TickOptions): Promise<void> => {
    const blocked = cfg.taskStatuses.blocked;
    if (!cfg.worktrees || !blocked || blocked === cfg.taskStatuses.paused) return;
    const rows = parseWorktrees(await deps.orcaWorktrees(), []).filter((w) => w.id && w.workspaceStatus === blocked && !isReviewBranch(w.branch));
    if (!rows.length) return;
    let records: Record<string, BlockedRecord>;
    try {
      records = deps.readBlocked().records;
    } catch (e) {
      once(store, ctx.now, `ask:blocked-file:${(e as Error).message}`, "needs-decision", {
        type: "needs-decision", item: "blocked records", version: "unreadable", kind: "unblock",
        detail: `cannot read the blocked records (${(e as Error).message}); Blocked worktrees stay put until it is fixed`,
      });
      return;
    }
    const c: Ctx = { deps, store, cfg, ctx, dryRun: opts.dryRun };
    for (const w of rows) await one(c, w, records[w.id]);
  };
}
