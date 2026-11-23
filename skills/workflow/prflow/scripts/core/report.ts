import { rank } from "./classify.ts";
import type { Classification, Kind } from "./types.ts";

/** Report groups, most urgent first. Phase 1 has no sessions, so "In flight" is always empty. */
export const GROUPS: readonly { title: string; kinds: readonly Kind[] }[] = [
  { title: "Needs your decision", kinds: ["mergeable"] },
  { title: "Ready to act", kinds: ["ci", "comments", "behind", "review-requested"] },
  { title: "Blocked on others", kinds: ["waiting"] },
  { title: "Cleanup", kinds: ["cleanup"] },
];

/** Priority order: kind, then low-priority review requests last, then repo and number. */
export function sortItems(items: Classification[]): Classification[] {
  return [...items].sort(
    (a, b) => rank(a.kind) - rank(b.kind) || Number(a.lowPriority ?? false) - Number(b.lowPriority ?? false) || a.repo.localeCompare(b.repo) || a.number - b.number,
  );
}

/**
 * One report row. `showAccount` adds the GitHub account when several are
 * configured; `changed` says what changed since the last printed report.
 */
export function row(c: Classification, showAccount = false, changed: string | null = null): string {
  const acct = showAccount ? ` | account: ${c.account}` : "";
  const notes = (c.notes ?? []).map((n) => ` | note: ${n}`).join("");
  const diff = changed ? ` | changed: ${changed}` : "";
  return `- ${c.repo}#${c.number} ${JSON.stringify(c.title)} | ${c.kind}: ${c.status}${diff} | next: ${c.nextAction} | owner: ${c.owner}${acct}${notes}`;
}

/**
 * Own draft PRs are scanned only so an open dispatch can follow a PR that its
 * session drafted; they are not report rows, as before drafts were scanned.
 */
export const shown = (items: Classification[]): Classification[] => items.filter((c) => !(c.role === "author" && c.isDraft));

/** JSON plan output follows the same visibility rule as text reports. */
export const renderPlanJson = (items: Classification[]): string => JSON.stringify(shown(items), null, 2);

/** Text report grouped by status and next action. Empty groups are omitted. */
export function renderReport(all: Classification[]): string {
  const items = shown(all);
  const showAccount = new Set(items.map((c) => c.account)).size > 1;
  const out: string[] = [];
  for (const g of GROUPS) {
    const rows = sortItems(items.filter((c) => g.kinds.includes(c.kind)));
    if (rows.length === 0) continue;
    out.push(`## ${g.title} (${rows.length})`, ...rows.map((c) => row(c, showAccount)), "");
  }
  return out.length ? out.join("\n").trimEnd() : "Nothing to report.";
}

/** Extra tick rows: open dispatches and paused items, already rendered. */
export interface TickExtras {
  inFlight: string[];
  paused: string[];
  /** What changed per item key (lowercase) since the last printed report. */
  changes?: Map<string, string>;
}

/** What a printed report showed for one item. */
export interface SeenRow {
  version: string;
  title: string;
  kind: string;
  checksPending: boolean;
}

/** Rows of a printed report by lowercase item key. */
export type Snapshot = Record<string, SeenRow>;

export function snapshotOf(items: Classification[]): Snapshot {
  const out: Snapshot = {};
  for (const c of shown(items)) out[c.key.toLowerCase()] = { version: c.version, title: c.title, kind: c.kind, checksPending: c.checksPending ?? false };
  return out;
}

const PR_VERSION = /^([0-9a-f]{8})-([0-9a-f]{8})$/;

/**
 * What changed in a row since the last printed report: a new head, new
 * comments or reviews, a new title, another kind, or finished checks. `null`
 * when nothing did, or when there is no earlier report; `new` for a row the
 * last report did not have.
 */
export function changeNote(prev: Snapshot | null, c: Classification): string | null {
  if (prev === null) return null;
  const p = prev[c.key.toLowerCase()];
  if (!p) return "new";
  const bits: string[] = [];
  const a = PR_VERSION.exec(p.version);
  const b = PR_VERSION.exec(c.version);
  if (a && b) {
    if (a[1] !== b[1]) bits.push(`new head ${b[1]}`);
    else if (a[2] !== b[2]) bits.push("new comments or reviews");
  } else if (p.version !== c.version) bits.push(`now ${c.version}`);
  if (p.title !== c.title) bits.push("retitled");
  if (p.kind !== c.kind) bits.push(`was ${p.kind}`);
  if (p.checksPending && !c.checksPending) bits.push("checks finished");
  return bits.length ? bits.join(", ") : null;
}

/**
 * Change fingerprint of the tick report's items. Like the watch fingerprint,
 * but a PR whose checks are still running keeps the head the last printed
 * report showed: a new head alone does not reprint the report until its checks
 * finish (new comments still do). A review request the last report showed, now
 * waiting only for its required checks on a new head, still counts as that
 * review request.
 */
export function tickFingerprint(actionable: Classification[], waiting: Classification[], prev: Snapshot | null): string {
  const line = (c: Classification, kind: string) => {
    const m = PR_VERSION.exec(c.version);
    const shownHead = PR_VERSION.exec(prev?.[c.key.toLowerCase()]?.version ?? "")?.[1];
    const v = c.checksPending && m ? `${shownHead ?? m[1]}-${m[2]}` : c.version;
    return [c.key, kind, v, ...c.triggers.map((t) => `${t.kind}:${t.detail ?? ""}`)].join(" ");
  };
  const sticky = waiting.filter((c) => c.role === "reviewer" && c.checksPending && prev?.[c.key.toLowerCase()]?.kind === "review-requested");
  return [...shown(actionable).map((c) => line(c, c.kind)), ...shown(sticky).map((c) => line(c, "review-requested"))].sort().join("\n");
}

/** A review request whose draft is ready for the user's decision. */
const decided = (c: Classification) => c.kind === "review-requested" && c.owner === "you";

/**
 * `prflow tick` report: the watch report plus paused items (under Needs your
 * decision) and open dispatches (In flight). Group order: Needs your decision,
 * Ready to act, In flight, Blocked on others, Cleanup. Empty string when there is
 * nothing to show.
 */
export function renderTickReport(all: Classification[], x: TickExtras): string {
  const items = shown(all);
  const showAccount = new Set(items.map((c) => c.account)).size > 1;
  const render = (list: Classification[]) => sortItems(list).map((c) => row(c, showAccount, x.changes?.get(c.key.toLowerCase()) ?? null));
  const rows = (kinds: readonly Kind[]) => render(items.filter((c) => kinds.includes(c.kind) && !decided(c)));
  const sections: [string, string[]][] = [
    ["Needs your decision", [...rows(["mergeable"]), ...render(items.filter(decided)), ...x.paused]],
    ["Ready to act", rows(["ci", "comments", "behind", "review-requested"])],
    ["In flight", x.inFlight],
    ["Blocked on others", rows(["waiting"])],
    ["Cleanup", rows(["cleanup"])],
  ];
  const out: string[] = [];
  for (const [title, lines] of sections) if (lines.length) out.push(`## ${title} (${lines.length})`, ...lines, "");
  return out.join("\n").trimEnd();
}
