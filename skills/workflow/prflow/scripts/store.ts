/**
 * prflow state in one directory (default `${XDG_STATE_HOME:-~/.local/state}/prflow/`):
 *
 * - `prflow.db` (SQLite): items, dispatches, sessions, runs, ledger, meta (including the tick lock).
 * - `paused`: present while the whole system is paused (contains the reason).
 * - `events.jsonl`: append-only event feed for the orchestration layer.
 *
 * Every write that precedes an external side effect is committed before this
 * module returns, so a crash leaves a row the next tick can reconcile.
 */
import { appendFileSync, closeSync, mkdirSync, openSync, readFileSync, readSync, rmSync, statSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { homedir } from "node:os";
import { join } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { makeEvent, parseEvents, type EventInput, type PrflowEvent } from "./core/events.ts";
import { canTransition, OPEN_STATES, type DispatchState } from "./core/rails.ts";
import type { Classification } from "./core/types.ts";

/** Load `node:sqlite` without its one-time ExperimentalWarning on stderr. */
function loadSqlite(): typeof import("node:sqlite") {
  const emit = process.emitWarning;
  process.emitWarning = ((warning: string | Error, ...rest: unknown[]) => {
    if (String(warning instanceof Error ? warning.message : warning).includes("SQLite")) return;
    (emit as (...a: unknown[]) => void).call(process, warning, ...rest);
  }) as typeof process.emitWarning;
  try {
    return createRequire(import.meta.url)("node:sqlite") as typeof import("node:sqlite");
  } finally {
    process.emitWarning = emit;
  }
}

export function defaultStateDir(env: NodeJS.ProcessEnv = process.env, home = homedir()): string {
  return join(env.XDG_STATE_HOME || join(home, ".local", "state"), "prflow");
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS items (
  key TEXT PRIMARY KEY COLLATE NOCASE,
  account TEXT, kind TEXT, version TEXT, title TEXT, url TEXT, status TEXT,
  next_action TEXT, owner TEXT, last_seen INTEGER,
  paused INTEGER NOT NULL DEFAULT 0, paused_reason TEXT, paused_at INTEGER
);
CREATE TABLE IF NOT EXISTS dispatches (
  id INTEGER PRIMARY KEY,
  item TEXT NOT NULL COLLATE NOCASE, version TEXT NOT NULL, kind TEXT NOT NULL,
  state TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
  lease_until INTEGER, session_handle TEXT, detail TEXT,
  UNIQUE (item, version, kind)
);
CREATE TABLE IF NOT EXISTS sessions (
  handle TEXT PRIMARY KEY, item TEXT COLLATE NOCASE, dispatch_id INTEGER,
  created_at INTEGER, last_output_at INTEGER, state TEXT
);
CREATE TABLE IF NOT EXISTS runs (
  id INTEGER PRIMARY KEY, started_at INTEGER NOT NULL, finished_at INTEGER,
  ok INTEGER, dry_run INTEGER NOT NULL DEFAULT 1, items INTEGER, events INTEGER, error TEXT
);
CREATE TABLE IF NOT EXISTS ledger (
  id INTEGER PRIMARY KEY, at INTEGER NOT NULL,
  item TEXT NOT NULL COLLATE NOCASE, version TEXT NOT NULL, kind TEXT NOT NULL,
  outcome TEXT NOT NULL, detail TEXT, dispatch_id INTEGER, source TEXT NOT NULL,
  ref TEXT UNIQUE
);
CREATE INDEX IF NOT EXISTS ledger_item ON ledger (item, outcome, at);
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT);
`;

export interface Dispatch {
  id: number;
  item: string;
  version: string;
  kind: string;
  state: DispatchState;
  attempts: number;
  createdAt: number;
  updatedAt: number;
  leaseUntil: number | null;
  sessionHandle: string | null;
  detail: string | null;
}

export interface ItemRow {
  key: string;
  account: string | null;
  kind: string | null;
  version: string | null;
  title: string | null;
  url: string | null;
  status: string | null;
  nextAction: string | null;
  owner: string | null;
  lastSeen: number | null;
  paused: boolean;
  pausedReason: string | null;
  pausedAt: number | null;
}

export interface RunRow {
  id: number;
  startedAt: number;
  finishedAt: number | null;
  ok: boolean | null;
  dryRun: boolean;
  items: number | null;
  events: number | null;
  error: string | null;
}

export interface LedgerInput {
  at: number;
  item: string;
  version: string;
  kind: string;
  outcome: string;
  detail?: string | null;
  dispatchId?: number | null;
  source: string;
  /** Unique reference; a second insert with the same ref is ignored. */
  ref?: string | null;
}

type Row = Record<string, unknown>;
const num = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));
const str = (v: unknown): string | null => (v === null || v === undefined ? null : String(v));

function toDispatch(r: Row): Dispatch {
  return {
    id: Number(r.id),
    item: String(r.item),
    version: String(r.version),
    kind: String(r.kind),
    state: String(r.state) as DispatchState,
    attempts: Number(r.attempts),
    createdAt: Number(r.created_at),
    updatedAt: Number(r.updated_at),
    leaseUntil: num(r.lease_until),
    sessionHandle: str(r.session_handle),
    detail: str(r.detail),
  };
}

function toItem(r: Row): ItemRow {
  return {
    key: String(r.key),
    account: str(r.account),
    kind: str(r.kind),
    version: str(r.version),
    title: str(r.title),
    url: str(r.url),
    status: str(r.status),
    nextAction: str(r.next_action),
    owner: str(r.owner),
    lastSeen: num(r.last_seen),
    paused: Number(r.paused) === 1,
    pausedReason: str(r.paused_reason),
    pausedAt: num(r.paused_at),
  };
}

function toRun(r: Row): RunRow {
  return {
    id: Number(r.id),
    startedAt: Number(r.started_at),
    finishedAt: num(r.finished_at),
    ok: r.ok === null ? null : Number(r.ok) === 1,
    dryRun: Number(r.dry_run) === 1,
    items: num(r.items),
    events: num(r.events),
    error: str(r.error),
  };
}

/** A lock whose process is still alive is taken over only after this (a hung tick). */
export const LOCK_HUNG_MS = 6 * 60 * 60 * 1000;
/** `meta` key of the tick lock: `<pid> <taken at ms> <uuid>`. */
export const LOCK_KEY = "tick_lock";

/** True when `pid` names a running process (EPERM: running, owned by someone else). */
function pidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return (e as NodeJS.ErrnoException).code === "EPERM";
  }
}

/** Whether the lock `value` belongs to a dead or hung tick at `now`. */
export function lockStale(value: string, now: number): boolean {
  const [pid, at] = value.split(" ").map(Number);
  if (!pid || !Number.isInteger(pid) || pid <= 0 || at === undefined || !Number.isFinite(at)) return true;
  return !pidAlive(pid) || now - at >= LOCK_HUNG_MS;
}

export class Store {
  readonly dir: string;
  readonly db: DatabaseSync;

  private constructor(dir: string, db: DatabaseSync) {
    this.dir = dir;
    this.db = db;
  }

  static open(dir: string): Store {
    mkdirSync(dir, { recursive: true });
    const { DatabaseSync } = loadSqlite();
    const db = new DatabaseSync(join(dir, "prflow.db"));
    db.exec("PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;");
    db.exec(SCHEMA);
    return new Store(dir, db);
  }

  close(): void {
    this.db.close();
  }

  path(name: "paused" | "events.jsonl"): string {
    return join(this.dir, name);
  }

  // ---- meta ----

  getMeta(key: string): string | null {
    const r = this.db.prepare("SELECT value FROM meta WHERE key = ?").get(key) as Row | undefined;
    return r ? str(r.value) : null;
  }

  setMeta(key: string, value: string): void {
    this.db.prepare("INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value").run(key, value);
  }

  // ---- lock ----

  /** Value of the lock this store holds, so `unlock` never releases another tick's lock. */
  private lockToken: string | null = null;

  /**
   * Take the tick lock (`meta.tick_lock`); `false` if another live tick holds it.
   * Check and take run in one `BEGIN IMMEDIATE` transaction, so two ticks can
   * never both take it. A lock is taken over when its process is gone or after
   * `LOCK_HUNG_MS`.
   */
  tryLock(now: number): boolean {
    const token = `${process.pid} ${now} ${randomUUID()}`;
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const cur = this.getMeta(LOCK_KEY);
      if (cur !== null && !lockStale(cur, now)) {
        this.db.exec("COMMIT");
        return false;
      }
      this.setMeta(LOCK_KEY, token);
      this.db.exec("COMMIT");
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
    this.lockToken = token;
    return true;
  }

  unlock(): void {
    if (this.lockToken !== null) this.db.prepare("DELETE FROM meta WHERE key = ? AND value = ?").run(LOCK_KEY, this.lockToken);
    this.lockToken = null;
  }

  // ---- pause ----

  /** Reason the whole system is paused, or `null`. */
  systemPaused(): string | null {
    try {
      return readFileSync(this.path("paused"), "utf8").trim() || "paused";
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw e;
    }
  }

  setSystemPaused(reason: string | null): void {
    if (reason === null) rmSync(this.path("paused"), { force: true });
    else writeFileSync(this.path("paused"), `${reason}\n`);
  }

  // ---- events ----

  appendEvent(now: number, e: EventInput): PrflowEvent {
    const ev = makeEvent(now, e);
    appendFileSync(this.path("events.jsonl"), `${JSON.stringify(ev)}\n`);
    return ev;
  }

  /** Events from byte `offset` to the end of `events.jsonl`, and the new end offset. */
  readEventsFrom(offset: number): { events: PrflowEvent[]; offset: number } {
    const path = this.path("events.jsonl");
    let size: number;
    try {
      size = statSync(path).size;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return { events: [], offset: 0 };
      throw e;
    }
    // The file was truncated or replaced: start over from the beginning.
    const start = offset > size ? 0 : offset;
    if (start === size) return { events: [], offset: size };
    const buf = Buffer.alloc(size - start);
    const fd = openSync(path, "r");
    try {
      readSync(fd, buf, 0, buf.length, start);
    } finally {
      closeSync(fd);
    }
    // Only consume complete lines; a partial last line is read next time.
    const text = buf.toString("utf8");
    const end = text.lastIndexOf("\n") + 1;
    return { events: parseEvents(text.slice(0, end)).events, offset: start + Buffer.byteLength(text.slice(0, end)) };
  }

  // ---- items ----

  upsertItems(items: Classification[], now: number): void {
    const st = this.db.prepare(`INSERT INTO items (key, account, kind, version, title, url, status, next_action, owner, last_seen)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (key) DO UPDATE SET account = excluded.account, kind = excluded.kind, version = excluded.version,
        title = excluded.title, url = excluded.url, status = excluded.status, next_action = excluded.next_action,
        owner = excluded.owner, last_seen = excluded.last_seen`);
    this.db.exec("BEGIN");
    try {
      for (const c of items) st.run(c.key, c.account, c.kind, c.version, c.title, c.url, c.status, c.nextAction, c.owner, now);
      this.db.exec("COMMIT");
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }

  item(key: string): ItemRow | null {
    const r = this.db.prepare("SELECT * FROM items WHERE key = ?").get(key) as Row | undefined;
    return r ? toItem(r) : null;
  }

  items(): ItemRow[] {
    return (this.db.prepare("SELECT * FROM items ORDER BY key").all() as Row[]).map(toItem);
  }

  /** Items seen by the latest successful scan at `seenAt`, plus every paused item. */
  currentItems(seenAt: number): ItemRow[] {
    return (this.db.prepare("SELECT * FROM items WHERE last_seen = ? OR paused = 1 ORDER BY key").all(seenAt) as Row[]).map(toItem);
  }

  /** Pause one item. Returns `false` when it was already paused. */
  pauseItem(key: string, reason: string, now: number): boolean {
    this.db.prepare("INSERT INTO items (key) VALUES (?) ON CONFLICT (key) DO NOTHING").run(key);
    const r = this.db.prepare("UPDATE items SET paused = 1, paused_reason = ?, paused_at = ? WHERE key = ? AND paused = 0").run(reason, now, key);
    return Number(r.changes) > 0;
  }

  /** Resume one item. Returns `false` when it was not paused. */
  resumeItem(key: string): boolean {
    const r = this.db.prepare("UPDATE items SET paused = 0, paused_reason = NULL, paused_at = NULL WHERE key = ? AND paused = 1").run(key);
    return Number(r.changes) > 0;
  }

  pausedItems(): ItemRow[] {
    return (this.db.prepare("SELECT * FROM items WHERE paused = 1 ORDER BY key").all() as Row[]).map(toItem);
  }

  // ---- dispatches ----

  dispatch(id: number): Dispatch | null {
    const r = this.db.prepare("SELECT * FROM dispatches WHERE id = ?").get(id) as Row | undefined;
    return r ? toDispatch(r) : null;
  }

  findDispatch(item: string, version: string, kind: string): Dispatch | null {
    const r = this.db.prepare("SELECT * FROM dispatches WHERE item = ? AND version = ? AND kind = ?").get(item, version, kind) as Row | undefined;
    return r ? toDispatch(r) : null;
  }

  openDispatches(): Dispatch[] {
    const marks = OPEN_STATES.map(() => "?").join(", ");
    return (this.db.prepare(`SELECT * FROM dispatches WHERE state IN (${marks}) ORDER BY id`).all(...OPEN_STATES) as Row[]).map(toDispatch);
  }

  /** Insert a new `planned` dispatch. Throws on a duplicate (item, version, kind). */
  createDispatch(item: string, version: string, kind: string, now: number, detail: string | null = null): Dispatch {
    const r = this.db
      .prepare("INSERT INTO dispatches (item, version, kind, state, attempts, created_at, updated_at, detail) VALUES (?, ?, ?, 'planned', 1, ?, ?, ?)")
      .run(item, version, kind, now, now, detail);
    return this.dispatch(Number(r.lastInsertRowid)) as Dispatch;
  }

  /**
   * Move a dispatch to `to`. Throws on a transition the state machine forbids or
   * when the row changed underneath (compare-and-set on the current state).
   * A retry (`failed|stale -> planned`) increments `attempts` and clears the lease.
   */
  transition(
    id: number,
    to: DispatchState,
    now: number,
    patch: { leaseUntil?: number | null; sessionHandle?: string | null; detail?: string | null } = {},
  ): Dispatch {
    const d = this.dispatch(id);
    if (!d) throw new Error(`dispatch ${id} not found`);
    if (!canTransition(d.state, to)) throw new Error(`dispatch ${id}: ${d.state} -> ${to} is not allowed`);
    const retry = to === "planned";
    const lease = retry ? null : patch.leaseUntil === undefined ? d.leaseUntil : patch.leaseUntil;
    const handle = patch.sessionHandle === undefined ? d.sessionHandle : patch.sessionHandle;
    const detail = patch.detail === undefined ? d.detail : patch.detail;
    const r = this.db
      .prepare("UPDATE dispatches SET state = ?, attempts = ?, updated_at = ?, lease_until = ?, session_handle = ?, detail = ? WHERE id = ? AND state = ?")
      .run(to, d.attempts + (retry ? 1 : 0), now, lease, handle, detail, id, d.state);
    if (Number(r.changes) !== 1) throw new Error(`dispatch ${id} changed during ${d.state} -> ${to}`);
    return this.dispatch(id) as Dispatch;
  }

  /** Extend the lease of an open dispatch (progress seen). */
  renewLease(id: number, leaseUntil: number, now: number): Dispatch {
    const marks = OPEN_STATES.map(() => "?").join(", ");
    const r = this.db
      .prepare(`UPDATE dispatches SET lease_until = ?, updated_at = ? WHERE id = ? AND state IN (${marks})`)
      .run(leaseUntil, now, id, ...OPEN_STATES);
    if (Number(r.changes) !== 1) throw new Error(`dispatch ${id} is not open`);
    return this.dispatch(id) as Dispatch;
  }

  // ---- ledger ----

  /** Append a ledger row. Returns `false` when `ref` already exists. */
  addLedger(e: LedgerInput): boolean {
    const r = this.db
      .prepare("INSERT OR IGNORE INTO ledger (at, item, version, kind, outcome, detail, dispatch_id, source, ref) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run(e.at, e.item, e.version, e.kind, e.outcome, e.detail ?? null, e.dispatchId ?? null, e.source, e.ref ?? null);
    return Number(r.changes) > 0;
  }

  hasLedgerRef(ref: string): boolean {
    return this.db.prepare("SELECT 1 FROM ledger WHERE ref = ?").get(ref) !== undefined;
  }

  ledger(item?: string): (LedgerInput & { id: number })[] {
    const rows = (item
      ? this.db.prepare("SELECT * FROM ledger WHERE item = ? ORDER BY id").all(item)
      : this.db.prepare("SELECT * FROM ledger ORDER BY id").all()) as Row[];
    return rows.map((r) => ({
      id: Number(r.id),
      at: Number(r.at),
      item: String(r.item),
      version: String(r.version),
      kind: String(r.kind),
      outcome: String(r.outcome),
      detail: str(r.detail),
      dispatchId: num(r.dispatch_id),
      source: String(r.source),
      ref: str(r.ref),
    }));
  }

  /** Count `started` ledger rows since `since`, optionally for one item and version. */
  countStarts(since: number, item?: string, version?: string): number {
    let sql = "SELECT COUNT(*) AS n FROM ledger WHERE outcome = 'started' AND at > ?";
    const args: (string | number)[] = [since];
    if (item !== undefined) {
      sql += " AND item = ?";
      args.push(item);
    }
    if (version !== undefined) {
      sql += " AND version = ?";
      args.push(version);
    }
    return Number((this.db.prepare(sql).get(...args) as Row).n);
  }

  // ---- runs ----

  startRun(now: number, dryRun: boolean): number {
    return Number(this.db.prepare("INSERT INTO runs (started_at, dry_run) VALUES (?, ?)").run(now, dryRun ? 1 : 0).lastInsertRowid);
  }

  finishRun(id: number, now: number, r: { ok: boolean; items?: number; events?: number; error?: string | null }): void {
    this.db
      .prepare("UPDATE runs SET finished_at = ?, ok = ?, items = ?, events = ?, error = ? WHERE id = ?")
      .run(now, r.ok ? 1 : 0, r.items ?? null, r.events ?? null, r.error ?? null, id);
  }

  lastRun(): RunRow | null {
    const r = this.db.prepare("SELECT * FROM runs ORDER BY id DESC LIMIT 1").get() as Row | undefined;
    return r ? toRun(r) : null;
  }
}
