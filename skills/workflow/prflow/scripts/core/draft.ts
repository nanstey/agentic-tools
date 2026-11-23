/**
 * Review drafts: where a reviewer session writes its draft and how prflow parses it. Pure.
 *
 * Layout: `<state>/drafts/<owner>-<repo>-<n>/<head8>/review.md`, written by the
 * reviewer session, beside `meta.json`, written by prflow before the session
 * starts. Draft id: `<owner>-<repo>-<n>-<head8>`.
 */

export type Verdict = "approve" | "request-changes" | "comment";
export const VERDICTS: readonly Verdict[] = ["approve", "request-changes", "comment"];

/** First line of every draft. */
export const DRAFT_HEADER = "<!-- prflow review draft v1 -->";

const NAME = /^[A-Za-z0-9_.-]+$/;

/** `<owner>-<repo>-<n>`: the per-PR draft folder. */
export function draftFolder(repo: string, number: number): string {
  const parts = repo.split("/");
  const [owner, name] = parts;
  if (parts.length !== 2 || !owner || !name || !NAME.test(owner) || !NAME.test(name) || !Number.isSafeInteger(number) || number < 1) throw new Error(`bad PR ${repo}#${number}`);
  return `${owner}-${name}-${number}`;
}

export const draftId = (repo: string, number: number, head8: string): string => `${draftFolder(repo, number)}-${head8}`;

/** Folder and head of a draft id; `null` when malformed. */
export function parseDraftId(id: string): { folder: string; head8: string } | null {
  const m = /^([A-Za-z0-9_.-]+-[1-9]\d{0,9})-([0-9a-f]{8})$/.exec(id);
  if (!m?.[1] || !m[2] || m[1].includes("..")) return null;
  return { folder: m[1], head8: m[2] };
}

/** Facts prflow records beside a draft before the reviewer starts. */
export interface DraftMeta {
  id: string;
  item: string;
  repo: string;
  number: number;
  url: string;
  title: string;
  /** Full head sha the review is for; the posted review is pinned to it. */
  headSha: string;
  /** GitHub login whose token posts the review. */
  account: string;
  dispatchId: number;
  createdAt: string;
}

export interface InlineComment {
  path: string;
  line: number;
  /** First line of a multi-line comment. */
  startLine: number | null;
  body: string;
}

export interface Draft {
  verdict: Verdict | null;
  summary: string;
  comments: InlineComment[];
  /** Draft parsing errors; empty when the draft is valid. */
  errors: string[];
}

const LOCATION = /^`?([^`\s:][^`:]*):(\d+)(?:-(\d+))?`?$/;

/**
 * Parse a draft. Sections: `Verdict: <approve|request-changes|comment>`,
 * `## Summary` (the review body), `## Inline comments` with one
 * `### <path>:<line>` or `### <path>:<start>-<end>` heading per comment, and
 * optional `## Notes for Noel` and `## Packet` sections, which parsing ignores.
 */
export function parseDraft(text: string): Draft {
  const errors: string[] = [];
  if (!text.startsWith(DRAFT_HEADER)) errors.push(`first line must be ${DRAFT_HEADER}`);
  // Only the header (before the first `## ` section) holds the verdict; a verbatim packet may quote other `Verdict:` lines.
  const head = text.split(/^## +/m)[0] ?? "";
  const v = /^Verdict:\s*(\S+)\s*$/m.exec(head)?.[1]?.toLowerCase();
  const verdict = (VERDICTS as readonly string[]).includes(v ?? "") ? (v as Verdict) : null;
  if (!verdict) errors.push("missing or unknown Verdict line (approve, request-changes, or comment)");
  const sections = new Map<string, string>();
  const parts = text.split(/^## +/m).slice(1);
  let inPacket = false;
  for (const p of parts) {
    const nl = p.indexOf("\n");
    const title = (nl < 0 ? p : p.slice(0, nl)).trim().toLowerCase();
    if (title === "packet") {
      inPacket = true;
      continue;
    }
    if (!inPacket && (title === "summary" || title === "inline comments")) sections.set(title, nl < 0 ? "" : p.slice(nl + 1));
  }
  const summary = (sections.get("summary") ?? "").trim();
  if (!summary) errors.push("empty or missing ## Summary");
  const comments: InlineComment[] = [];
  const inline = sections.get("inline comments") ?? "";
  for (const block of inline.split(/^### +/m).slice(1)) {
    const nl = block.indexOf("\n");
    const head = (nl < 0 ? block : block.slice(0, nl)).trim();
    const body = (nl < 0 ? "" : block.slice(nl + 1)).trim();
    const m = LOCATION.exec(head);
    const line = Number(m?.[3] ?? m?.[2]);
    const start = m?.[3] ? Number(m[2]) : null;
    if (!m?.[1] || !Number.isSafeInteger(line) || line < 1 || (start !== null && start >= line)) {
      errors.push(`inline comment heading "${head}" is not <path>:<line> or <path>:<start>-<end>`);
      continue;
    }
    if (!body) {
      errors.push(`inline comment ${head} has no text`);
      continue;
    }
    comments.push({ path: m[1].trim(), line, startLine: start, body });
  }
  return { verdict, summary, comments, errors };
}

/** One-line summary for events and lists. */
export function draftSummary(id: string, d: Draft, path: string): string {
  const n = d.comments.length;
  return `draft ${id}: verdict suggestion ${d.verdict ?? "unknown"}, ${n} inline comment${n === 1 ? "" : "s"}${d.errors.length ? ` (invalid: ${d.errors.join("; ")})` : ""}, ${path}`;
}
