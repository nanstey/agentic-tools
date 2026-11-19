/**
 * Rails for `prflow tick`: caps, loop breaker, backoff, leases, and the dispatch
 * state machine. Pure; the store supplies counts and the clock.
 */
import type { Rails } from "./config.ts";

export type DispatchState = "planned" | "launched" | "working" | "done" | "failed" | "stale" | "abandoned";

export const OPEN_STATES: readonly DispatchState[] = ["planned", "launched", "working"];
export const isOpen = (s: DispatchState): boolean => OPEN_STATES.includes(s);

/**
 * Allowed transitions. `failed` and `stale` may go back to `planned` for a retry;
 * `done` and `abandoned` are final. `planned -> stale` covers a crash between
 * writing the row and recording the outcome of the side effect.
 */
const TRANSITIONS: Record<DispatchState, readonly DispatchState[]> = {
  planned: ["launched", "failed", "stale", "abandoned"],
  launched: ["working", "done", "failed", "stale", "abandoned"],
  working: ["done", "failed", "stale", "abandoned"],
  failed: ["planned", "abandoned"],
  stale: ["planned", "abandoned"],
  done: [],
  abandoned: [],
};

export const canTransition = (from: DispatchState, to: DispatchState): boolean => TRANSITIONS[from].includes(to);

export const HOUR_MS = 60 * 60 * 1000;
export const DAY_MS = 24 * HOUR_MS;
export const MINUTE_MS = 60 * 1000;

/** Start counts the caps and loop breaker look at. */
export interface StartCounts {
  /** Starts already made in this tick. */
  thisTick: number;
  /** Dispatches currently open. */
  open: number;
  lastHour: number;
  lastDay: number;
  /** Starts for this item and version in the last 24 hours. */
  sameVersion: number;
  /** Starts for this item across all versions in the last 24 hours. */
  acrossVersions: number;
}

export type Cap = "startsPerTick" | "maxOpen" | "perHour" | "perDay";

export type RailVerdict =
  | { ok: true }
  /** Global cap reached: defer the start, the item stays eligible. */
  | { ok: false; rail: "cap"; cap: Cap; limit: number }
  /** Loop breaker: pause the item. */
  | { ok: false; rail: "loop"; reason: string };

/** Decide whether one more start is allowed. The loop breaker wins over caps. */
export function checkStart(r: Rails, c: StartCounts): RailVerdict {
  if (c.sameVersion >= r.loopSameVersion)
    return { ok: false, rail: "loop", reason: `${c.sameVersion} starts for this version in 24h (limit ${r.loopSameVersion})` };
  if (c.acrossVersions >= r.loopAcrossVersions)
    return { ok: false, rail: "loop", reason: `${c.acrossVersions} starts across versions in 24h (limit ${r.loopAcrossVersions})` };
  const caps: [Cap, number, number][] = [
    ["startsPerTick", c.thisTick, r.startsPerTick],
    ["maxOpen", c.open, r.maxOpen],
    ["perHour", c.lastHour, r.perHour],
    ["perDay", c.lastDay, r.perDay],
  ];
  for (const [cap, n, limit] of caps) if (n >= limit) return { ok: false, rail: "cap", cap, limit };
  return { ok: true };
}

/** Window id a cap trip is announced once per, so a full cap does not repeat every tick. */
export function capWindow(cap: Cap, now: number, tickId: number): string {
  if (cap === "perHour") return `${cap}:${Math.floor(now / HOUR_MS)}`;
  if (cap === "perDay") return `${cap}:${Math.floor(now / DAY_MS)}`;
  return `${cap}:${tickId}`;
}

/** Delay before the next tick after `failures` consecutive failed ticks (0 when none). */
export function backoffMs(r: Rails, failures: number): number {
  if (failures <= 0) return 0;
  const minutes = Math.min(r.backoffBaseMinutes * 2 ** Math.min(failures - 1, 20), r.backoffMaxMinutes);
  return minutes * MINUTE_MS;
}

export const leaseUntil = (r: Rails, now: number): number => now + r.leaseMinutes * MINUTE_MS;

/** An open dispatch whose lease ran out (planned rows use their last update time). */
export function leaseExpired(
  r: Rails,
  d: { state: DispatchState; leaseUntil: number | null; updatedAt: number },
  now: number,
): boolean {
  if (!isOpen(d.state)) return false;
  const until = d.leaseUntil ?? d.updatedAt + r.leaseMinutes * MINUTE_MS;
  return now > until;
}
