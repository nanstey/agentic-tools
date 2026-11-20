/**
 * Blocked records: why an Orca worktree is in the Blocked column and what must
 * be true to unblock it. orca-task-status writes a record when an agent sets
 * Blocked and removes it when the card leaves Blocked; prflow reads the records
 * each tick, evaluates the conditions, and moves the card out once they hold.
 *
 * All records live in one JSON file,
 * `${XDG_STATE_HOME:-~/.local/state}/agentic-tools/blocked.json`, keyed by
 * Orca worktree id. Writes take a short lock file and replace the file
 * atomically.
 */
import { closeSync, mkdirSync, openSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { defaultStateDir, readOrNull } from "./runtime.ts";
import type { CheckState } from "./task-status.ts";

/**
 * Unblock conditions. The set is deliberately small and machine-checkable:
 * - `checks-pass`: this branch's PR has no pending or failing required checks
 *   (every check when the repo marks none required).
 * - `pr-approved`: this branch's PR is approved.
 * - `pr-merged <owner/repo#n>`: another PR merged.
 * - `manual`: only a person unblocks it; prflow never moves the card.
 */
export type Condition =
  | { kind: "checks-pass" }
  | { kind: "pr-approved" }
  | { kind: "pr-merged"; repo: string; number: number }
  | { kind: "manual" };

export const CONDITION_KINDS = ["checks-pass", "pr-approved", "pr-merged", "manual"] as const;

const PR_REF = /^([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)#([1-9]\d{0,9})$/;

/** One `--until` value: `checks-pass`, `pr-approved`, `manual`, or `pr-merged <owner/repo#n>` (also `pr-merged=<ref>`). */
export function parseCondition(text: string): Condition {
  const [kind, arg, ...rest] = text.trim().split(/[\s=]+/);
  const usage = `expected one of checks-pass, pr-approved, manual, or "pr-merged <owner/repo#n>"`;
  if (rest.length) throw new Error(`unblock condition "${text}": too many arguments; ${usage}`);
  if (kind === "checks-pass" || kind === "pr-approved" || kind === "manual") {
    if (arg !== undefined && arg !== "") throw new Error(`unblock condition "${text}": ${kind} takes no argument`);
    return { kind };
  }
  if (kind === "pr-merged") {
    const m = PR_REF.exec(arg ?? "");
    if (!m?.[1] || !m[2]) throw new Error(`unblock condition "${text}": pr-merged needs <owner/repo#n>`);
    return { kind, repo: m[1], number: Number(m[2]) };
  }
  throw new Error(`unknown unblock condition "${text}"; ${usage}`);
}

export function formatCondition(c: Condition): string {
  return c.kind === "pr-merged" ? `pr-merged ${c.repo}#${c.number}` : c.kind;
}

/** Parse every `--until` value. At least one; `manual` stands alone; duplicates are dropped. */
export function parseConditions(values: readonly string[]): Condition[] {
  if (values.length === 0) throw new Error("at least one --until condition is required");
  const out: Condition[] = [];
  for (const v of values) {
    const c = parseCondition(v);
    if (!out.some((x) => formatCondition(x).toLowerCase() === formatCondition(c).toLowerCase())) out.push(c);
  }
  if (out.some((c) => c.kind === "manual") && out.length > 1) throw new Error("manual cannot be combined with other conditions");
  return out;
}

/**
 * True when the conditions only wait for this branch's CI (`checks-pass` alone).
 * Waiting for CI is In Review, not Blocked: orca-task-status `end` derives the
 * state from the PR instead, and prflow moves such a card out at once.
 */
export const waitsOnlyOnCi = (conditions: readonly Condition[]): boolean =>
  conditions.length > 0 && conditions.every((c) => c.kind === "checks-pass");

/** Longest accepted reason: it must fit one board comment line. */
export const MAX_REASON = 160;

/** A trimmed, single-line reason, or an error. */
export function parseReason(text: string | undefined): string {
  const r = (text ?? "").trim();
  if (!r) throw new Error("--reason is required and must not be empty");
  if (/[\x00-\x1f\x7f]/.test(r)) throw new Error("--reason must be one line with no control characters");
  if (r.length > MAX_REASON) throw new Error(`--reason must be at most ${MAX_REASON} characters`);
  return r;
}

/** Card comment for a Blocked worktree: `Blocked: <reason> · until: <conditions>`. */
export function blockedComment(reason: string, conditions: readonly Condition[]): string {
  return `Blocked: ${reason} · until: ${conditions.map(formatCondition).join(", ")}`;
}

/** Comments written by `blockedComment`; only these are cleared when a card leaves Blocked. */
export const isBlockedComment = (comment: string | null | undefined): boolean => (comment ?? "").startsWith("Blocked: ");

export interface BlockedRecord {
  /** Orca worktree id, `<repoId>::<path>`. */
  worktreeId: string;
  path: string;
  branch: string;
  /** `owner/repo` of the worktree's origin, when known. */
  repo: string | null;
  /** The branch PR number when it was set, else `null`. */
  pr: number | null;
  reason: string;
  /** Formatted conditions (`formatCondition`). */
  conditions: string[];
  /** ISO time the worktree was set Blocked; identifies this record. */
  setAt: string;
}

export interface BlockedFile {
  version: 1;
  records: Record<string, BlockedRecord>;
}

export function blockedStatePath(env: NodeJS.ProcessEnv = process.env, home?: string): string {
  return join(home === undefined ? defaultStateDir("agentic-tools", env) : defaultStateDir("agentic-tools", env, home), "blocked.json");
}

const empty = (): BlockedFile => ({ version: 1, records: {} });

function validRecord(v: unknown): v is BlockedRecord {
  if (typeof v !== "object" || v === null) return false;
  const r = v as Record<string, unknown>;
  if (typeof r.worktreeId !== "string" || typeof r.path !== "string" || typeof r.branch !== "string") return false;
  if (typeof r.reason !== "string" || typeof r.setAt !== "string" || !Array.isArray(r.conditions)) return false;
  if (r.repo !== null && typeof r.repo !== "string") return false;
  if (r.pr !== null && typeof r.pr !== "number") return false;
  try {
    parseConditions(r.conditions.map(String));
  } catch {
    return false;
  }
  return true;
}

/** Parse the file; invalid records are dropped. Throws on invalid JSON. */
export function parseBlockedFile(text: string | null): BlockedFile {
  if (text === null || !text.trim()) return empty();
  const raw = JSON.parse(text) as { records?: Record<string, unknown> };
  const out = empty();
  for (const [id, r] of Object.entries(raw.records ?? {})) if (validRecord(r) && r.worktreeId === id) out.records[id] = r;
  return out;
}

export function readBlocked(path: string): BlockedFile {
  return parseBlockedFile(readOrNull(path));
}

const LOCK_STALE_MS = 10_000;
const sleep = (ms: number) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

/** Read, change, and atomically rewrite the file under a short lock. */
export function updateBlocked(path: string, change: (f: BlockedFile) => void): BlockedFile {
  mkdirSync(dirname(path), { recursive: true });
  const lock = `${path}.lock`;
  for (let i = 0; ; i++) {
    try {
      closeSync(openSync(lock, "wx"));
      break;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
      let age = 0;
      try {
        age = Date.now() - statSync(lock).mtimeMs;
      } catch {
        continue;
      }
      if (age > LOCK_STALE_MS) rmSync(lock, { force: true });
      else if (i > 200) throw new Error(`${lock} is held by another process`);
      else sleep(25);
    }
  }
  try {
    const f = readBlocked(path);
    change(f);
    const tmp = `${path}.${process.pid}.tmp`;
    writeFileSync(tmp, `${JSON.stringify(f, null, 2)}\n`);
    renameSync(tmp, path);
    return f;
  } finally {
    rmSync(lock, { force: true });
  }
}

export function putBlocked(path: string, r: BlockedRecord): void {
  updateBlocked(path, (f) => {
    f.records[r.worktreeId] = r;
  });
}

/** Remove the record of `worktreeId`; with `setAt`, only that record (not a newer one). True when removed. */
export function clearBlocked(path: string, worktreeId: string, setAt?: string): boolean {
  let removed = false;
  if (readOrNull(path) === null) return false;
  updateBlocked(path, (f) => {
    const r = f.records[worktreeId];
    if (r && (setAt === undefined || r.setAt === setAt)) {
      delete f.records[worktreeId];
      removed = true;
    }
  });
  return removed;
}

// ---- evaluation ----

/** This branch's PR, as far as the conditions need it. */
export interface OwnPrFacts {
  number: number;
  state: "OPEN" | "CLOSED" | "MERGED";
  headSha: string;
  reviewDecision: string;
  /** Every check on the head. */
  checks: CheckState[];
  /** Checks the base branch requires; empty when none is marked required. */
  required: CheckState[];
}

export interface Facts {
  /** `null` when the branch has no PR. */
  pr: OwnPrFacts | null;
  /** State (`OPEN`, `CLOSED`, `MERGED`) of each `pr-merged` target, keyed by lowercased `owner/repo#n`. */
  others: Record<string, string>;
}

export interface Evaluation {
  /** Every condition holds. Never true for `manual`. */
  holds: boolean;
  /** What changed, per met condition, such as `checks passed at 1a2b3c4d`. */
  met: string[];
  /** Why each unmet condition does not hold yet. */
  unmet: string[];
  /** A condition that can no longer hold (for example the PR closed unmerged), else `null`. */
  stuck: string | null;
}

/** Evaluate `conditions` against fresh facts. Pure. */
export function evaluate(conditions: readonly Condition[], facts: Facts): Evaluation {
  const met: string[] = [];
  const unmet: string[] = [];
  let stuck: string | null = null;
  const pr = facts.pr;
  if (pr && pr.state !== "CLOSED" && waitsOnlyOnCi(conditions)) {
    const set = pr.required.length ? pr.required : pr.checks;
    const ci = set.includes("fail") ? "failing" : set.includes("pending") ? "pending" : "passed";
    const what = ci === "passed" ? `checks passed at ${pr.headSha.slice(0, 8)}` : `PR #${pr.number} checks ${ci}; waiting for CI is In Review, not Blocked`;
    return { holds: true, met: [what], unmet: [], stuck: null };
  }
  for (const c of conditions) {
    if (c.kind === "manual") {
      unmet.push("manual: only a person unblocks it");
      continue;
    }
    if (c.kind === "pr-merged") {
      const ref = `${c.repo}#${c.number}`;
      const state = facts.others[ref.toLowerCase()];
      if (state === "MERGED") met.push(`${ref} merged`);
      else {
        unmet.push(`${ref} is ${state ? state.toLowerCase() : "unknown"}`);
        if (state === "CLOSED") stuck ??= `${ref} closed without merging`;
      }
      continue;
    }
    if (!pr) {
      unmet.push(`${c.kind}: no PR for this branch`);
      continue;
    }
    if (pr.state === "CLOSED") stuck ??= `PR #${pr.number} closed without merging`;
    if (c.kind === "checks-pass") {
      const set = pr.required.length ? pr.required : pr.checks;
      const what = pr.required.length ? "required checks" : "checks";
      if (set.includes("fail")) unmet.push(`PR #${pr.number} has failing ${what}`);
      else if (set.includes("pending")) unmet.push(`PR #${pr.number} has pending ${what}`);
      else met.push(`checks passed at ${pr.headSha.slice(0, 8)}`);
    } else if (c.kind === "pr-approved") {
      if (pr.reviewDecision === "APPROVED") met.push(`PR #${pr.number} approved`);
      else unmet.push(`PR #${pr.number} is not approved (${(pr.reviewDecision || "no decision").toLowerCase()})`);
    }
  }
  return { holds: unmet.length === 0 && met.length > 0, met, unmet, stuck };
}
