/**
 * Pi dispatch for `ci`, `comments`, and `behind`, with session monitoring and
 * recovery.
 *
 * Act (after reconcile), per own PR whose kind needs code work:
 * 1. Find its Orca worktree (linked PR, else head branch). None: ask the user
 *    (`needs-decision`); prflow never creates one.
 * 2. Read the worktree's Pi sessions. Any busy one (working, blocked, waiting,
 *    or of unknown state): leave the dispatch `planned` and retry next tick.
 *    After `busyWaitMinutes`, a lone busy Pi terminal is interrupted (Escape)
 *    and gets the brief in the same session, asked first for an immediate update.
 * 3. Otherwise message the idle Pi session with `orchestration send`, or launch
 *    a fresh Pi with the brief. A retry after an idle or closed session closes
 *    it and launches fresh; a retry after a session that stayed busy
 *    interrupts and reuses it. Both carry what the attempt left behind.
 * The dispatch row and an event are written before every side effect.
 *
 * Monitor (before reconcile), per open agent dispatch:
 * - Adopt the session of an orphaned `launched` row (crash after launch).
 * - Renew the lease while the session shows new activity.
 * - Done when the session is idle (or gone) and the PR moved on (new head,
 *   new feedback version, trigger gone, or PR no longer listed):
 *   `session-finished` with the session's last message.
 * - Recovery ladder: idle with the work unfinished -> one nudge; idle again,
 *   closed, still busy `busyWaitMinutes` after the brief, or lease expired -> `stale`;
 *   the next tick retries with a fresh session; after `maxAttempts` the
 *   dispatch is abandoned and the item paused (`beginDispatch`).
 *
 * Dispatch dry run (default) makes the same reads and announces the exact
 * brief and target once per item version as a `dry-run` event.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { briefArgs, jobLogArgs, parseBriefFacts } from "./adapters/gh.ts";
import { isBusy, matchWorktree, parseAgents, parseLaunch, parseSend, parseTerminals, parseWaitIdle, parseWorktrees, piSessions, type AgentRow, type OrcaWorktree, type PiSession, type TerminalRow } from "./adapters/orca.ts";
import { dryRunBlocked, dryRunSlot, once } from "./actions.ts";
import {
  behindDetails,
  BRIEF_KINDS,
  ciDetails,
  feedbackItems,
  logExcerpt,
  otherTriggersText,
  parseTemplate,
  previousText,
  projectContextText,
  render,
  type BriefKind,
  type FailedJob,
  type Template,
} from "./core/brief.ts";
import { summarizeChecks } from "./core/classify.ts";
import { checkState } from "../../../../lib/pr-state.ts";
import { projectFor, type Config } from "./core/config.ts";
import { leaseExpired, leaseUntil, MINUTE_MS } from "./core/rails.ts";
import type { Classification, Kind, PrSnapshot } from "./core/types.ts";
import { beginDispatch, finishDispatch, type TickContext } from "./dispatch.ts";
import type { ScanResult } from "./scan.ts";
import type { Dispatch, Store } from "./store.ts";
import type { Act, Monitor, TickDeps, TickOptions } from "./tick.ts";

export const AGENT_KINDS: readonly Kind[] = ["ci", "comments", "behind"];
export const isAgentKind = (k: string): boolean => (AGENT_KINDS as readonly string[]).includes(k);

export type Templates = Record<BriefKind, Template>;

/** How the monitor judges one open dispatch. */
export interface MonitorRules {
  /** Why the work is finished (the dispatch is done once its session is idle or gone), or `null`. */
  moved: string | null;
  /** Text for the one nudge to an idle session with the work unfinished; `null` sends none. */
  nudge: () => string | null;
  /**
   * Mark a briefed session that is still busy `busyWaitMinutes` after the brief
   * stale. Off for reviewers, which may work long; the lease still applies.
   */
  busyLimit: boolean;
}

/** Read and check every brief template under `dir` (`templates/briefs`). */
export function loadTemplates(dir: string): Templates {
  const out = {} as Templates;
  for (const k of BRIEF_KINDS) out[k] = parseTemplate(k, readFileSync(join(dir, `${k}.md`), "utf8"));
  return out;
}

/** Truncation for messages carried in events. */
const MESSAGE_CHARS = 500;
export const short = (s: string | null, n = MESSAGE_CHARS) => {
  const t = (s ?? "").replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n - 3)}...` : t;
};
const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/** Per-tick cache of Orca reads. Read failures throw and fail the tick. */
export class OrcaView {
  private wts?: OrcaWorktree[];
  private agents?: AgentRow[];
  private terms = new Map<string, TerminalRow[]>();
  private deps: TickDeps;
  constructor(deps: TickDeps) {
    this.deps = deps;
  }

  private raw?: string;

  async worktrees(): Promise<OrcaWorktree[]> {
    return (this.wts ??= parseWorktrees(await this.rawWorktrees(), []));
  }

  /** `worktree list --json` text, for lookups the parsed rows drop (main worktrees). */
  async rawWorktrees(): Promise<string> {
    return (this.raw ??= await this.deps.orcaWorktrees());
  }

  /** Forget the worktree list after creating a worktree. */
  invalidateWorktrees(): void {
    this.wts = undefined;
    this.raw = undefined;
  }

  async sessions(worktreeId: string): Promise<PiSession[]> {
    if (!this.agents) {
      const r = await this.deps.orcaAgents();
      if (!r.ok) throw new Error(`orca-ide agent list: ${r.stderr.trim()}`);
      this.agents = parseAgents(r.stdout);
    }
    let t = this.terms.get(worktreeId);
    if (!t) {
      const r = await this.deps.orcaTerminals(worktreeId);
      if (!r.ok) throw new Error(`orca-ide terminal list: ${r.stderr.trim()}`);
      t = parseTerminals(r.stdout);
      this.terms.set(worktreeId, t);
    }
    return piSessions(worktreeId, this.agents, t);
  }

  /** Forget reads made stale by a side effect. */
  invalidate(worktreeId: string): void {
    this.agents = undefined;
    this.terms.delete(worktreeId);
  }
}

/** What prflow will do for a dispatch. */
type Target =
  | { do: "wait"; why: string }
  /** `restart`: why the session restarts; the brief is wrapped in the restart template. */
  | { do: "message"; session: PiSession; restart: string | null }
  /** Escape the busy session, wait for its prompt, then send the restart brief. */
  | { do: "interrupt"; session: PiSession; restart: string }
  | { do: "launch"; close: PiSession | null };

function describe(t: Target, wt: OrcaWorktree): string {
  if (t.do === "wait") return `wait: ${t.why}`;
  if (t.do === "message")
    return t.restart
      ? `message Pi session ${t.session.handle} in ${wt.path} to restart it, asking for an immediate update first (${t.restart})`
      : `message idle Pi session ${t.session.handle} in ${wt.path} with orchestration send`;
  if (t.do === "interrupt")
    return `interrupt Pi session ${t.session.handle} in ${wt.path} with Escape, then restart it with the brief, asking for an immediate update first (${t.restart})`;
  return `${t.close ? `close ${t.close.handle}, then ` : ""}launch a fresh Pi session in ${wt.path}`;
}

export interface TargetOptions {
  /** Reuse `prior` (it stayed busy past the limit) instead of closing it. */
  reuse?: boolean;
  /** How long this dispatch has waited on busy sessions. */
  waitedMs?: number;
  /** `busyWaitMinutes` in ms; after it a lone busy Pi terminal is interrupted. */
  busyWaitMs?: number;
}

/**
 * Pick the target. `prior` is the session of an earlier attempt: closed and
 * replaced, or, with `reuse`, interrupted if busy and restarted in place. Any
 * other busy Pi session blocks the start until `busyWaitMs`, then a lone busy
 * Pi terminal is interrupted and restarted with the brief.
 */
export function chooseTarget(sessions: PiSession[], prior: string | null, o: TargetOptions = {}): Target {
  const waited = o.waitedMs ?? 0;
  const limit = o.busyWaitMs ?? Number.POSITIVE_INFINITY;
  const limitText = `${Math.round(limit / MINUTE_MS)}m`;
  const old = prior ? (sessions.find((s) => s.handle === prior) ?? null) : null;
  const others = sessions.filter((s) => s.handle !== prior);
  const busy = others.filter(isBusy).sort((a, b) => (b.lastActivityAt ?? 0) - (a.lastActivityAt ?? 0));
  const first = busy[0];
  if (first) {
    const why = `Pi session ${first.handle} is ${first.state}`;
    if (waited < limit) return { do: "wait", why };
    if (busy.length > 1) return { do: "wait", why: `${busy.length} Pi sessions are busy; prflow interrupts only a lone busy session` };
    if (first.kind !== "terminal") return { do: "wait", why: `${why}, a chat prflow cannot interrupt` };
    if (old) return { do: "wait", why: `${why}, and the earlier session ${old.handle} is still open` };
    return { do: "interrupt", session: first, restart: `this session was ${first.state} for ${Math.round(waited / MINUTE_MS)}m (limit ${limitText}) while a brief waited, so prflow stopped its turn` };
  }
  if (old && old.kind !== "terminal") return { do: "wait", why: `earlier session ${old.handle} is a chat prflow cannot ${o.reuse ? "interrupt" : "close"}` };
  // A busy session is never closed: wait, then interrupt and restart it in place.
  if (!o.reuse && old && isBusy(old)) {
    if (waited < limit) return { do: "wait", why: `earlier session ${old.handle} is ${old.state} again` };
    return { do: "interrupt", session: old, restart: `this session was ${old.state} for ${Math.round(waited / MINUTE_MS)}m (limit ${limitText}) while a retry waited, so prflow stopped its turn` };
  }
  if (o.reuse && old)
    return isBusy(old)
      ? { do: "interrupt", session: old, restart: `the previous attempt was still ${old.state} after the ${limitText} limit, so prflow stopped its turn` }
      : { do: "message", session: old, restart: `the previous attempt ran past the ${limitText} limit` };
  if (prior) return { do: "launch", close: old };
  const idle = others.filter((s) => s.state === "done").sort((a, b) => (b.lastActivityAt ?? 0) - (a.lastActivityAt ?? 0))[0];
  return idle ? { do: "message", session: idle, restart: null } : { do: "launch", close: null };
}

/**
 * Whether the PR moved on from what the dispatch was for: no longer listed
 * (closed or merged), a new version, or the trigger is gone. Drafts have no
 * triggers, but an open dispatch remains active while a PR is drafted.
 */
export function settled(d: Dispatch, item: Classification | undefined): string | null {
  if (!item) return "the PR is no longer open";
  if (item.version.slice(0, 8) !== d.version.slice(0, 8)) return `new head ${item.version.slice(0, 8)}`;
  if (item.version !== d.version) return "new feedback or replies on the same head";
  if (!item.isDraft && !item.triggers.some((t) => t.kind === d.kind)) return `${d.kind} no longer applies`;
  return null;
}

export interface Ctx {
  deps: TickDeps;
  store: Store;
  cfg: Config;
  templates: Templates;
  view: OrcaView;
  ctx: TickContext;
  dryRun: boolean;
}

export function ev(d: Dispatch) {
  return { item: d.item, version: d.version, kind: d.kind, dispatchId: d.id };
}

// ---- briefs ----

const JOB_URL = /^https:\/\/github\.com\/([^/]+\/[^/]+)\/actions\/runs\/\d+\/job\/(\d+)/;

async function failedJobs(c: Ctx, item: Classification, pr: PrSnapshot): Promise<FailedJob[]> {
  const jobs: FailedJob[] = [];
  for (const k of pr.checks) {
    const state = checkState(k as unknown as Record<string, unknown>);
    if (state !== "fail" && state !== "cancelled") continue;
    const m = JOB_URL.exec(k.url ?? "");
    const cancelled = state === "cancelled";
    let cause = "no GitHub Actions log; open the URL";
    if (!cancelled && m?.[2] && same(m[1] ?? "", pr.repo) && jobs.length < 5) {
      const r = await c.deps.gh(item.account, jobLogArgs(pr.repo, m[2]));
      cause = r.ok ? logExcerpt(r.stdout) || "the failed steps' log is empty" : `log unavailable: ${short(r.stderr, 200)}`;
    }
    jobs.push({ name: k.name, url: k.url, cause, ...(cancelled ? { cancelled: true } : {}) });
  }
  return jobs;
}

async function buildBrief(c: Ctx, item: Classification, pr: PrSnapshot, wt: OrcaWorktree, prior: Dispatch | null): Promise<string> {
  const kind = item.kind as "ci" | "comments" | "behind";
  const r = await c.deps.gh(item.account, briefArgs(pr.repo, pr.number));
  if (!r.ok) throw new Error(`${item.key}: brief facts: ${r.stderr.trim()}`);
  const facts = parseBriefFacts(r.stdout);
  if (!facts) throw new Error(`${item.key}: brief facts: PR not found`);
  let details: string;
  if (kind === "comments") {
    const items = feedbackItems(facts, pr.headCommittedDate, item.account);
    details = items.length ? items.join("\n\n") : "(prflow found no comment text; read the PR's conversation and review threads.)";
  } else if (kind === "ci") {
    const jobs = await failedJobs(c, item, pr);
    details = jobs.length ? ciDetails(jobs) : "(prflow found no failed check; read the PR's checks.)";
  } else details = behindDetails(pr.mergeStateStatus, facts.baseRef);
  const others = item.triggers.map((t) => (t.kind === "merge" ? "mergeable" : t.kind)).filter((k) => k !== kind && k !== "mergeable");
  const attempt = prior ? prior.attempts + 1 : 1;
  return render(c.templates[kind], {
    repo: pr.repo,
    number: String(pr.number),
    pr_url: pr.url,
    title: pr.title,
    branch: facts.headRef,
    base: facts.baseRef,
    head: pr.headSha.slice(0, 12),
    worktree: wt.path,
    project_context: projectContextText(projectFor(c.cfg.dispatch, pr.repo)),
    details,
    other_triggers: otherTriggersText(others),
    previous: previousText(attempt, prior?.detail ?? null, prior?.lastMessage ?? null),
  });
}

function nudgeText(c: Ctx, d: Dispatch, item: Classification, pr: PrSnapshot | undefined): string {
  const [repo, number] = d.item.split("#");
  return render(c.templates.nudge, {
    repo: repo ?? d.item,
    number: number ?? "",
    kind: d.kind,
    pr_url: item.url,
    state: item.status,
    branch: pr?.branch ?? "the PR branch",
  });
}

function restartText(c: Ctx, d: Dispatch, reason: string, brief: string): string {
  const [repo, number] = d.item.split("#");
  return render(c.templates.restart, { repo: repo ?? d.item, number: number ?? "", reason, brief: brief.trimEnd() });
}

const subject = (d: { item: string; kind: string }) => `prflow: ${d.kind} on ${d.item}`;

// ---- side effects ----

/**
 * Deliver a brief for a `planned` dispatch: move it to `launched` with the
 * lease and target first, then close/launch/message. Failure -> `failed`.
 */
export async function deliver(c: Ctx, d: Dispatch, wt: OrcaWorktree, target: Exclude<Target, { do: "wait" }>, brief: string): Promise<void> {
  const { store, deps } = c;
  const now = c.ctx.now;
  const handle = target.do === "message" || target.do === "interrupt" ? target.session.handle : null;
  const known = (await c.view.sessions(wt.id)).map((x) => x.handle).join(" ");
  let cur = store.transition(d.id, "launched", now, { leaseUntil: leaseUntil(c.ctx.rails, now), sessionHandle: handle, detail: describe(target, wt) });
  // An interrupt that fails is retried on the same session, never by closing it.
  const restartHandle = target.do === "interrupt" ? target.session.handle : null;
  cur = store.patchDispatch(d.id, { worktree: wt.id, sentAt: now, seenAt: null, nudgedAt: null, brief, lastMessage: null, knownSessions: known, waitSince: null, restartHandle }, now);
  const fail = (why: string) => {
    const t = deps.now();
    finishDispatch(store, t, store.dispatch(d.id) as Dispatch, "failed", why);
    store.appendEvent(t, { ...ev(cur), type: "action-failed", sessionHandle: handle, detail: short(why, 300) });
  };
  try {
    if (target.do === "interrupt") {
      const h = target.session.handle;
      store.appendEvent(now, { ...ev(cur), type: "interrupted", sessionHandle: h, detail: `${target.restart}; last message: ${short(target.session.lastMessage) || "(none)"}` });
      const i = await deps.interruptTerminal(h);
      if (!i.ok) return fail(`orca-ide terminal send Escape ${h}: ${i.stderr.trim() || i.stdout.trim()}`);
      const wr = await deps.waitIdle(h);
      if (!wr.ok || !parseWaitIdle(wr.stdout)) return fail(`Pi session ${h} did not show its prompt within 30s of Escape; not sending the brief`);
    }
    if (target.do === "message" || target.do === "interrupt") {
      const body = target.restart ? restartText(c, d, target.restart, brief) : brief;
      const r = await deps.sendToAgent(target.session.handle, subject(d), body);
      if (!r.ok) return fail(`orca-ide orchestration send: ${r.stderr.trim() || r.stdout.trim()}`);
      parseSend(r.stdout);
      store.upsertSession({ handle: target.session.handle, item: d.item, dispatchId: d.id, at: now, lastOutputAt: target.session.lastActivityAt, state: target.session.state });
      return;
    }
    if (target.close) {
      const r = await deps.closeTerminal(target.close.handle);
      if (!r.ok) return fail(`orca-ide terminal close ${target.close.handle}: ${r.stderr.trim() || r.stdout.trim()}; not launching a second session`);
    }
    const r = await deps.launchPi(wt.id, brief);
    if (!r.ok) return fail(`orca-ide agent launch: ${r.stderr.trim() || r.stdout.trim()}`);
    const l = parseLaunch(r.stdout);
    store.addLedger({ at: now, item: d.item, version: d.version, kind: d.kind, outcome: "launched", detail: wt.path, dispatchId: d.id, source: "prflow", ref: `prflow-launched:${l.handle}` });
    store.patchDispatch(d.id, { sessionHandle: l.handle, detail: `launched ${l.handle} in ${wt.path} (${l.detail})` }, now);
    store.upsertSession({ handle: l.handle, item: d.item, dispatchId: d.id, at: now, lastOutputAt: null, state: "launched" });
    if (!l.promptDelivered) store.appendEvent(deps.now(), { ...ev(cur), type: "needs-decision", sessionHandle: l.handle, detail: `Orca launched ${l.handle} but could not confirm the brief reached it (${l.detail}); prflow keeps watching` });
  } catch (e) {
    fail((e as Error).message);
  } finally {
    c.view.invalidate(wt.id);
  }
}

// ---- act ----

async function dispatchItem(c: Ctx, item: Classification, pr: PrSnapshot): Promise<void> {
  const { store, ctx } = c;
  const key = item.key;
  const kind = item.kind;
  const trigger = item.triggers.find((t) => t.kind === kind)?.detail ?? null;
  // One agent dispatch per item at a time; an older one must settle first.
  const open = store.openDispatches().filter((d) => same(d.item, key) && isAgentKind(d.kind));
  const mine = open.find((d) => d.version === item.version && d.kind === kind);
  if (open.some((d) => d !== mine)) return;
  if (mine && mine.state !== "planned") return;

  const existing = mine ?? store.findDispatch(key, item.version, kind);
  if (c.dryRun) {
    if (dryRunBlocked(store, key, item.version, kind, trigger)) return;
  } else if (!mine) {
    if (store.systemPaused() !== null || store.item(key)?.paused) return;
    if (existing && (existing.state === "done" || existing.state === "abandoned")) return;
    // Out of attempts: let beginDispatch abandon it and pause the item.
    if (existing && existing.attempts >= ctx.rails.maxAttempts) {
      beginDispatch(store, ctx, { item: key, version: item.version, kind, trigger, event: { type: "dispatched" } });
      return;
    }
  }

  const wts = await c.view.worktrees();
  const m = matchWorktree(wts, pr.repo, pr.number, pr.branch ?? null);
  if (!m.ok) {
    once(store, ctx.now, `ask:agent:${key}:${item.version}:${kind}`, "needs-decision", {
      type: "needs-decision",
      item: key,
      version: item.version,
      kind,
      detail: `${kind} needs a Pi session, but ${m.reason}. prflow does not create worktrees; create one for the PR or handle it by hand`,
    });
    return;
  }
  const wt = m.worktree;
  const prior = existing && (existing.state === "failed" || existing.state === "stale") ? existing : null;
  // A retry replaces (or, after a busy attempt, reuses) the earlier attempt's
  // session; a planned retry keeps its handle until delivered.
  const ref = mine ?? prior;
  const busyWaitMs = ctx.rails.busyWaitMinutes * MINUTE_MS;
  const target = chooseTarget(await c.view.sessions(wt.id), ref?.restartHandle ?? ref?.sessionHandle ?? null, {
    reuse: !!ref?.restartHandle,
    waitedMs: mine?.waitSince != null ? ctx.now - mine.waitSince : 0,
    busyWaitMs,
  });
  // A waiting dispatch gets past the busy wait plus one lease before it is stale.
  const waitLease = (since: number) => since + busyWaitMs + ctx.rails.leaseMinutes * MINUTE_MS;

  if (mine) {
    // Planned earlier and deferred (busy session): retry delivery with the stored brief.
    if (target.do === "wait" && mine.waitSince === null && !c.dryRun) store.patchDispatch(mine.id, { waitSince: ctx.now, leaseUntil: waitLease(ctx.now) }, ctx.now);
    if (target.do === "wait" || c.dryRun || store.item(key)?.paused) return;
    store.appendEvent(ctx.now, { ...ev(mine), type: "dispatched", detail: `${describe(target, wt)} (was waiting)` });
    await deliver(c, mine, wt, target, mine.brief ?? (await buildBrief(c, item, pr, wt, null)));
    return;
  }

  if (c.dryRun) {
    if (target.do === "wait") return; // Announced once it would really go.
    const ref = `dry-run:agent:${key}:${item.version}:${kind}`;
    if (!dryRunSlot(c, ref)) return;
    const brief = await buildBrief(c, item, pr, wt, prior);
    once(store, ctx.now, ref, "dry-run", {
      type: "dry-run",
      item: key,
      version: item.version,
      kind,
      detail: `would ${describe(target, wt)}; brief ${c.templates[kind as BriefKind].id}:\n${brief.trimEnd()}`,
    });
    return;
  }

  const brief = await buildBrief(c, item, pr, wt, prior);
  const plan = target.do === "wait" ? `planned; ${describe(target, wt)}` : describe(target, wt);
  const start = beginDispatch(store, ctx, {
    item: key,
    version: item.version,
    kind,
    trigger,
    event: { type: "dispatched", detail: `brief ${c.templates[kind as BriefKind].id}: ${plan}` },
  });
  if (!start.ok) return;
  const d = store.patchDispatch(start.dispatch.id, target.do === "wait" ? { worktree: wt.id, brief, detail: plan, waitSince: ctx.now, leaseUntil: waitLease(ctx.now) } : { worktree: wt.id, brief, detail: plan }, ctx.now);
  if (target.do === "wait") return;
  await deliver(c, d, wt, target, brief);
}

// ---- monitor ----

export async function monitorOne(c: Ctx, d: Dispatch, rules: MonitorRules): Promise<void> {
  const { store, ctx } = c;
  const now = ctx.now;
  const { rails } = ctx;
  const stale = (why: string, handle: string | null, last: string | null, restartHandle: string | null = null) => {
    store.patchDispatch(d.id, { lastMessage: last, restartHandle }, now);
    finishDispatch(store, now, store.dispatch(d.id) as Dispatch, "stale", why);
    store.appendEvent(now, { ...ev(d), type: "session-stale", sessionHandle: handle, detail: last ? `${why}; last message: ${short(last)}` : why });
  };
  const done = (why: string, s: PiSession | null) => {
    if (d.state === "planned") return;
    store.patchDispatch(d.id, { lastMessage: s?.lastMessage ?? null }, now);
    finishDispatch(store, now, store.dispatch(d.id) as Dispatch, "done", why);
    store.appendEvent(now, { ...ev(d), type: "session-finished", sessionHandle: s?.handle ?? d.sessionHandle, detail: `${why}; last message: ${short(s?.lastMessage ?? null) || "(none)"}` });
  };

  if (d.state === "planned") {
    // Waiting on a busy session; act interrupts it after busyWaitMinutes. Give up one lease later.
    if (leaseExpired(rails, d, now)) stale(`could not deliver the brief within ${Math.round((now - (d.waitSince ?? d.updatedAt)) / MINUTE_MS)}m: a busy Pi session in the worktree could not be interrupted`, null, null, d.restartHandle);
    return;
  }
  if (!d.worktree) return;
  const sessions = await c.view.sessions(d.worktree);
  const since = d.sentAt ?? d.updatedAt;

  // Orphan: launched, but the launch reply was never recorded. Adopt the Pi
  // terminal that was not there before the launch (else one active since);
  // otherwise the lease decides.
  if (!d.sessionHandle) {
    const known = new Set((d.knownSessions ?? "").split(" ").filter(Boolean));
    const terms = sessions.filter((s) => s.kind === "terminal");
    const isNew = d.knownSessions !== null ? terms.filter((s) => !known.has(s.handle)) : terms.filter((s) => (s.lastActivityAt ?? 0) >= since);
    const fresh = isNew.sort((a, b) => (b.lastActivityAt ?? 0) - (a.lastActivityAt ?? 0))[0];
    if (!fresh) return;
    d = store.patchDispatch(d.id, { sessionHandle: fresh.handle }, now);
    store.appendEvent(now, { ...ev(d), type: "recovered", sessionHandle: fresh.handle, detail: `adopted orphaned session ${fresh.handle}` });
  }

  const s = sessions.find((x) => x.handle === d.sessionHandle);
  const moved = rules.moved;
  if (!s) {
    if (moved) done(`${moved}; session ${d.sessionHandle} is gone`, null);
    else stale(`session ${d.sessionHandle} closed with the work unfinished`, d.sessionHandle, d.lastMessage);
    return;
  }
  const activity = s.lastActivityAt ?? 0;
  const progressed = activity > (d.seenAt ?? since);
  if (progressed) {
    if (d.state === "launched" && (s.state === "working" || activity > since)) d = store.transition(d.id, "working", now);
    d = store.patchDispatch(d.id, { seenAt: activity, leaseUntil: leaseUntil(rails, now), lastMessage: s.lastMessage ?? d.lastMessage }, now);
    store.upsertSession({ handle: s.handle, item: d.item, dispatchId: d.id, at: now, lastOutputAt: s.lastActivityAt, state: s.state });
  }

  // Settled work with no Orca agent status: `unknown` is not proof of work, and
  // the Pi TUI's own output would otherwise renew the lease every tick.
  if (moved && s.state === "unknown") return done(moved, s);
  if (isBusy(s)) {
    const busyFor = now - since;
    // An unknown state with no activity is not proof of work; the lease decides.
    if (rules.busyLimit && busyFor >= rails.busyWaitMinutes * MINUTE_MS && (s.state !== "unknown" || activity > since)) {
      if (moved) done(`${moved}; session still ${s.state} after ${Math.round(busyFor / MINUTE_MS)}m`, s);
      // The retry interrupts this session and restarts it in place.
      else stale(`still ${s.state} ${Math.round(busyFor / MINUTE_MS)}m after the brief (limit ${rails.busyWaitMinutes}m)`, s.handle, s.lastMessage, s.kind === "terminal" ? s.handle : null);
    }
    return;
  }

  // Idle. Not yet picked up the brief: the lease decides.
  if (activity <= since) return;
  if (moved) return done(moved, s);
  if (d.nudgedAt === null) {
    const text = rules.nudge();
    if (c.dryRun || text === null) return;
    // Ladder step 1: one nudge. Row and event first.
    d = store.patchDispatch(d.id, { nudgedAt: now, leaseUntil: leaseUntil(rails, now) }, now);
    store.appendEvent(now, { ...ev(d), type: "nudged", sessionHandle: s.handle, detail: `idle with ${d.kind} unfinished; last message: ${short(s.lastMessage) || "(none)"}` });
    const r = await c.deps.sendToAgent(s.handle, subject(d), text);
    c.view.invalidate(d.worktree ?? "");
    if (!r.ok) stale(`nudge failed: ${r.stderr.trim() || r.stdout.trim()}`, s.handle, s.lastMessage);
    return;
  }
  if (activity > d.nudgedAt) stale("idle again after a nudge with the work unfinished", s.handle, s.lastMessage);
}

/** The agent flow's monitor (before reconcile) and act (after the safe actions). */
export function makeAgentFlow(deps: TickDeps, store: Store, cfg: Config, templates: Templates): { monitor: Monitor; act: Act } {
  let view = new OrcaView(deps);
  const index = (result: ScanResult, items: Classification[]) => ({
    items: new Map(items.filter((i) => i.role === "author").map((i) => [i.key.toLowerCase(), i])),
    prs: new Map(result.prs.filter((p) => p.role === "author").map((p) => [`${p.repo}#${p.number}`.toLowerCase(), p])),
  });
  const ctxOf = (ctx: TickContext, opts: TickOptions): Ctx => ({ deps, store, cfg, templates, view, ctx, dryRun: opts.dispatchDryRun ?? true });
  return {
    async monitor(ctx, result, items, opts) {
      view = new OrcaView(deps);
      const open = store.openDispatches().filter((d) => isAgentKind(d.kind));
      if (!open.length) return;
      const ix = index(result, items);
      const c = ctxOf(ctx, opts);
      for (const d of open) {
        const item = ix.items.get(d.item.toLowerCase());
        const pr = ix.prs.get(d.item.toLowerCase());
        await monitorOne(c, d, { moved: settled(d, item), nudge: () => (item ? nudgeText(c, d, item, pr) : null), busyLimit: true });
      }
    },
    async act(ctx, result, items, opts) {
      const ix = index(result, items);
      const c = ctxOf(ctx, opts);
      for (const item of items) {
        if (item.role !== "author" || !isAgentKind(item.kind)) continue;
        const pr = ix.prs.get(item.key.toLowerCase());
        // CI and behind briefs wait for running checks to finish.
        if (!pr || (item.kind !== "comments" && summarizeChecks(pr.checks).pending)) continue;
        await dispatchItem(c, item, pr);
      }
    },
  };
}
