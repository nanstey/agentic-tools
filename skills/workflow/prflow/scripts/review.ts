/**
 * Review flow for `review-requested`: one persistent Orca worktree per PR,
 * with reviewer dispatches versioned per head. The reviewer writes a DRAFT under the
 * state directory and posts nothing; `prflow review post` (never tick) is the
 * only way a draft reaches GitHub.
 *
 * Act (after the agent flow), per PR where the account is a requested
 * reviewer, not draft, required checks finished, head not yet reviewed:
 * 1. Dedupe on (item, head8, kind); one reviewer per PR at a time, a newer head
 *    waits for the older reviewer to settle. At most `review.maxConcurrent`
 *    reviewers are open; the usual caps and loop breaker apply (`beginDispatch`).
 * 2. Create the review worktree (`orca-ide worktree create`, the only worktree
 *    prflow creates), record `meta.json` beside the draft, then launch Pi with
 *    the review brief (`templates/briefs/review.md`). Row and event first.
 *
 * Monitor (before reconcile): the agent monitor with review rules. Done once a
 * parseable draft is saved (or the review is no longer requested) and the
 * session is idle or gone; one nudge when idle without a draft; stale when the
 * session closes, idles again, or the lease runs out; retried until
 * `maxAttempts`, then abandoned and the item paused.
 *
 * Reap (after monitor): emit `review-drafted`; keep the worktree while the PR
 * is open. Close only idle prflow-launched terminal sessions after the idle
 * threshold. Cleanup archives after PR close/merge only when clean, no session
 * is busy or open, and every Pi session is prflow-launched.
 *
 * Review dry run (`review.dryRun`, default true) makes the same reads and
 * announces the exact target and brief once per head as a `dry-run` event.
 */
import { existsSync, mkdirSync, readdirSync, renameSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { readOrNull } from "../../../../lib/runtime.ts";
import { briefArgs, parseBriefFacts } from "./adapters/gh.ts";
import { safeBranch } from "./adapters/git.ts";
import {
  findReviewWorktree,
  isBusy,
  isReviewBranch,
  parseCreatedWorktree,
  repoIdFor,
  reviewBranch,
  reviewSlug,
  reviewWorktreeArgs,
  reviewWorktreeName,
  type OrcaWorktree,
} from "./adapters/orca.ts";
import { dryRunBlocked, dryRunSlot, once } from "./actions.ts";
import { chooseTarget, deliver, ev, monitorOne, OrcaView, short, type Ctx, type Templates } from "./agents.ts";
import { approvalsText, earlierDraftText, previousText, render, reviewProjectContextText } from "./core/brief.ts";
import { otherApprovals } from "./core/classify.ts";
import { projectFor, type Config } from "./core/config.ts";
import { draftFolder, draftId, draftSummary, parseDraft, type Draft, type DraftMeta } from "./core/draft.ts";
import { MINUTE_MS, OPEN_STATES } from "./core/rails.ts";
import type { Classification, PrSnapshot } from "./core/types.ts";
import { beginDispatch, finishDispatch } from "./dispatch.ts";
import { fetchReviewPr, type ScanResult } from "./scan.ts";
import type { Dispatch, Store } from "./store.ts";
import type { Act, Annotate, Monitor, TickDeps, TickOptions } from "./tick.ts";

export const REVIEW_KIND = "review-requested";

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

// ---- drafts on disk ----

export interface DraftPaths {
  id: string;
  dir: string;
  file: string;
  meta: string;
}

export function draftPaths(stateDir: string, repo: string, number: number, head8: string): DraftPaths {
  const dir = join(stateDir, "drafts", draftFolder(repo, number), head8);
  return { id: draftId(repo, number, head8), dir, file: join(dir, "review.md"), meta: join(dir, "meta.json") };
}

/** Paths of the draft a review dispatch is for. */
export function pathsOf(stateDir: string, d: Pick<Dispatch, "item" | "version">): DraftPaths {
  const [repo, n] = d.item.split("#");
  return draftPaths(stateDir, repo ?? "", Number(n), d.version);
}

export interface LoadedDraft {
  paths: DraftPaths;
  text: string | null;
  draft: Draft | null;
  meta: DraftMeta | null;
  /** Saved and parseable, so it can be shown and posted. */
  ok: boolean;
}

export function loadDraft(paths: DraftPaths): LoadedDraft {
  const text = readOrNull(paths.file);
  const draft = text === null ? null : parseDraft(text);
  const rawMeta = readOrNull(paths.meta);
  let meta: DraftMeta | null = null;
  try {
    meta = rawMeta === null ? null : (JSON.parse(rawMeta) as DraftMeta);
  } catch {
    meta = null;
  }
  return { paths, text, draft, meta, ok: draft !== null && draft.errors.length === 0 };
}

function writeAtomic(path: string, text: string): void {
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, text);
  renameSync(tmp, path);
}

export function writeMeta(paths: DraftPaths, meta: DraftMeta): void {
  mkdirSync(paths.dir, { recursive: true });
  writeAtomic(paths.meta, `${JSON.stringify(meta, null, 2)}\n`);
}

/** The newest saved draft of the same PR for another head, for a delta review. */
export function earlierDraft(paths: DraftPaths): { head8: string; file: string } | null {
  const parent = join(paths.dir, "..");
  let best: { head8: string; file: string; at: number } | null = null;
  let names: string[] = [];
  try {
    names = readdirSync(parent);
  } catch {
    return null;
  }
  for (const h of names) {
    const file = join(parent, h, "review.md");
    if (!/^[0-9a-f]{8}$/.test(h) || file === paths.file || !existsSync(file)) continue;
    const at = statSync(file).mtimeMs;
    if (!best || at > best.at) best = { head8: h, file, at };
  }
  return best ? { head8: best.head8, file: best.file } : null;
}

// ---- flow ----

const head8 = (c: Classification) => c.version.slice(0, 8);

/** Target text for a review dispatch. */
function describeReview(target: ReturnType<typeof chooseTarget>, wt: OrcaWorktree | null, slug: string, repo: string, repoId: string | null, number: number, sha: string): string {
  if (target.do === "wait") return `wait: ${target.why}`;
  if (!wt) return `create Orca worktree ${reviewWorktreeName(slug)} on branch ${reviewBranch(slug)} (orca-ide ${reviewWorktreeArgs(repoId ?? "<repo id>", slug, number).join(" ")}) for ${repo}, then fetch origin pull/${number}/head, reset --hard ${sha}, verify HEAD, and launch a fresh Pi reviewer there`;
  if (target.do === "launch") return `git -C ${wt.path} fetch origin pull/${number}/head; git -C ${wt.path} reset --hard ${sha}; git -C ${wt.path} rev-parse HEAD; ${target.close ? `close ${target.close.handle}, then ` : ""}launch a fresh Pi reviewer in ${wt.path}`;
  if (target.do === "message") return `git -C ${wt.path} fetch origin pull/${number}/head; git -C ${wt.path} reset --hard ${sha}; git -C ${wt.path} rev-parse HEAD; message Pi session ${target.session.handle} in ${wt.path}${target.restart ? ` to restart it (${target.restart})` : ""}`;
  return `git -C ${wt.path} fetch origin pull/${number}/head; git -C ${wt.path} reset --hard ${sha}; git -C ${wt.path} rev-parse HEAD; interrupt Pi session ${target.session.handle} in ${wt.path}, then restart it (${target.restart})`;
}

async function buildReviewBrief(c: Ctx, item: Classification, pr: PrSnapshot, slug: string, paths: DraftPaths, prior: Dispatch | null): Promise<string> {
  const r = await c.deps.gh(item.account, briefArgs(pr.repo, pr.number));
  if (!r.ok) throw new Error(`${item.key}: brief facts: ${r.stderr.trim()}`);
  const facts = parseBriefFacts(r.stdout);
  if (!facts) throw new Error(`${item.key}: brief facts: PR not found`);
  const earlier = earlierDraft(paths);
  const attempt = prior ? prior.attempts + 1 : 1;
  return render(c.templates.review, {
    repo: pr.repo,
    number: String(pr.number),
    pr_url: pr.url,
    title: pr.title,
    branch: facts.headRef,
    base: facts.baseRef,
    head: pr.headSha,
    head_short: pr.headSha.slice(0, 8),
    account: item.account,
    worktree_name: reviewWorktreeName(slug),
    review_branch: reviewBranch(slug),
    draft_path: paths.file,
    draft_dir: paths.dir,
    approvals: approvalsText(otherApprovals(pr, item.account)),
    project_context: reviewProjectContextText(projectFor(c.cfg.dispatch, pr.repo)),
    earlier: earlierDraftText(earlier?.head8 ?? null, earlier?.file ?? null, item.account),
    previous: previousText(attempt, prior?.detail ?? null, prior?.lastMessage ?? null),
    status_changes: c.cfg.review.statuses.changes,
    status_approved: c.cfg.review.statuses.approved,
    status_reviewing: c.cfg.review.statuses.reviewing,
  });
}

interface ReviewCtx extends Ctx {
  /** Review dry-run announcements made in this tick (they count against `maxConcurrent`). */
  announced: { n: number };
}

function fail(c: Ctx, d: Dispatch, why: string): void {
  const t = c.deps.now();
  finishDispatch(c.store, t, c.store.dispatch(d.id) as Dispatch, "failed", why);
  c.store.appendEvent(t, { ...ev(d), type: "action-failed", detail: short(why, 300) });
}

/** Create the worktree if needed, then launch (or message) the reviewer. The row is `planned`. */
async function startReviewer(c: ReviewCtx, d: Dispatch, item: Classification, pr: PrSnapshot, wt: OrcaWorktree | null, repoId: string | null, slug: string, target: Exclude<ReturnType<typeof chooseTarget>, { do: "wait" }>, brief: string, paths: DraftPaths): Promise<void> {
  if (!wt) {
    if (!repoId) return fail(c, d, "no Orca repo id for the review worktree");
    let r;
    try {
      r = await c.deps.createReviewWorktree(repoId, slug, pr.number);
    } catch (e) {
      return fail(c, d, `orca-ide worktree create: ${(e as Error).message}`);
    } finally {
      c.view.invalidateWorktrees();
    }
    if (!r.ok) return fail(c, d, `orca-ide worktree create: ${r.stderr.trim() || r.stdout.trim()}`);
    let created: { id: string; path: string } | null = null;
    try {
      created = parseCreatedWorktree(r.stdout);
    } catch (e) {
      return fail(c, d, (e as Error).message);
    }
    wt = findReviewWorktree(await c.view.worktrees(), pr.repo, pr.number, slug) ?? (created ? { id: created.id, path: created.path, branch: reviewBranch(slug), repo: pr.repo.toLowerCase(), linkedPr: pr.number } : null);
    if (!wt) return fail(c, d, `Orca created ${reviewWorktreeName(slug)} but did not report or list it; the next attempt looks for it by branch`);
    d = c.store.patchDispatch(d.id, { worktree: wt.id }, c.ctx.now);
  }
  if (!isReviewBranch(wt.branch)) return fail(c, d, `refusing to reset non-review branch ${wt.branch}`);
  const sessions = await c.view.sessions(wt.id);
  if (sessions.some(isBusy)) return;
  const dirty = await c.deps.gitDirty(wt.path);
  if (dirty !== 0) {
    once(c.store, c.ctx.now, `ask:review-dirty:${d.item}:${d.version}`, "needs-decision", { type: "needs-decision", item: d.item, version: d.version, kind: REVIEW_KIND, detail: `review worktree ${wt.path} is ${dirty === null ? "unknown" : `${dirty} file(s) dirty`}; prflow will not reset it` });
    return;
  }
  const fetch = await c.deps.reviewFetch(wt.path, pr.number, wt.branch);
  if (!fetch.ok) return fail(c, d, `git fetch pull/${pr.number}/head: ${fetch.stderr.trim() || fetch.stdout.trim()}`);
  const head = await c.deps.reviewHead(wt.path);
  if (head !== pr.headSha) {
    const reset = await c.deps.reviewReset(wt.path, pr.headSha, wt.branch);
    if (!reset.ok) return fail(c, d, `git reset --hard ${pr.headSha}: ${reset.stderr.trim() || reset.stdout.trim()}`);
    if (await c.deps.reviewHead(wt.path) !== pr.headSha) return fail(c, d, `git rev-parse HEAD did not match ${pr.headSha}`);
  }
  await deliver(c, d, wt, target, brief);
  const after = c.store.dispatch(d.id);
  if (after && after.state === "launched" && after.sessionHandle)
    c.store.appendEvent(c.deps.now(), { ...ev(after), type: "review-started", sessionHandle: after.sessionHandle, detail: `reviewer ${after.sessionHandle} in ${wt.path} (Orca worktree ${reviewWorktreeName(slug)}); draft ${paths.id} goes to ${paths.file}${item.lowPriority ? "; low priority" : ""}` });
}

async function dispatchReview(c: ReviewCtx, item: Classification, pr: PrSnapshot): Promise<void> {
  const { store, ctx } = c;
  const key = item.key;
  const version = head8(item);
  const kind = REVIEW_KIND;
  // One reviewer per PR at a time; a newer head waits for the older one to settle.
  const open = store.openDispatches().filter((d) => same(d.item, key) && d.kind === kind);
  const mine = open.find((d) => d.version === version);
  if (open.some((d) => d !== mine)) return;
  if (mine && mine.state !== "planned") return;

  const existing = mine ?? store.findDispatch(key, version, kind);
  if (c.dryRun) {
    if (dryRunBlocked(store, key, version, kind, null)) return;
  } else if (!mine) {
    if (store.systemPaused() !== null || store.item(key)?.paused) return;
    if (existing && (existing.state === "done" || existing.state === "abandoned")) return;
    if (existing && existing.attempts >= ctx.rails.maxAttempts) {
      beginDispatch(store, ctx, { item: key, version, kind, trigger: null, event: { type: "dispatched" } });
      return;
    }
  }
  {
    // Waiting (planned) rows do not hold a slot, so a waiting row checks the cap again before it starts.
    const running = store.dispatchesOfKind(kind, OPEN_STATES).filter((d) => d.state !== "planned" && d.id !== mine?.id).length + c.announced.n;
    if (running >= c.cfg.review.maxConcurrent) {
      const metaKey = `cap-announced:reviewMaxConcurrent:${ctx.tickId}`;
      if (!c.dryRun && store.getMeta(metaKey) === null) {
        store.setMeta(metaKey, String(ctx.now));
        store.appendEvent(ctx.now, { type: "rail-tripped", detail: `cap review.maxConcurrent=${c.cfg.review.maxConcurrent} reached; further reviewers wait` });
      }
      return;
    }
  }

  const slug = reviewSlug(pr.repo, pr.number, version);
  const paths = draftPaths(store.dir, pr.repo, pr.number, version);
  const wt = findReviewWorktree(await c.view.worktrees(), pr.repo, pr.number, slug);
  let repoId: string | null = null;
  if (!wt) {
    repoId = repoIdFor(await c.view.rawWorktrees(), pr.repo)?.id ?? null;
    if (!repoId) {
      once(store, ctx.now, `ask:review:${key}:${version}`, "needs-decision", {
        type: "needs-decision",
        item: key,
        version,
        kind,
        detail: `the review needs its own worktree, but Orca has no single clone of ${pr.repo} to create it from. Add the repo to Orca (orca-ide repo add) or review it by hand; prflow does not add repos`,
      });
      return;
    }
  }
  const prior = existing && (existing.state === "failed" || existing.state === "stale") ? existing : null;
  const ref = mine ?? prior;
  const busyWaitMs = ctx.rails.busyWaitMinutes * MINUTE_MS;
  let target = wt
    ? chooseTarget(await c.view.sessions(wt.id), ref?.restartHandle ?? ref?.sessionHandle ?? null, {
        reuse: !!ref?.restartHandle,
        waitedMs: mine?.waitSince != null ? ctx.now - mine.waitSince : 0,
        busyWaitMs,
      })
    : ({ do: "launch", close: null } as const);
  if (target.do === "launch" && target.close && !store.hasLedgerRef(`prflow-launched:${target.close.handle}`))
    target = { do: "message", session: target.close, restart: null };
  if (wt && target.do === "message" && !target.restart) {
    const reusable = target.session;
    const used = store.dispatchesOfKind(REVIEW_KIND, ["done"]).filter((x) => x.sessionHandle === reusable.handle && store.hasLedgerRef(`prflow-launched:${reusable.handle}`) && (() => { const saved = loadDraft(pathsOf(store.dir, x)); return saved.ok && !!saved.draft; })()).length;
    if (used >= c.cfg.review.sessionReviews && reusable.kind === "terminal") target = { do: "launch", close: reusable };
  }
  const waitLease = (since: number) => since + busyWaitMs + ctx.rails.leaseMinutes * MINUTE_MS;
  const plan = describeReview(target, wt, slug, pr.repo, repoId, pr.number, pr.headSha);

  if (mine) {
    if (target.do === "wait" && mine.waitSince === null && !c.dryRun) store.patchDispatch(mine.id, { waitSince: ctx.now, leaseUntil: waitLease(ctx.now) }, ctx.now);
    if (target.do === "wait" || c.dryRun || store.item(key)?.paused) return;
    const resumeRef = `review-resumed:${mine.id}:${mine.waitSince ?? "initial"}`;
    if (store.addLedger({ at: ctx.now, item: mine.item, version: mine.version, kind: mine.kind, outcome: "resumed", detail: plan, source: "prflow", ref: resumeRef }))
      store.appendEvent(ctx.now, { ...ev(mine), type: "dispatched", detail: `${plan} (was waiting)` });
    // A crash may have come between the row and meta.json; write it before any side effect.
    writeMeta(paths, metaOf(paths, item, pr, mine.id, ctx.now));
    await startReviewer(c, mine, item, pr, wt, repoId, slug, target, mine.brief ?? (await buildReviewBrief(c, item, pr, slug, paths, null)), paths);
    return;
  }

  if (c.dryRun) {
    if (target.do === "wait") return;
    const dref = `dry-run:review:${key}:${version}`;
    if (!dryRunSlot(c, dref)) return;
    c.announced.n++;
    const brief = await buildReviewBrief(c, item, pr, slug, paths, prior);
    once(store, ctx.now, dref, "dry-run", {
      type: "dry-run",
      item: key,
      version,
      kind,
      detail: `would ${plan}; draft ${paths.id} to ${paths.file}${item.lowPriority ? "; low priority" : ""}; brief ${c.templates.review.id}:\n${brief.trimEnd()}`,
    });
    return;
  }

  const brief = await buildReviewBrief(c, item, pr, slug, paths, prior);
  const start = beginDispatch(store, ctx, {
    item: key,
    version,
    kind,
    trigger: null,
    event: { type: "dispatched", detail: `brief ${c.templates.review.id}: ${target.do === "wait" ? `planned; ${plan}` : plan}` },
  });
  if (!start.ok) return;
  const d = store.patchDispatch(
    start.dispatch.id,
    target.do === "wait" ? { worktree: wt?.id ?? null, brief, detail: plan, waitSince: ctx.now, leaseUntil: waitLease(ctx.now) } : { worktree: wt?.id ?? null, brief, detail: plan },
    ctx.now,
  );
  writeMeta(paths, metaOf(paths, item, pr, d.id, ctx.now));
  if (target.do === "wait") return;
  await startReviewer(c, d, item, pr, wt, repoId, slug, target, brief, paths);
}

function metaOf(paths: DraftPaths, item: Classification, pr: PrSnapshot, dispatchId: number, now: number): DraftMeta {
  return { id: paths.id, item: item.key, repo: pr.repo, number: pr.number, url: pr.url, title: pr.title, headSha: pr.headSha, account: item.account, dispatchId, createdAt: new Date(now).toISOString() };
}

/** Why a reviewer dispatch is finished, or `null` while its draft is still due. */
export function reviewFinished(d: Dispatch, item: Classification | undefined, draft: LoadedDraft): string | null {
  if (draft.ok && draft.draft) return `draft saved (${draftSummary(draft.paths.id, draft.draft, draft.paths.file)})`;
  if (!item) return "the review is no longer requested (PR closed, merged, back to draft, or request removed)";
  if (item.kind === "waiting" && !/required checks pending/.test(item.status)) return `the review is no longer needed (${item.status.split(";")[0]})`;
  return null;
}

function nudgeText(c: Ctx, d: Dispatch, item: Classification | undefined, draft: LoadedDraft): string {
  const [repo, number] = d.item.split("#");
  const problem = draft.text === null ? "" : `: it does not parse (${draft.draft?.errors.join("; ") ?? "unreadable"})`;
  return render(c.templates["review-nudge"], {
    repo: repo ?? d.item,
    number: number ?? "",
    head_short: d.version,
    pr_url: item?.url ?? `https://github.com/${repo}/pull/${number}`,
    draft_path: draft.paths.file,
    draft_problem: problem,
  });
}

/** Emit `review-drafted` once when a parseable draft appears. */
async function reap(c: ReviewCtx): Promise<void> {
  const { store, deps, ctx } = c;
  for (const d of store.dispatchesOfKind(REVIEW_KIND, ["done"])) {
    if (store.hasLedgerRef(`review-reaped:${d.id}`)) continue;
    const draft = loadDraft(pathsOf(store.dir, d));
    if (draft.ok && draft.draft && store.addLedger({ at: ctx.now, item: d.item, version: d.version, kind: d.kind, outcome: "drafted", detail: draft.paths.id, dispatchId: d.id, source: "prflow", ref: `review-drafted:${d.id}` }))
      store.appendEvent(ctx.now, { ...ev(d), type: "review-drafted", sessionHandle: d.sessionHandle, detail: draftSummary(draft.paths.id, draft.draft, draft.paths.file) });
    // The PR's review worktree persists until the PR closes or merges.

  }
  const completed = store.dispatchesOfKind(REVIEW_KIND, ["done", "failed", "stale", "abandoned"]);
  for (const wt of await c.view.worktrees()) {
    if (!isReviewBranch(wt.branch)) continue;
    const launched = new Set(completed.filter((d) => d.worktree === wt.id && d.sessionHandle && store.hasLedgerRef(`prflow-launched:${d.sessionHandle}`)).map((d) => d.sessionHandle as string));
    for (const session of await c.view.sessions(wt.id)) {
      if (session.kind !== "terminal" || !launched.has(session.handle) || store.openDispatches().some((d) => d.sessionHandle === session.handle) || isBusy(session) || session.lastActivityAt === null) continue;
      const age = ctx.now - session.lastActivityAt;
      if (age < c.cfg.review.idleCloseHours * 60 * 60 * 1000) continue;
      const ref = `review-idle-close:${wt.id}:${session.handle}`;
      const detail = `would close idle reviewer ${session.handle} in ${wt.path} (idle ${Math.floor(age / 3600000)}h)`;
      if (c.dryRun) { once(store, ctx.now, `dry-run:${ref}`, "dry-run", { type: "dry-run", item: "", version: "", kind: REVIEW_KIND, detail }); continue; }
      if (store.hasLedgerRef(ref)) continue;
      try {
        const r = await deps.closeTerminal(session.handle);
        c.view.invalidate(wt.id);
        if (!r.ok) throw new Error(r.stderr.trim() || r.stdout.trim() || "Orca close failed");
        store.addLedger({ at: deps.now(), item: "", version: "", kind: REVIEW_KIND, outcome: "closed", detail: session.handle, source: "prflow", ref });
      } catch (e) {
        const failureRef = `action-failed:${ref}`;
        if (store.addLedger({ at: deps.now(), item: "", version: "", kind: REVIEW_KIND, outcome: "failed", detail, source: "prflow", ref: failureRef })) store.appendEvent(deps.now(), { type: "action-failed", item: "", version: "", kind: REVIEW_KIND, detail: `could not close idle reviewer ${session.handle}: ${short((e as Error).message, 200)}` });
      }
    }
  }
}

async function syncStatuses(c: ReviewCtx, result: ScanResult, items: Classification[]): Promise<void> {
  const prs = new Map(result.prs.filter((p) => p.role === "reviewer").map((p) => [`${p.repo}#${p.number}`.toLowerCase(), p]));
  const classifications = new Map(items.filter((i) => i.role === "reviewer").map((i) => [i.key.toLowerCase(), i]));
  for (const wt of await c.view.worktrees()) {
    if (!isReviewBranch(wt.branch)) continue;
    const repoSlug = wt.repo.split("/")[1]?.toLowerCase().replace(/[^a-z0-9._-]/g, "-") ?? "";
    const canonicalPrefix = `prflow-review/${repoSlug}-`;
    const suffix = wt.branch.startsWith(canonicalPrefix) ? wt.branch.slice(canonicalPrefix.length) : "";
    const number = wt.linkedPr ?? (/^[1-9]\d*$/.test(suffix) ? Number(suffix) : null);
    if (number === null) continue;
    let pr = [...prs.values()].find((p) => p.repo.toLowerCase() === wt.repo.toLowerCase() && p.number === number);
    if (!pr) {
      try { pr = await fetchReviewPr(c.deps, c.cfg, wt.repo, number) ?? undefined; }
      catch (e) { result.errors.push(`review status ${wt.repo}#${number}: ${(e as Error).message}`); continue; }
    }
    if (!pr || pr.state !== "OPEN") continue;
    const key = `${pr.repo}#${pr.number}`.toLowerCase();
    const item = classifications.get(key);
    const h8 = pr.headSha.slice(0, 8);
    const dispatch = c.store.findDispatch(`${pr.repo}#${pr.number}`, h8, REVIEW_KIND);
    const loaded = loadDraft(draftPaths(c.store.dir, pr.repo, pr.number, h8));
    const posted = pr.reviews.filter((r) => r.author?.login.toLowerCase() === pr.account.toLowerCase() && r.at !== null && r.state !== "PENDING" && r.commitOid === pr.headSha).sort((a, b) => (b.at ?? "").localeCompare(a.at ?? ""))[0];
    let status: string, comment: string;
    let unread: "--unread" | "--read" | undefined;
    let desiredUnread: boolean | undefined;
    const postedRef = `review-status-posted:${wt.id}:${h8}`;
    const draftRef = `review-status-draft:${wt.id}:${h8}`;
    if (pr.isDraft) { status = c.cfg.review.statuses.draft; comment = "PR in draft"; }
    else if (!posted && !loaded.ok) {
      status = c.cfg.review.statuses.reviewing;
      comment = dispatch && OPEN_STATES.includes(dispatch.state as typeof OPEN_STATES[number]) ? `reviewing ${h8}` : item?.status.includes("required checks pending") ? `checks running on ${h8}` : `queued ${h8}`;
    } else if (posted) {
      const mapping = posted.state === "APPROVED" ? [c.cfg.review.statuses.approved, "approved"] : posted.state === "CHANGES_REQUESTED" ? [c.cfg.review.statuses.changes, "changes requested"] : [c.cfg.review.statuses.reviewing, "commented"];
      status = mapping[0] as string; comment = `${mapping[1]} at ${h8}`;
      desiredUnread = false;
      if (!c.store.hasLedgerRef(postedRef) && wt.isUnread !== false) unread = "--read";
    } else {
      const verdict = loaded.draft?.verdict ?? "comment";
      status = verdict === "approve" ? c.cfg.review.statuses.approved : verdict === "request-changes" ? c.cfg.review.statuses.changes : c.cfg.review.statuses.reviewing;
      comment = `draft: ${verdict}, ${loaded.draft?.comments.length ?? 0} inline, not posted`;
      desiredUnread = true;
      if (!c.store.hasLedgerRef(draftRef) && wt.isUnread !== true) unread = "--unread";
    }
    if (posted && desiredUnread === false && !c.store.hasLedgerRef(postedRef) && wt.isUnread === false) c.store.addLedger({ at: c.ctx.now, item: key, version: h8, kind: REVIEW_KIND, outcome: "posted-status-seen", detail: comment, source: "prflow", ref: postedRef });
    if (loaded.ok && !posted && desiredUnread === true && !c.store.hasLedgerRef(draftRef) && wt.isUnread === true) c.store.addLedger({ at: c.ctx.now, item: key, version: h8, kind: REVIEW_KIND, outcome: "draft-status-seen", detail: comment, source: "prflow", ref: draftRef });
    if (wt.workspaceStatus === status && wt.comment === comment && unread === undefined) continue;
    const ref = `review-status:${wt.id}:${h8}`;
    const writeKey = `${wt.id}:${status}:${comment}`;
    if (c.dryRun) { once(c.store, c.ctx.now, `dry-run:review-status:${writeKey}`, "dry-run", { type: "dry-run", item: key, version: h8, kind: REVIEW_KIND, detail: `would set ${wt.path} status ${status}, comment ${comment}${unread ? ` ${unread}` : ""}` }); continue; }
    const res = await c.deps.setReviewWorktree(wt.path, wt.branch, status, comment, unread);
    if (!res.ok) {
      const detail = `orca-ide worktree set ${wt.path}: ${short(res.stderr.trim() || res.stdout.trim(), 200)}`;
      if (c.store.addLedger({ at: c.ctx.now, item: key, version: h8, kind: REVIEW_KIND, outcome: "failed", detail, source: "prflow", ref: `failed:review-status:${writeKey}` })) c.store.appendEvent(c.ctx.now, { type: "action-failed", item: key, version: h8, kind: REVIEW_KIND, detail });
      continue;
    }
    if (posted && desiredUnread === false && !c.store.hasLedgerRef(postedRef)) c.store.addLedger({ at: c.ctx.now, item: key, version: h8, kind: REVIEW_KIND, outcome: "posted-status-seen", detail: comment, source: "prflow", ref: postedRef });
    if (loaded.ok && !posted && desiredUnread === true && !c.store.hasLedgerRef(draftRef)) c.store.addLedger({ at: c.ctx.now, item: key, version: h8, kind: REVIEW_KIND, outcome: "draft-status-seen", detail: comment, source: "prflow", ref: draftRef });
  }
}

/** The review flow: monitor (before reconcile), act (after the agent flow), and the report annotation. */
export function makeReviewFlow(deps: TickDeps, store: Store, cfg: Config, templates: Templates): { monitor: Monitor; act: Act; annotate: Annotate } {
  let view = new OrcaView(deps);
  const announced = { n: 0 };
  const ctxOf = (ctx: Parameters<Act>[0], opts: TickOptions): ReviewCtx => ({ deps, store, cfg, templates, view, ctx, dryRun: opts.reviewDryRun ?? cfg.review.dryRun, announced });
  const reviewItems = (items: Classification[]) => new Map(items.filter((i) => i.role === "reviewer").map((i) => [i.key.toLowerCase(), i]));
  return {
    async monitor(ctx, _result: ScanResult, items, opts) {
      view = new OrcaView(deps);
      announced.n = 0;
      const c = ctxOf(ctx, opts);
      const byKey = reviewItems(items);
      for (const d of store.dispatchesOfKind(REVIEW_KIND, OPEN_STATES)) {
        const item = byKey.get(d.item.toLowerCase());
        const draft = loadDraft(pathsOf(store.dir, d));
        await monitorOne(c, d, { moved: reviewFinished(d, item, draft), nudge: () => nudgeText(c, d, item, draft), busyLimit: false });
      }
      await reap(c);
      await syncStatuses(c, _result, items);
    },
    async act(ctx, result, items, opts) {
      const c = ctxOf(ctx, opts);
      const prs = new Map(result.prs.filter((p) => p.role === "reviewer").map((p) => [`${p.repo}#${p.number}`.toLowerCase(), p]));
      // Normal requests first, then ones another reviewer already approved.
      const todo = items.filter((i) => i.role === "reviewer" && i.kind === REVIEW_KIND).sort((a, b) => Number(a.lowPriority ?? false) - Number(b.lowPriority ?? false));
      for (const item of todo) {
        const pr = prs.get(item.key.toLowerCase());
        if (pr) await dispatchReview(c, item, pr);
      }
    },
    annotate(items) {
      return items.map((i) => {
        if (i.role !== "reviewer" || i.kind !== REVIEW_KIND) return i;
        const d = store.findDispatch(i.key, head8(i), REVIEW_KIND);
        if (!d || d.state !== "done") return i;
        const draft = loadDraft(pathsOf(store.dir, d));
        if (!draft.ok || !draft.draft) return { ...i, owner: "you", nextAction: `reviewer #${d.id} finished without a usable draft at ${draft.paths.file}; review by hand` };
        const n = draft.draft.comments.length;
        return {
          ...i,
          owner: "you",
          nextAction: `review draft ready (verdict suggestion ${draft.draft.verdict}, ${n} inline comment${n === 1 ? "" : "s"}): \`prflow review show ${draft.paths.id}\`; nothing is posted until you ask for \`prflow review post ${draft.paths.id} --yes\``,
        };
      });
    },
  };
}
