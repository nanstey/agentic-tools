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
import { commentKey, draftRevision, materializeLegacy, postedRef, postedRevisions, recordPosted, type Revision } from "./revisions.ts";
import type { Store } from "./store.ts";

/** The saved text's revision, or `null` when nothing is saved. */
const revisionOf = (store: Store, d: LoadedDraft): Revision | null => (d.text === null ? null : draftRevision(store, d.paths, d.text));

/** `posted r1`, `r2 not posted (r1 posted)`, or `not posted`. */
function postedText(store: Store, d: LoadedDraft): string {
  const r = revisionOf(store, d);
  if (!r) return postedRevisions(store, d.paths).length ? "earlier revision posted; no text saved" : "no";
  if (r.posted) return `yes, revision r${r.rev}`;
  return r.earlier.length ? `no, revision r${r.rev} (r${r.earlier.map((x) => x.rev).join(", r")} posted)` : "no";
}

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
  /** Revision of the saved text (1 until a posted draft is rewritten). */
  revision: number;
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
      const r = revisionOf(store, d);
      rows.push({
        id,
        item: d.meta?.item ?? null,
        head: h,
        saved: d.text !== null,
        verdict: d.draft?.verdict ?? null,
        comments: d.draft?.comments.length ?? 0,
        errors: d.draft?.errors ?? [],
        posted: r ? r.posted !== null : postedRevisions(store, d.paths).length > 0,
        revision: r?.rev ?? 1,
        path: d.paths.file,
      });
    }
  return rows;
}

export function renderDraftList(rows: DraftRow[]): string {
  if (!rows.length) return "No review drafts.";
  return rows
    .map((r) => {
      const rev = r.revision > 1 ? ` r${r.revision}` : "";
      const state = r.posted ? `posted${rev}` : !r.saved ? "not saved yet" : r.errors.length ? `not postable${rev} (${r.errors.join("; ")})` : `ready${rev}${r.revision > 1 ? " (earlier revision posted)" : ""}`;
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
    `posted: ${postedText(store, d)}`,
    `file: ${d.paths.file}`,
  ];
  if (d.text === null) return [...lines, "", "The reviewer has not saved this draft yet."].join("\n");
  if (d.draft) lines.push(`summary: ${draftSummary(id, d.draft, d.paths.file)}`);
  lines.push(`post with: prflow review post ${id} --event ${d.draft?.verdict ?? "comment"} --yes (default event: comment)`, "", d.text.trimEnd());
  return lines.join("\n");
}

/** Note appended to an approval posted as a comment because the head moved past the reviewed commit. */
export function withheldNote(reviewedSha: string): string {
  return `approval withheld: new commits since ${reviewedSha.slice(0, 8)}; the next review cycle covers them`;
}

function withholdApproval(payload: Record<string, unknown>, reviewedSha: string): Record<string, unknown> {
  const body = String(payload.body ?? "").trimEnd();
  return { ...payload, event: "COMMENT", body: `${body}${body ? "\n\n" : ""}${withheldNote(reviewedSha)}` };
}

export interface PostOptions {
  event: Verdict;
  yes: boolean;
}

/**
 * Post one draft revision as a GitHub review, as the draft's account, pinned to
 * the reviewed commit. Refuses without `yes`, when the draft does not parse,
 * when this revision was already posted, when the account already reviewed
 * that commit on GitHub (unless this is a later revision of a posted draft,
 * saved after that review), when the PR is no
 * longer open. An approval on a head that moved since the reviewed commit is
 * posted as a COMMENT whose body ends with an "approval withheld" note: prflow
 * never approves when newer commits exist. A later revision posts only
 * the inline comments no earlier posted revision had. Records the revision in
 * `posted.json`, a `review-posted` event, and a ledger row on success.
 */
export async function postDraft(store: Store, deps: PostDeps, id: string, o: PostOptions): Promise<{ out: string; code: number }> {
  const d = load(store, id);
  const meta = d.meta;
  if (!meta) return { out: `refusing: draft ${id} has no meta.json, so prflow does not know which commit and account it is for`, code: 1 };
  if (!d.draft || d.text === null) return { out: `refusing: draft ${id} is not saved yet (${d.paths.file})`, code: 1 };
  if (d.draft.errors.length) return { out: `refusing: draft ${id} does not parse: ${d.draft.errors.join("; ")}`, code: 1 };
  const revision = draftRevision(store, d.paths, d.text);
  const rn = `r${revision.rev}`;
  if (revision.posted) return { out: `refusing: draft ${id} revision ${rn} was already posted${revision.rev > 1 ? "" : " (a rewritten draft becomes a new revision)"}`, code: 1 };
  const before = new Set(revision.earlier.flatMap((r) => r.comments));
  const fresh = d.draft.comments.filter((c) => !before.has(commentKey(c)));
  const skipped = d.draft.comments.length - fresh.length;
  let payload = reviewPayload({ ...d.draft, comments: fresh }, o.event, meta.headSha, meta.account);
  const input = join(d.paths.dir, "post.json");
  const command = `gh ${reviewPostArgs(meta.repo, meta.number, input).join(" ")} (as ${meta.account})`;
  const what = `${fresh.length} inline comment(s)${skipped ? ` (${skipped} already posted with an earlier revision)` : ""}`;
  const preview = `${payload.event} review of ${meta.item} at ${meta.headSha.slice(0, 8)}${revision.rev > 1 ? ` (draft revision ${rn})` : ""} with ${what}, as ${meta.account}`;
  if (!o.yes) return { out: `would post: ${preview}\nrefusing: add --yes to post (prflow posts only on your explicit instruction)`, code: 1 };

  const r = await deps.gh(meta.account, prArgs(meta.repo, meta.number));
  if (!r.ok) return { out: `refusing: cannot read ${meta.item}: ${r.stderr.trim()}`, code: 1 };
  const pr = parsePr(r.stdout, meta.repo, meta.number, "reviewer", meta.account);
  if (!pr) return { out: `refusing: ${meta.item} not found`, code: 1 };
  if (pr.state !== "OPEN") return { out: `refusing: ${meta.item} is ${pr.state}`, code: 1 };
  // Only a later revision of a draft prflow already posted may follow an existing review of this commit, and only when it
  // was saved after that review; a newer review means this revision was posted (perhaps by a post that crashed before recording it).
  const mine = pr.reviews.filter((x) => x.author?.login.toLowerCase() === meta.account.toLowerCase() && x.at !== null && x.state !== "PENDING" && x.commitOid === meta.headSha).sort((a, b) => (b.at ?? "").localeCompare(a.at ?? ""))[0];
  if (mine && !(revision.earlier.length > 0 && Date.parse(mine.at ?? "") < revision.mtime)) return { out: `refusing: ${meta.account} already reviewed ${meta.item} at ${meta.headSha.slice(0, 8)} (${mine.state} ${mine.at}) after draft revision ${rn} was saved; a rewritten draft becomes a new revision`, code: 1 };
  const moved = pr.headSha !== meta.headSha;
  // Never approve unreviewed commits: an approval on a moved head posts as a comment; the next review cycle covers the new head.
  const withheld = moved && o.event === "approve";
  if (withheld) payload = withholdApproval(payload, meta.headSha);

  materializeLegacy(store, d.paths);
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
  recordPosted(store, d.paths, { rev: revision.rev, hash: revision.hash, event: String(payload.event), at: t, comments: d.draft.comments.map(commentKey) });
  const downgrade = withheld ? ` (approve downgraded to COMMENT: approval withheld, head moved to ${pr.headSha.slice(0, 8)})` : moved ? ` (head is now ${pr.headSha.slice(0, 8)})` : "";
  const detail = `posted draft ${id}${revision.rev > 1 ? ` revision ${rn}` : ""} as ${meta.account}: ${payload.event} with ${what} at ${meta.headSha.slice(0, 8)}${downgrade}${url ? ` ${url}` : ""}`;
  store.addLedger({ at: t, item: meta.item, version: id.slice(-8), kind: "review-requested", outcome: "posted", detail, dispatchId: meta.dispatchId, source: "prflow", ref: postedRef(id, revision.rev) });
  store.appendEvent(t, { type: "review-posted", item: meta.item, version: id.slice(-8), kind: "review-requested", dispatchId: meta.dispatchId, detail });
  return { out: detail, code: 0 };
}
