/**
 * Parse the legacy automations' `dispatched.txt` files into ledger entries. Pure.
 *
 * - `pr-comment-watch/dispatched.txt`: `owner/repo#N@sha8:kind[:detail]`, where kind
 *   is ci, comments, behind, or merge (a legacy `rerun` line is reported as bad) and detail is the comment timestamp.
 * - `pr-watch/dispatched.txt`: `owner/repo#N@sha8`, one reviewer session per head.
 */
import type { Kind } from "../../../../../lib/pr/types.ts";

export type LegacySource = "pr-comment-watch" | "pr-watch";

export interface LegacyEntry {
  /** `legacy:<source>:<line>`, unique per entry, so imports are idempotent. */
  ref: string;
  source: LegacySource;
  item: string;
  /** Head sha prefix as the legacy tool recorded it. */
  version: string;
  kind: Kind;
  detail: string | null;
}

const LINE = /^([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+#\d+)@([0-9a-f]{7,40})(?::([a-z-]+)(?::(.+))?)?$/;

const COMMENT_KINDS: Record<string, Kind> = {
  ci: "ci",
  comments: "comments",
  behind: "behind",
  merge: "mergeable",
};

export function parseLegacy(source: LegacySource, text: string): { entries: LegacyEntry[]; bad: string[] } {
  const entries: LegacyEntry[] = [];
  const bad: string[] = [];
  const seen = new Set<string>();
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const m = LINE.exec(line);
    const tag = m?.[3];
    const kind: Kind | undefined =
      source === "pr-watch" ? (tag === undefined ? "review-requested" : undefined) : tag ? COMMENT_KINDS[tag] : undefined;
    if (!m?.[1] || !m[2] || !kind) {
      bad.push(line);
      continue;
    }
    const ref = `legacy:${source}:${line}`;
    if (seen.has(ref)) continue;
    seen.add(ref);
    entries.push({ ref, source, item: m[1], version: m[2], kind, detail: m[4] ?? null });
  }
  return { entries, bad };
}

/**
 * True when a legacy entry already covers this item, version, and kind: same item
 * (case-insensitive), same kind, the legacy sha prefix matches the head of
 * `version` (`headSha8-digest8`), and, when the legacy entry recorded a detail
 * (comment timestamp), the same detail.
 */
export function legacyCovers(
  e: Pick<LegacyEntry, "item" | "version" | "kind" | "detail">,
  item: string,
  version: string,
  kind: Kind,
  detail: string | null,
): boolean {
  const head = version.split("-")[0] ?? "";
  const n = Math.min(head.length, e.version.length);
  return (
    e.item.toLowerCase() === item.toLowerCase() &&
    e.kind === kind &&
    n >= 7 &&
    e.version.slice(0, n) === head.slice(0, n) &&
    (e.detail === null || e.detail === detail)
  );
}
