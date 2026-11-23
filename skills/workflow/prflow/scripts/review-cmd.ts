/** Read and render saved review drafts. Review publication belongs to `/pr review`. */
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { draftSummary, parseDraftId } from "./core/draft.ts";
import type { PrSnapshot } from "./core/types.ts";
import { loadDraft, type LoadedDraft } from "./review.ts";
import { draftRevision, type Revision } from "./revisions.ts";
import type { Store } from "./store.ts";

export type ReadDraftPr = (d: NonNullable<LoadedDraft["meta"]>) => Promise<PrSnapshot | null>;

/** A submitted review by this draft's account at the reviewed head or the current later head. */
export function draftWasPosted(meta: NonNullable<LoadedDraft["meta"]>, pr: PrSnapshot | null): boolean {
  if (!pr) return false;
  const commits = pr.commitOids ?? [];
  const draftIndex = commits.indexOf(meta.headSha);
  return pr.reviews.some((review) => {
    if (review.at === null || review.state === "PENDING" || review.author?.login.toLowerCase() !== meta.account.toLowerCase() || !review.commitOid) return false;
    if (review.commitOid === meta.headSha) return true;
    const reviewedIndex = commits.indexOf(review.commitOid);
    if (draftIndex >= 0 && reviewedIndex >= draftIndex) return true;
    return pr.headSha !== meta.headSha && review.commitOid === pr.headSha && review.at >= meta.createdAt;
  });
}

const revisionOf = (store: Store, d: LoadedDraft): Revision | null =>
  d.text === null ? null : draftRevision(store, d.paths, d.text);

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
  /** Whether the draft's account reviewed the PR; `null` when GitHub could not be read. */
  posted: boolean | null;
  /** Why `posted` is unknown. */
  postedError?: string;
  revision: number;
  path: string;
}

/** Every draft folder in the state directory, newest PRs last. */
export async function listDrafts(store: Store, readPr: ReadDraftPr): Promise<DraftRow[]> {
  const root = join(store.dir, "drafts");
  const rows: DraftRow[] = [];
  let folders: string[] = [];
  try { folders = readdirSync(root).sort(); } catch { return []; }
  for (const f of folders) {
    for (const h of readdirSync(join(root, f)).sort()) {
      const id = `${f}-${h}`;
      if (!parseDraftId(id)) continue;
      const d = load(store, id);
      const r = revisionOf(store, d);
      let posted: boolean | null = false;
      let postedError: string | undefined;
      if (d.meta) {
        try { posted = draftWasPosted(d.meta, await readPr(d.meta)); }
        catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          posted = null;
          postedError = message.replace(/\s+/g, " ").trim().slice(0, 120);
        }
      }
      rows.push({
        id,
        item: d.meta?.item ?? null,
        head: h,
        saved: d.text !== null,
        verdict: d.draft?.verdict ?? null,
        comments: d.draft?.comments.length ?? 0,
        errors: d.draft?.errors ?? [],
        posted,
        ...(postedError === undefined ? {} : { postedError }),
        revision: r?.rev ?? 1,
        path: d.paths.file,
      });
    }
  }
  return rows;
}

export function renderDraftList(rows: DraftRow[]): string {
  if (!rows.length) return "No review drafts.";
  return rows.map((r) => {
    const rev = r.revision > 1 ? ` r${r.revision}` : "";
    const state = r.posted === null ? `posted: unknown (${r.postedError ?? "read failed"})` : r.posted ? `posted${rev}` : !r.saved ? "not saved yet" : r.errors.length ? `invalid draft${rev} (${r.errors.join("; ")})` : `ready${rev}`;
    return `- ${r.id} | ${r.item ?? "?"} at ${r.head} | ${state} | verdict suggestion ${r.verdict ?? "none"} | ${r.comments} inline comment(s) | ${r.path}`;
  }).join("\n");
}

/** The saved draft text and GitHub-derived publication status. */
export async function showDraft(store: Store, id: string, readPr: ReadDraftPr): Promise<string> {
  const d = load(store, id);
  const posted = d.meta ? draftWasPosted(d.meta, await readPr(d.meta)) : false;
  const lines = [
    `draft: ${id}`,
    `PR: ${d.meta?.item ?? "?"} ${d.meta?.url ?? ""}`.trimEnd(),
    `head: ${d.meta?.headSha ?? "?"}`,
    `account: ${d.meta?.account ?? "?"}`,
    `posted: ${posted ? "yes" : "no"}`,
    `file: ${d.paths.file}`,
  ];
  if (d.text === null) return [...lines, "", "The reviewer has not saved this draft yet."].join("\n");
  if (d.draft) lines.push(`summary: ${draftSummary(id, d.draft, d.paths.file)}`);
  lines.push("", d.text.trimEnd());
  return lines.join("\n");
}
