/**
 * `prflow review list|show|post`: read saved review drafts, and the one path
 * that posts a draft to GitHub. Tick never imports this module; `post` runs only
 * when a person asks for it and refuses without `--yes`.
 */
import { readdirSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parsePr, prArgs, reviewPostArgs } from "./adapters/gh.ts";
import { draftSummary, parseDraftId, reviewPayload, type Verdict } from "./core/draft.ts";
import type { PostDeps } from "./deps.ts";
import { loadDraft, type LoadedDraft } from "./review.ts";
import type { Store } from "./store.ts";

/** Ledger ref that marks a draft as posted. */
const postedRef = (id: string) => `review-posted:${id}`;

function draftDir(store: Store, id: string): { id: string; dir: string } {
  const p = parseDraftId(id);
  if (!p) throw new Error(`bad draft id "${id}" (expected <owner>-<repo>-<n>-<head8>; see prflow review list)`);
  return { id, dir: join(store.dir, "drafts", p.folder, p.head8) };
}

function load(store: Store, id: string): LoadedDraft {
  const { dir } = draftDir(store, id);
  const d = loadDraft({ id, dir, file: join(dir, "review.md"), meta: join(dir, "meta.json") });
  if (d.text === null && d.meta === null) throw new Error(`draft ${id} not found (see prflow review list)`);
  return d;
}

export interface DraftRow {
  id: string;
  item: string | null;
  head: string;
  saved: boolean;
  verdict: string | null;
  comments: number;
  errors: string[];
  posted: boolean;
  path: string;
}

/** Every draft folder in the state directory, newest PRs last. */
export function listDrafts(store: Store): DraftRow[] {
  const root = join(store.dir, "drafts");
  const rows: DraftRow[] = [];
  let folders: string[] = [];
  try {
    folders = readdirSync(root).sort();
  } catch {
    return [];
  }
  for (const f of folders)
    for (const h of readdirSync(join(root, f)).sort()) {
      const id = `${f}-${h}`;
      if (!parseDraftId(id)) continue;
      const d = load(store, id);
      rows.push({
        id,
        item: d.meta?.item ?? null,
        head: h,
        saved: d.text !== null,
        verdict: d.draft?.verdict ?? null,
        comments: d.draft?.comments.length ?? 0,
        errors: d.draft?.errors ?? [],
        posted: store.hasLedgerRef(postedRef(id)),
        path: d.paths.file,
      });
    }
  return rows;
}

export function renderDraftList(rows: DraftRow[]): string {
  if (!rows.length) return "No review drafts.";
  return rows
    .map((r) => {
      const state = r.posted ? "posted" : !r.saved ? "not saved yet" : r.errors.length ? `not postable (${r.errors.join("; ")})` : "ready";
      return `- ${r.id} | ${r.item ?? "?"} at ${r.head} | ${state} | verdict suggestion ${r.verdict ?? "none"} | ${r.comments} inline comment(s) | ${r.path}`;
    })
    .join("\n");
}

/** The draft text with what `post` would send. */
export function showDraft(store: Store, id: string): string {
  const d = load(store, id);
  const lines = [
    `draft: ${id}`,
    `PR: ${d.meta?.item ?? "?"} ${d.meta?.url ?? ""}`.trimEnd(),
    `head: ${d.meta?.headSha ?? "?"}`,
    `account: ${d.meta?.account ?? "?"}`,
    `posted: ${store.hasLedgerRef(postedRef(id)) ? "yes" : "no"}`,
    `file: ${d.paths.file}`,
  ];
  if (d.text === null) return [...lines, "", "The reviewer has not saved this draft yet."].join("\n");
  if (d.draft) lines.push(`summary: ${draftSummary(id, d.draft, d.paths.file)}`);
  lines.push(`post with: prflow review post ${id} --event ${d.draft?.verdict ?? "comment"} --yes (default event: comment)`, "", d.text.trimEnd());
  return lines.join("\n");
}

export interface PostOptions {
  event: Verdict;
  yes: boolean;
}

/**
 * Post one draft as a GitHub review, as the draft's account, pinned to the
 * reviewed commit. Refuses without `yes`, when the draft does not parse, was
 * already posted (by prflow, or the account already reviewed that commit on
 * GitHub), when the PR is no longer open, or an approval when the head moved.
 * Records a `review-posted` event and ledger row on success.
 */
export async function postDraft(store: Store, deps: PostDeps, id: string, o: PostOptions): Promise<{ out: string; code: number }> {
  const d = load(store, id);
  const meta = d.meta;
  if (!meta) return { out: `refusing: draft ${id} has no meta.json, so prflow does not know which commit and account it is for`, code: 1 };
  if (!d.draft || d.text === null) return { out: `refusing: draft ${id} is not saved yet (${d.paths.file})`, code: 1 };
  if (d.draft.errors.length) return { out: `refusing: draft ${id} does not parse: ${d.draft.errors.join("; ")}`, code: 1 };
  if (store.hasLedgerRef(postedRef(id))) return { out: `refusing: draft ${id} was already posted`, code: 1 };
  const payload = reviewPayload(d.draft, o.event, meta.headSha);
  const input = join(d.paths.dir, "post.json");
  const command = `gh ${reviewPostArgs(meta.repo, meta.number, input).join(" ")} (as ${meta.account})`;
  const preview = `${payload.event} review of ${meta.item} at ${meta.headSha.slice(0, 8)} with ${d.draft.comments.length} inline comment(s), as ${meta.account}`;
  if (!o.yes) return { out: `would post: ${preview}\nrefusing: add --yes to post (prflow posts only on your explicit instruction)`, code: 1 };

  const r = await deps.gh(meta.account, prArgs(meta.repo, meta.number));
  if (!r.ok) return { out: `refusing: cannot read ${meta.item}: ${r.stderr.trim()}`, code: 1 };
  const pr = parsePr(r.stdout, meta.repo, meta.number, "reviewer", meta.account);
  if (!pr) return { out: `refusing: ${meta.item} not found`, code: 1 };
  if (pr.state !== "OPEN") return { out: `refusing: ${meta.item} is ${pr.state}`, code: 1 };
  const mine = pr.reviews.find((x) => x.author?.login.toLowerCase() === meta.account.toLowerCase() && x.at !== null && x.state !== "PENDING" && x.commitOid === meta.headSha);
  if (mine) return { out: `refusing: ${meta.account} already reviewed ${meta.item} at ${meta.headSha.slice(0, 8)} (${mine.state} ${mine.at})`, code: 1 };
  const moved = pr.headSha !== meta.headSha;
  if (moved && o.event === "approve") return { out: `refusing: the head moved to ${pr.headSha.slice(0, 8)} since the review of ${meta.headSha.slice(0, 8)}; approve only a current review (or post with --event comment)`, code: 1 };

  const tmp = `${input}.${process.pid}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(payload, null, 2)}\n`);
  renameSync(tmp, input);
  const now = deps.now();
  store.addLedger({ at: now, item: meta.item, version: id.slice(-8), kind: "review-requested", outcome: "post-started", detail: command, dispatchId: meta.dispatchId, source: "prflow" });
  const res = await deps.postReview(meta.account, meta.repo, meta.number, input);
  const t = deps.now();
  if (!res.ok) {
    store.appendEvent(t, { type: "action-failed", item: meta.item, version: id.slice(-8), kind: "review-requested", dispatchId: meta.dispatchId, detail: `review post ${id}: ${(res.stderr.trim() || res.stdout.trim()).slice(0, 300)}` });
    return { out: `post failed: ${res.stderr.trim() || res.stdout.trim()}`, code: 1 };
  }
  let url = "";
  try {
    url = String((JSON.parse(res.stdout) as { html_url?: string }).html_url ?? "");
  } catch {
    url = "";
  }
  const detail = `posted draft ${id} as ${meta.account}: ${payload.event} with ${d.draft.comments.length} inline comment(s) at ${meta.headSha.slice(0, 8)}${moved ? ` (head is now ${pr.headSha.slice(0, 8)})` : ""}${url ? ` ${url}` : ""}`;
  store.addLedger({ at: t, item: meta.item, version: id.slice(-8), kind: "review-requested", outcome: "posted", detail, dispatchId: meta.dispatchId, source: "prflow", ref: postedRef(id) });
  store.appendEvent(t, { type: "review-posted", item: meta.item, version: id.slice(-8), kind: "review-requested", dispatchId: meta.dispatchId, detail });
  return { out: detail, code: 0 };
}
