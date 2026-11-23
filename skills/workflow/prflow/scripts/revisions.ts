/**
 * Review draft revisions. A reviewer may rewrite a draft after it was posted
 * (for example, told to approve after a comment review). Each posted text is a
 * revision: `posted.json` beside the draft records its number, content hash,
 * event, time, and inline comments. A saved text that matches no posted
 * revision is the next, unposted revision.
 *
 * Drafts posted before revisions were tracked have only the
 * `review-posted:<id>` ledger row. That row stands for revision 1, with no
 * hash: the draft is that revision while its file is not newer than the post,
 * and its inline comments come from the `post.json` payload sent then.
 *
 * Pure reads plus `recordPosted`, which only writes `posted.json`; nothing here
 * talks to GitHub.
 */
import { createHash } from "node:crypto";
import { mkdirSync, renameSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { readOrNull } from "../../../../lib/runtime.ts";
import { type InlineComment, stripDisclosure } from "./core/draft.ts";

export interface RevisionPaths {
  id: string;
  dir: string;
  file: string;
}

export interface PostedRevision {
  rev: number;
  /** sha256 of the posted draft text; `null` for a post recorded before revisions were tracked. */
  hash: string | null;
  /** GitHub review event (`COMMENT`, `APPROVE`, `REQUEST_CHANGES`). */
  event: string;
  /** Epoch ms when prflow recorded the post. */
  at: number;
  /** `commentKey` of every inline comment posted with this revision. */
  comments: string[];
}

export interface Revision {
  /** 1 for the first text; n + 1 after n posted revisions. */
  rev: number;
  hash: string;
  /** Draft file mtime, epoch ms. */
  mtime: number;
  /** The posted revision this text is, or `null` when it is not posted yet. */
  posted: PostedRevision | null;
  /** Revisions posted before this one. */
  earlier: PostedRevision[];
}

type LedgerReader = { ledgerAt(ref: string): number | null };

export const textHash = (text: string): string => createHash("sha256").update(text).digest("hex");

/** Identity of an inline comment across revisions: location and text, without the agent disclosure. */
export const commentKey = (c: Pick<InlineComment, "path" | "line" | "startLine" | "body">): string => JSON.stringify([c.path, c.startLine, c.line, stripDisclosure(c.body)]);

/** Ledger ref that marks revision `rev` of draft `id` as posted (revision 1 keeps the original ref). */
export const postedRef = (id: string, rev: number): string => (rev <= 1 ? `review-posted:${id}` : `review-posted:${id}:r${rev}`);

const postedFile = (p: RevisionPaths) => join(p.dir, "posted.json");

function legacyComments(p: RevisionPaths): string[] {
  try {
    const body = JSON.parse(readOrNull(join(p.dir, "post.json")) ?? "{}") as { comments?: { path?: unknown; line?: unknown; start_line?: unknown; body?: unknown }[] };
    return (body.comments ?? []).filter((c) => typeof c.path === "string" && typeof c.line === "number" && typeof c.body === "string").map((c) => commentKey({ path: c.path as string, line: c.line as number, startLine: typeof c.start_line === "number" ? c.start_line : null, body: c.body as string }));
  } catch {
    return [];
  }
}

/** Posted revisions of a draft, oldest first. */
export function postedRevisions(store: LedgerReader, p: RevisionPaths): PostedRevision[] {
  const raw = readOrNull(postedFile(p));
  if (raw !== null) {
    try {
      const list = (JSON.parse(raw) as { revisions?: PostedRevision[] }).revisions ?? [];
      return list.filter((r) => Number.isSafeInteger(r.rev) && r.rev > 0).sort((a, b) => a.rev - b.rev);
    } catch {
      // A damaged file falls back to the ledger below.
    }
  }
  const at = store.ledgerAt(postedRef(p.id, 1));
  return at === null ? [] : [{ rev: 1, hash: null, event: "", at, comments: legacyComments(p) }];
}

function mtimeOf(file: string): number {
  try {
    return statSync(file).mtimeMs;
  } catch {
    return 0;
  }
}

/** Which revision the saved draft text is, and whether it was posted. */
export function draftRevision(store: LedgerReader, p: RevisionPaths, text: string): Revision {
  const posted = postedRevisions(store, p);
  const hash = textHash(text);
  const mtime = mtimeOf(p.file);
  const match = posted.find((r) => r.hash === hash) ?? posted.find((r) => r.hash === null && mtime <= r.at) ?? null;
  const rev = match?.rev ?? posted.reduce((n, r) => Math.max(n, r.rev), 0) + 1;
  return { rev, hash, mtime, posted: match, earlier: posted.filter((r) => r.rev < rev) };
}

/** Record a posted revision in `posted.json` (written atomically, earlier entries kept). */
export function recordPosted(store: LedgerReader, p: RevisionPaths, r: PostedRevision): void {
  const list = postedRevisions(store, p).filter((x) => x.rev !== r.rev);
  list.push(r);
  list.sort((a, b) => a.rev - b.rev);
  mkdirSync(p.dir, { recursive: true });
  const tmp = `${postedFile(p)}.${process.pid}.tmp`;
  writeFileSync(tmp, `${JSON.stringify({ revisions: list }, null, 2)}\n`);
  renameSync(tmp, postedFile(p));
}

/** Write `posted.json` for a draft posted before revisions were tracked, before `post.json` is overwritten. */
export function materializeLegacy(store: LedgerReader, p: RevisionPaths): void {
  if (readOrNull(postedFile(p)) !== null) return;
  const legacy = postedRevisions(store, p);
  if (legacy.length) recordPosted(store, p, legacy[0] as PostedRevision);
}
