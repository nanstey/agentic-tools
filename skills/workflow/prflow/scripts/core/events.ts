/** `events.jsonl` records: the orchestration layer's view of every prflow state change. */

export type EventType =
  | "dispatched"
  | "nudged"
  /** A busy Pi session was stopped with Escape so it can take the brief. */
  | "interrupted"
  | "recovered"
  | "session-finished"
  | "session-stale"
  | "abandoned"
  | "rerun"
  | "archived"
  | "docs-committed"
  | "paused"
  | "resumed"
  | "rail-tripped"
  /** An action failed; the dispatch is `failed`. */
  | "action-failed"
  /** prflow will not act and asks the user to decide (for example a dirty worktree). */
  | "needs-decision"
  /** Dry run: the action prflow would take. */
  | "dry-run"
  /** A reviewer session started in its own review worktree. */
  | "review-started"
  /** A reviewer session saved its draft review (draft id, verdict suggestion, comment count, path). */
  | "review-drafted"
  /** `prflow review post` published a draft to GitHub (never from tick). */
  | "review-posted";

export interface PrflowEvent {
  /** ISO timestamp. */
  ts: string;
  type: EventType;
  /** Item key `owner/repo#number`, `null` for system-wide events. */
  item: string | null;
  version: string | null;
  kind: string | null;
  dispatchId: number | null;
  sessionHandle: string | null;
  detail: string | null;
}

export type EventInput = Pick<PrflowEvent, "type"> & Partial<Omit<PrflowEvent, "type" | "ts">>;

export function makeEvent(now: number, e: EventInput): PrflowEvent {
  return {
    ts: new Date(now).toISOString(),
    type: e.type,
    item: e.item ?? null,
    version: e.version ?? null,
    kind: e.kind ?? null,
    dispatchId: e.dispatchId ?? null,
    sessionHandle: e.sessionHandle ?? null,
    detail: e.detail ?? null,
  };
}

/** One feed line, e.g. `- 2026-01-10 12:00Z rail-tripped A/x#1 rerun: loop breaker ...`. */
export function renderEvent(e: PrflowEvent): string {
  const ts = e.ts.slice(0, 16).replace("T", " ") + "Z";
  const subject = [e.item ?? "prflow", e.kind, e.dispatchId !== null ? `#${e.dispatchId}` : null].filter(Boolean).join(" ");
  return `- ${ts} ${e.type} ${subject}${e.detail ? `: ${e.detail}` : ""}`;
}

/** Parse JSONL text; malformed lines are skipped and counted. */
export function parseEvents(text: string): { events: PrflowEvent[]; bad: number } {
  const events: PrflowEvent[] = [];
  let bad = 0;
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    try {
      events.push(JSON.parse(line) as PrflowEvent);
    } catch {
      bad++;
    }
  }
  return { events, bad };
}
