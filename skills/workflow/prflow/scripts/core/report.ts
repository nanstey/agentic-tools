import { rank } from "./classify.ts";
import type { Classification, Kind } from "./types.ts";

/** Report groups, most urgent first. Phase 1 has no sessions, so "In flight" is always empty. */
export const GROUPS: readonly { title: string; kinds: readonly Kind[] }[] = [
  { title: "Needs your decision", kinds: ["merge-ready"] },
  { title: "Ready to act", kinds: ["rerun", "ci", "comments", "behind", "review-requested"] },
  { title: "Blocked on others", kinds: ["waiting"] },
  { title: "Cleanup", kinds: ["cleanup"] },
];

export function sortItems(items: Classification[]): Classification[] {
  return [...items].sort(
    (a, b) => rank(a.kind) - rank(b.kind) || a.repo.localeCompare(b.repo) || a.number - b.number,
  );
}

/** One report row. `showAccount` adds the GitHub account when several are configured. */
export function row(c: Classification, showAccount = false): string {
  const acct = showAccount ? ` | account: ${c.account}` : "";
  return `- ${c.repo}#${c.number} ${JSON.stringify(c.title)} | ${c.kind}: ${c.status} | next: ${c.nextAction} | owner: ${c.owner}${acct}`;
}

/** Text report grouped by status and next action. Empty groups are omitted. */
export function renderReport(items: Classification[]): string {
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
}

/**
 * `prflow tick` report: the watch report plus paused items (under Needs your
 * decision) and open dispatches (In flight). Group order: Needs your decision,
 * Ready to act, In flight, Blocked on others, Cleanup. Empty string when there is
 * nothing to show.
 */
export function renderTickReport(items: Classification[], x: TickExtras): string {
  const showAccount = new Set(items.map((c) => c.account)).size > 1;
  const rows = (kinds: readonly Kind[]) => sortItems(items.filter((c) => kinds.includes(c.kind))).map((c) => row(c, showAccount));
  const sections: [string, string[]][] = [
    ["Needs your decision", [...rows(["merge-ready"]), ...x.paused]],
    ["Ready to act", rows(["rerun", "ci", "comments", "behind", "review-requested"])],
    ["In flight", x.inFlight],
    ["Blocked on others", rows(["waiting"])],
    ["Cleanup", rows(["cleanup"])],
  ];
  const out: string[] = [];
  for (const [title, lines] of sections) if (lines.length) out.push(`## ${title} (${lines.length})`, ...lines, "");
  return out.join("\n").trimEnd();
}
