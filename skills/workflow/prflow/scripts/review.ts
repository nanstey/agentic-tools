/**
 * Review flow for `review-requested`: one isolated reviewer session per
 * (PR, head) in its own Orca worktree. The reviewer writes a DRAFT under the
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
 * Reap (after monitor): for each done reviewer, emit `review-drafted`, then
 * close its idle session and archive its worktree only when the draft is saved,
 * no Pi session there is busy, and the tree is clean with nothing unpushed.
 * A worktree whose draft is missing is never archived; prflow asks instead.
 *
 * Review dry run (`review.dryRun`, default true) makes the same reads and
 * announces the exact target and brief once per head as a `dry-run` event.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
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
import type { ScanResult } from "./scan.ts";
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

function readOrNull(path: string): string | null {
  try {
    return readFileSync(path, "utf8");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw e;
  }
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
function describeReview(target: ReturnType<typeof chooseTarget>, wt: OrcaWorktree | null, slug: string, repo: string, repoId: string | null): string {
  if (target.do === "wait") return `wait: ${target.why}`;
  if (!wt) return `create Orca worktree ${reviewWorktreeName(slug)} on branch ${reviewBranch(slug)} (orca-ide ${reviewWorktreeArgs(repoId ?? "<repo id>", slug, Number(slug.split("-").at(-2))).join(" ")}) for ${repo}, then launch a fresh Pi reviewer there`;
  if (target.do === "launch") return `${target.close ? `close ${target.close.handle}, then ` : ""}launch a fresh Pi reviewer in ${wt.path}`;
  if (target.do === "message") return `message Pi session ${target.session.handle} in ${wt.path}${target.restart ? ` to restart it (${target.restart})` : ""}`;
  return `interrupt Pi session ${target.session.handle} in ${wt.path}, then restart it (${target.restart})`;
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
  if (!mine) {
    const running = store.dispatchesOfKind(kind, OPEN_STATES).length + c.announced.n;
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
  const target = wt
    ? chooseTarget(await c.view.sessions(wt.id), ref?.restartHandle ?? ref?.sessionHandle ?? null, {
        reuse: !!ref?.restartHandle,
        waitedMs: mine?.waitSince != null ? ctx.now - mine.waitSince : 0,
        busyWaitMs,
      })
    : ({ do: "launch", close: null } as const);
  const waitLease = (since: number) => since + busyWaitMs + ctx.rails.leaseMinutes * MINUTE_MS;
  const plan = describeReview(target, wt, slug, pr.repo, repoId);

  if (mine) {
    if (target.do === "wait" && mine.waitSince === null && !c.dryRun) store.patchDispatch(mine.id, { waitSince: ctx.now, leaseUntil: waitLease(ctx.now) }, ctx.now);
    if (target.do === "wait" || c.dryRun || store.item(key)?.paused) return;
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

/** Emit `review-drafted`, then archive the review worktree of each done reviewer when it is safe. */
async function reap(c: ReviewCtx): Promise<void> {
  const { store, deps, ctx } = c;
  for (const d of store.dispatchesOfKind(REVIEW_KIND, ["done"])) {
    if (store.hasLedgerRef(`review-reaped:${d.id}`)) continue;
    const draft = loadDraft(pathsOf(store.dir, d));
    if (draft.ok && draft.draft && store.addLedger({ at: ctx.now, item: d.item, version: d.version, kind: d.kind, outcome: "drafted", detail: draft.paths.id, dispatchId: d.id, source: "prflow", ref: `review-drafted:${d.id}` }))
      store.appendEvent(ctx.now, { ...ev(d), type: "review-drafted", sessionHandle: d.sessionHandle, detail: draftSummary(draft.paths.id, draft.draft, draft.paths.file) });
    if (!d.worktree) continue;
    const reaped = (detail: string) => store.addLedger({ at: deps.now(), item: d.item, version: d.version, kind: d.kind, outcome: "reaped", detail, dispatchId: d.id, source: "prflow", ref: `review-reaped:${d.id}` });
    const wt = (await c.view.worktrees()).find((w) => w.id === d.worktree);
    if (!wt) {
      reaped(`worktree ${d.worktree} is no longer listed`);
      continue;
    }
    const ask = (suffix: string, detail: string) => once(store, ctx.now, `ask:review-reap:${d.id}:${suffix}`, "needs-decision", { type: "needs-decision", item: d.item, version: d.version, kind: REVIEW_KIND, detail });
    if (!draft.ok) {
      ask("draft", `reviewer #${d.id} finished but ${draft.text === null ? `saved no draft at ${draft.paths.file}` : `its draft does not parse (${draft.draft?.errors.join("; ")})`}. prflow will not archive its worktree ${wt.path}; check it, then archive it by hand`);
      continue;
    }
    const sessions = await c.view.sessions(wt.id);
    if (sessions.some(isBusy)) continue; // A Pi session there is still busy; try next tick.
    const dirty = await deps.gitDirty(wt.path);
    const unpushed = await deps.gitUnpushed(wt.path, draft.meta?.headSha ?? null);
    if (dirty !== 0 || unpushed !== 0) {
      const why = [dirty === null ? "uncommitted state unknown" : dirty ? `${dirty} uncommitted file(s)` : null, unpushed === null ? "unpushed commits unknown" : unpushed ? `${unpushed} unpushed commit(s)` : null].filter(Boolean);
      ask(`${dirty}:${unpushed}`, `review worktree ${wt.path} has ${why.join(" and ")}; draft ${draft.paths.id} is saved. prflow will not archive it; check it, then archive it by hand`);
      continue;
    }
    const info = await deps.branchInfo(wt.path);
    const branch = info?.branch && isReviewBranch(info.branch) && safeBranch(info.branch) ? info : null;
    const own = sessions.find((s) => s.handle === d.sessionHandle && s.kind === "terminal") ?? null;
    const plan = [own ? `close ${own.handle}` : null, `archive ${wt.path}`, branch ? `delete local branch ${branch.branch}` : null].filter(Boolean).join(", then ");
    if (c.dryRun) {
      once(store, ctx.now, `dry-run:review-reap:${d.id}`, "dry-run", { type: "dry-run", item: d.item, version: d.version, kind: REVIEW_KIND, detail: `would ${plan} (draft ${draft.paths.id} saved, tree clean)` });
      continue;
    }
    if (own) {
      const r = await deps.closeTerminal(own.handle);
      c.view.invalidate(wt.id);
      if (!r.ok) {
        ask(`close:${own.handle}`, `could not close reviewer session ${own.handle}: ${short(r.stderr.trim() || r.stdout.trim(), 200)}; prflow retries next tick`);
        continue;
      }
    }
    const r = await deps.archiveWorktree(wt.path);
    if (!r.ok) {
      ask("archive", `could not archive review worktree ${wt.path}: ${short(r.stderr.trim() || r.stdout.trim(), 200)}; prflow retries next tick`);
      continue;
    }
    c.view.invalidateWorktrees();
    let kept = "no local branch to delete";
    if (branch?.branch) {
      const del = await deps.deleteBranch(branch.gitDir, branch.branch, branch.sha);
      kept = del.ok ? `deleted local branch ${branch.branch}` : `local branch ${branch.branch} kept: ${short(del.stderr.trim(), 200)}`;
    }
    reaped(`archived ${wt.path}`);
    store.appendEvent(deps.now(), { ...ev(d), type: "archived", sessionHandle: own?.handle ?? null, detail: `review worktree ${wt.path} archived after draft ${draft.paths.id} was saved (${kept})` });
  }
}

/** The review flow: monitor (before reconcile), act (after the agent flow), and the report annotation. */
export function makeReviewFlow(deps: TickDeps, store: Store, cfg: Config, templates: Templates): { monitor: Monitor; act: Act; annotate: Annotate } {
  let view = new OrcaView(deps);
  const announced = { n: 0 };
  const ctxOf = (ctx: Parameters<Act>[0], opts: TickOptions): ReviewCtx => ({ deps, store, cfg, templates, view, ctx, dryRun: opts.reviewDryRun ?? true, announced });
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
