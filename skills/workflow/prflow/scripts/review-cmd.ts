/** Read and render saved review drafts. Review publication belongs to `/pr review`. */
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { coverageText, draftFolder, draftSummary, parseDraftId, type Coverage } from "./core/draft.ts";
import type { PrSnapshot } from "../../../../lib/pr/types.ts";
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

function metaErrors(store: Store, d: LoadedDraft, expectedAccount?: (repo: string) => string | null): string[] {
  const m = d.meta;
  if (!m) return [];
  // meta.json is reviewer-writable: check field types before using them.
  const str = (v: unknown): v is string => typeof v === "string";
  if (!str(m.item) || !str(m.repo) || !str(m.url) || !str(m.headSha) || !str(m.account) || !Number.isInteger(m.number) || m.number < 1 || !Number.isInteger(m.dispatchId))
    return ["meta mismatch: malformed meta.json"];
  const errors: string[] = [];
  if (m.item !== `${m.repo}#${m.number}`) errors.push("item/repo/number");
  if (m.url !== `https://github.com/${m.repo}/pull/${m.number}`) errors.push("url");
  if (m.headSha.slice(0, 8) !== d.paths.id.slice(-8)) errors.push("headSha/path");
  const expected = expectedAccount?.(m.repo);
  if (expectedAccount && (!expected || m.account.toLowerCase() !== expected.toLowerCase())) errors.push("account");
  try {
    if (d.paths.dir.split("/").slice(-2).join("/") !== `${draftFolder(m.repo, m.number)}/${m.headSha.slice(0, 8)}`) errors.push("draft folder path");
  } catch { errors.push("draft folder path"); }
  const dispatch = store.dispatch(m.dispatchId);
  if (!dispatch || dispatch.item.toLowerCase() !== m.item.toLowerCase() || dispatch.version !== m.headSha.slice(0, 8)) errors.push("dispatch item/version");
  return errors.length ? [`meta mismatch: ${errors.join(", ")}`] : [];
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
  /** Whether the review ran every required row; `incomplete` drafts cannot be approved or request changes. */
  coverage: Coverage | null;
  /** What did not run, for an incomplete review. */
  coverageGaps: string;
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
export async function listDrafts(store: Store, readPr: ReadDraftPr, expectedAccount?: (repo: string) => string | null): Promise<DraftRow[]> {
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
      const integrity = metaErrors(store, d, expectedAccount);
      const errors = [...(d.draft?.errors ?? []), ...integrity];
      let posted: boolean | null = false;
      let postedError: string | undefined;
      if (d.meta && integrity.length === 0) {
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
        coverage: d.draft?.coverage ?? null,
        coverageGaps: d.draft?.coverageGaps ?? "",
        comments: d.draft?.comments.length ?? 0,
        errors,
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
    const coverage = r.coverage ? ` | review ${coverageText({ coverage: r.coverage, coverageGaps: r.coverageGaps })}` : "";
    return `- ${r.id} | ${r.item ?? "?"} at ${r.head} | ${state} | verdict suggestion ${r.verdict ?? "none"}${coverage} | ${r.comments} inline comment(s) | ${r.path}`;
  }).join("\n");
}

/** The saved draft text and GitHub-derived publication status. */
export async function showDraft(store: Store, id: string, readPr: ReadDraftPr, expectedAccount?: (repo: string) => string | null): Promise<string> {
  const d = load(store, id);
  const integrity = metaErrors(store, d, expectedAccount);
  const posted = d.meta && integrity.length === 0 ? draftWasPosted(d.meta, await readPr(d.meta)) : false;
  const lines = [
    `draft: ${id}`,
    `PR: ${integrity.length ? "invalid target" : `${d.meta?.item ?? "?"} ${d.meta?.url ?? ""}`}`,
    `head: ${integrity.length ? "invalid" : d.meta?.headSha ?? "?"}`,
    `account: ${integrity.length ? "invalid" : d.meta?.account ?? "?"}`,
    `posted: ${posted ? "yes" : "no"}`,
    `file: ${d.paths.file}`,
  ];
  if (integrity.length) lines.push(...integrity);
  if (d.text === null) return [...lines, "", "The reviewer has not saved this draft yet."].join("\n");
  if (d.draft) lines.push(`coverage: ${coverageText(d.draft)}`, `summary: ${draftSummary(id, d.draft, d.paths.file)}`);
  lines.push("", d.text.trimEnd());
  return lines.join("\n");
}
