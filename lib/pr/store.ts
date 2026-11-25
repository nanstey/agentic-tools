import { closeSync, mkdirSync, openSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { defaultStateDir, readOrNull } from "../runtime.ts";

export interface PrIdentity { owner: string; repo: string; number: number }
export interface PrRun {
  id: string; action: string; mode: string | null; force: boolean; startedAt: string;
  round: number; limit: number; drafted_for_changes: boolean; completion: string | null; policyProof?: string;
}
export type PrRunInput = Omit<PrRun, "limit"> & { limit?: number };
export interface PrFinding { id: string; category: string }
export interface PrCoverageRow { path: string; status: string }
export interface PrPacket {
  base: string; head: string; policy: string; depth: string; reason: string; verdict: string;
  findings: PrFinding[]; coverage: PrCoverageRow[]; storedAt: string;
}
export interface PrStateSummary {
  packetVerdict: string | null;
  packetHead: string | null;
  roundsUsed: number;
  lastCompletion: string | null;
}
export interface PrStore {
  version: 1;
  identity: PrIdentity;
  runs: Record<string, PrRun>;
  packets: Record<string, PrPacket>;
  describedHeads: string[];
  docsOnlyResults: Record<string, boolean>;
  cancelledCheckReruns: Record<string, string[]>;
  lastCompletion: string | null;
}

const COMPONENT = /^[A-Za-z0-9_.-]+$/;
export function prStatePath(identity: PrIdentity, env: NodeJS.ProcessEnv = process.env, home?: string): string {
  if (!COMPONENT.test(identity.owner) || !COMPONENT.test(identity.repo) || !Number.isSafeInteger(identity.number) || identity.number < 1)
    throw new Error("invalid PR identity");
  const dir = defaultStateDir("agentic-tools/pr", env, home);
  return join(dir, `${identity.owner}-${identity.repo}-${identity.number}.json`);
}

const empty = (identity: PrIdentity): PrStore => ({ version: 1, identity, runs: {}, packets: {}, describedHeads: [], docsOnlyResults: {}, cancelledCheckReruns: {}, lastCompletion: null });
const obj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const validRun = (v: unknown): v is PrRun => obj(v) && validRunFields(v);
function validRunFields(v: Record<string, unknown>): boolean {
  return typeof v.id === "string" && typeof v.action === "string" && validRunOptions(v);
}
function validRunOptions(v: Record<string, unknown>): boolean {
  return (v.mode === null || typeof v.mode === "string") && typeof v.force === "boolean" && typeof v.startedAt === "string" && typeof v.round === "number" && typeof v.limit === "number" && typeof v.drafted_for_changes === "boolean" && (v.completion === null || typeof v.completion === "string") && validPolicyProof(v);
}
function validPolicyProof(v: Record<string, unknown>): boolean {
  return v.policyProof === undefined || typeof v.policyProof === "string";
}
const validPacket = (v: unknown): v is PrPacket => obj(v) && validPacketFields(v);
function validPacketFields(v: Record<string, unknown>): boolean {
  return typeof v.base === "string" && typeof v.head === "string" && typeof v.policy === "string" && typeof v.depth === "string" && typeof v.reason === "string" && typeof v.verdict === "string" && typeof v.storedAt === "string" && validPacketRows(v);
}
function validPacketRows(v: Record<string, unknown>): boolean {
  return Array.isArray(v.findings) && v.findings.every(validFinding) && Array.isArray(v.coverage) && v.coverage.every(validCoverage);
}
const validFinding = (value: unknown): boolean => obj(value) && typeof value.id === "string" && typeof value.category === "string";
const validCoverage = (value: unknown): boolean => obj(value) && typeof value.path === "string" && typeof value.status === "string";

export function parsePrStore(text: string | null, identity: PrIdentity): PrStore {
  if (text === null || !text.trim()) return empty(identity);
  const raw = JSON.parse(text) as Record<string, unknown>;
  if (!obj(raw.identity) || raw.identity.owner !== identity.owner || raw.identity.repo !== identity.repo || raw.identity.number !== identity.number)
    throw new Error("PR state identity does not match path");
  const out = empty(identity);
  readRuns(raw, out);
  readPackets(raw, out);
  readDescribedHeads(raw, out);
  readDocsOnlyResults(raw, out);
  readCancelledReruns(raw, out);
  if (typeof raw.lastCompletion === "string") out.lastCompletion = raw.lastCompletion;
  return out;
}
function readRuns(raw: Record<string, unknown>, out: PrStore): void {
  if (obj(raw.runs)) for (const [id, run] of Object.entries(raw.runs)) if (validRun(run) && run.id === id) out.runs[id] = run;
}
function readPackets(raw: Record<string, unknown>, out: PrStore): void {
  if (obj(raw.packets)) for (const packet of Object.values(raw.packets)) if (validPacket(packet)) out.packets[packetKey(packet)] = packet;
}
function readDescribedHeads(raw: Record<string, unknown>, out: PrStore): void {
  if (Array.isArray(raw.describedHeads)) out.describedHeads = raw.describedHeads.filter((x): x is string => typeof x === "string");
}
function readDocsOnlyResults(raw: Record<string, unknown>, out: PrStore): void {
  if (obj(raw.docsOnlyResults)) for (const [key, value] of Object.entries(raw.docsOnlyResults)) if (typeof value === "boolean") out.docsOnlyResults[key] = value;
}
function readCancelledReruns(raw: Record<string, unknown>, out: PrStore): void {
  if (obj(raw.cancelledCheckReruns)) for (const [head, values] of Object.entries(raw.cancelledCheckReruns)) if (Array.isArray(values) && values.every((x) => typeof x === "string")) out.cancelledCheckReruns[head] = values;
}

export function readPrStore(path: string, identity: PrIdentity): PrStore {
  return parsePrStore(readOrNull(path), identity);
}

const MAX_RUN_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const LOCK_STALE_MS = 10_000;
const sleep = (ms: number) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
function acquireLock(lock: string): void {
  for (let i = 0; ; i++) {
    try { closeSync(openSync(lock, "wx")); return; }
    catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
      let age = 0;
      try { age = Date.now() - statSync(lock).mtimeMs; } catch { continue; }
      if (age > LOCK_STALE_MS) rmSync(lock, { force: true });
      else if (i > 200) throw new Error(`${lock} is held by another process`);
      else sleep(25);
    }
  }
}
function expireRuns(store: PrStore, now: number): void {
  for (const [id, run] of Object.entries(store.runs)) {
    const started = Date.parse(run.startedAt);
    if (!Number.isFinite(started) || now - started > MAX_RUN_AGE_MS) delete store.runs[id];
  }
}
function writeAtomically(path: string, store: PrStore): void {
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(store, null, 2)}\n`);
  renameSync(tmp, path);
}
/** Read, change, expire old runs, and atomically replace the file under a lock. */
export function updatePrStore(path: string, identity: PrIdentity, change: (store: PrStore) => void, now = Date.now()): PrStore {
  mkdirSync(dirname(path), { recursive: true });
  const lock = `${path}.lock`;
  acquireLock(lock);
  try {
    const store = readPrStore(path, identity);
    change(store);
    expireRuns(store, now);
    writeAtomically(path, store);
    return store;
  } finally { rmSync(lock, { force: true }); }
}

export function packetKey(packet: Pick<PrPacket, "base" | "head" | "policy">): string {
  return JSON.stringify([packet.base, packet.head, packet.policy]);
}

/** Return only a packet with an exact base, head, and policy identity match. */
export function findPrPacket(store: PrStore, base: string, head: string, policy: string): PrPacket | null {
  return store.packets[packetKey({ base, head, policy })] ?? null;
}

/** Summarize the latest run and a packet for the current head without influencing classification. */
export function summarizePrStore(store: PrStore, head: string): PrStateSummary {
  const packet = Object.values(store.packets).filter((p) => p.head === head).sort((a, b) => b.storedAt.localeCompare(a.storedAt))[0];
  const latestRun = Object.values(store.runs).sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0];
  return { packetVerdict: packet?.verdict ?? null, packetHead: packet?.head ?? null, roundsUsed: latestRun?.round ?? 0, lastCompletion: store.lastCompletion };
}

/** Public writer operation for recording/replacing a packet. */
export function putPrPacket(path: string, identity: PrIdentity, packet: PrPacket): void {
  updatePrStore(path, identity, (store) => { store.packets[packetKey(packet)] = packet; });
}

/** Public writer operation for updating one run without losing concurrent updates. */
export function putPrRun(path: string, identity: PrIdentity, input: PrRunInput): void {
  const run: PrRun = { ...input, limit: input.limit ?? 5 };
  updatePrStore(path, identity, (store) => { store.runs[run.id] = run; if (run.completion !== null) store.lastCompletion = run.completion; });
}
