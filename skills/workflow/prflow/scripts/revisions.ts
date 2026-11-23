/** Read legacy draft revision history and assign a revision to saved draft text. */
import { createHash } from "node:crypto";
import { statSync } from "node:fs";
import { join } from "node:path";
import { readOrNull } from "../../../../lib/runtime.ts";

export interface RevisionPaths {
  id: string;
  dir: string;
  file: string;
}

export interface PostedRevision {
  rev: number;
  hash: string | null;
  event: string;
  at: number;
  comments: string[];
}

export interface Revision {
  rev: number;
  hash: string;
  mtime: number;
  posted: PostedRevision | null;
  earlier: PostedRevision[];
}

type LedgerReader = { ledgerAt(ref: string): number | null };

export const textHash = (text: string): string => createHash("sha256").update(text).digest("hex");
const postedRef = (id: string): string => `review-posted:${id}`;
const postedFile = (p: RevisionPaths) => join(p.dir, "posted.json");

/** Existing revision history, oldest first. */
function postedRevisions(store: LedgerReader, p: RevisionPaths): PostedRevision[] {
  const raw = readOrNull(postedFile(p));
  if (raw !== null) {
    try {
      const list = (JSON.parse(raw) as { revisions?: PostedRevision[] }).revisions ?? [];
      return list.filter((r) => Number.isSafeInteger(r.rev) && r.rev > 0).sort((a, b) => a.rev - b.rev);
    } catch {
      // Damaged history falls back to the legacy ledger row.
    }
  }
  const at = store.ledgerAt(postedRef(p.id));
  return at === null ? [] : [{ rev: 1, hash: null, event: "", at, comments: [] }];
}

function mtimeOf(file: string): number {
  try { return statSync(file).mtimeMs; } catch { return 0; }
}

/** Which legacy revision the saved text matches, or its next revision number. */
export function draftRevision(store: LedgerReader, p: RevisionPaths, text: string): Revision {
  const history = postedRevisions(store, p);
  const hash = textHash(text);
  const mtime = mtimeOf(p.file);
  const posted = history.find((r) => r.hash === hash) ?? history.find((r) => r.hash === null && mtime <= r.at) ?? null;
  const rev = posted?.rev ?? history.reduce((n, r) => Math.max(n, r.rev), 0) + 1;
  return { rev, hash, mtime, posted, earlier: history.filter((r) => r.rev < rev) };
}
