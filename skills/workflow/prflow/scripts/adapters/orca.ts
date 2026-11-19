/**
 * Orca adapter: parsing and the exact `orca-ide` calls prflow may make.
 *
 * Reads: `worktree list`, `agent list`, `terminal list`. Writes: archive a
 * worktree, launch Pi in an existing worktree, mail a running agent with
 * `orchestration send` (never `terminal send`), and close a terminal prflow
 * dispatched to. `assertOrca` rejects every other call.
 */

export interface OrcaWorktree {
  /** Orca worktree id, `<repoId>::<path>`. */
  id: string;
  path: string;
  /** Branch without `refs/heads/`. */
  branch: string;
  /** `owner/repo`, lowercased, from the Orca project id. */
  repo: string;
  linkedPr: number | null;
}

interface RawWorktree {
  id?: string;
  path: string;
  branch?: string | null;
  projectId?: string;
  isMainWorktree?: boolean;
  isArchived?: boolean;
  isBare?: boolean;
  linkedPR?: number | null;
}

/** Repo from an Orca project id such as `github:github.com-alt/acme/widgets`. */
export function repoFromProjectId(id: string): string | null {
  const m = /^github:(.+)$/.exec(id);
  if (!m?.[1]) return null;
  const parts = m[1].split("/").filter(Boolean);
  if (parts.length < 2) return null;
  return parts.slice(-2).join("/").toLowerCase();
}

/** Active, non-main GitHub worktrees whose repo owner is in `owners` (case-insensitive). */
export function parseWorktrees(json: string, owners: readonly string[]): OrcaWorktree[] {
  const out = JSON.parse(json) as { result?: { worktrees?: RawWorktree[] } };
  const want = owners.map((o) => o.toLowerCase());
  const rows: OrcaWorktree[] = [];
  for (const w of out.result?.worktrees ?? []) {
    if (w.isMainWorktree || w.isArchived || w.isBare || !w.projectId || !w.branch) continue;
    const repo = repoFromProjectId(w.projectId);
    if (!repo || (want.length > 0 && !want.includes(repo.split("/")[0] ?? ""))) continue;
    rows.push({
      id: w.id ?? "",
      path: w.path,
      branch: w.branch.replace(/^refs\/heads\//, ""),
      repo,
      linkedPr: typeof w.linkedPR === "number" ? w.linkedPR : null,
    });
  }
  return rows;
}

/** `owner/repo` with GitHub's casing, from a PR URL. */
export function repoFromPrUrl(url: string): string | null {
  const m = /github\.com\/([^/]+\/[^/]+)\/pull\/\d+/.exec(url);
  return m?.[1] ?? null;
}

/**
 * The one Orca write prflow makes: remove (archive) a Git worktree by path. Orca
 * keeps the branch by default. Never `--force`, never `--delete-branch` (Orca
 * keeps squash-merged branches it cannot prove merged; prflow deletes a merged
 * PR's branch itself, see `adapters/git.ts`).
 */
export const archiveArgs = (path: string): string[] => ["worktree", "rm", "--worktree", `path:${path}`, "--json"];

/** Throws unless `args` is exactly `worktree rm --worktree path:<absolute path> --json`. */
export function assertArchive(args: readonly string[]): void {
  const sel = args[3] ?? "";
  const path = sel.slice("path:".length);
  const ok =
    args.length === 5 &&
    args[0] === "worktree" &&
    args[1] === "rm" &&
    args[2] === "--worktree" &&
    sel.startsWith("path:/") &&
    !path.split("/").includes("..") &&
    !/[\n\0]/.test(path) &&
    args[4] === "--json";
  if (!ok) throw new Error(`prflow: orca-ide ${args.join(" ")} is not the allowed archive call`);
}

// ---- worktree matching ----

export type WorktreeMatch = { ok: true; worktree: OrcaWorktree } | { ok: false; reason: string };

/**
 * The Orca worktree of a PR: the one linked to the PR number, else the one on
 * the PR's head branch. Several candidates are ambiguous; prflow never creates one.
 */
export function matchWorktree(rows: OrcaWorktree[], repo: string, number: number, branch: string | null): WorktreeMatch {
  const inRepo = rows.filter((w) => w.repo === repo.toLowerCase() && w.id);
  const linked = inRepo.filter((w) => w.linkedPr === number);
  const pick = linked.length ? linked : branch ? inRepo.filter((w) => w.branch === branch && (w.linkedPr === null || w.linkedPr === number)) : [];
  if (pick.length === 1 && pick[0]) return { ok: true, worktree: pick[0] };
  if (pick.length > 1) return { ok: false, reason: `several Orca worktrees match (${pick.map((w) => w.path).join(", ")})` };
  return { ok: false, reason: `no Orca worktree is linked to #${number} or on branch ${branch ?? "(unknown)"}` };
}

// ---- agent sessions ----

/** Orca agent states; `unknown` when Orca has no status for a Pi terminal. */
export type AgentState = "working" | "blocked" | "waiting" | "done" | "unknown";

/** One Pi session in a worktree, from `agent list` joined to `terminal list`. */
export interface PiSession {
  /** Address for `orchestration send`: a terminal handle, or `orca_session_id:<id>` for a chat. */
  handle: string;
  kind: "terminal" | "chat";
  /** Orca session id, `null` until a terminal agent first reports. */
  sessionId: string | null;
  state: AgentState;
  /** Last activity: terminal output time, else the agent's last update (ms). */
  lastActivityAt: number | null;
  /** The agent's last reply, when Orca has one. */
  lastMessage: string | null;
}

export interface AgentRow {
  sessionId: string;
  kind: string;
  agent: string;
  state: AgentState;
  worktreeId: string;
  paneKey: string;
  lastMessage: string | null;
  updatedAt: number | null;
}

export interface TerminalRow {
  handle: string;
  worktreeId: string;
  paneKey: string;
  agentIdentity: string | null;
  lastOutputAt: number | null;
}

const STATES: readonly AgentState[] = ["working", "blocked", "waiting", "done"];
const asState = (s: unknown): AgentState => (STATES.includes(s as AgentState) ? (s as AgentState) : "unknown");
const numOrNull = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** Throws Orca's error message when a `--json` reply reports `ok: false`. */
function result<T>(json: string, what: string): T {
  const out = JSON.parse(json) as { ok?: boolean; result?: T; error?: { code?: string; message?: string } };
  if (out.ok === false) throw new Error(`${what}: ${out.error?.code ?? "error"}: ${out.error?.message ?? ""}`.trim());
  if (out.result === undefined) throw new Error(`${what}: no result`);
  return out.result;
}

/** `orca-ide agent list --json`. */
export function parseAgents(json: string): AgentRow[] {
  const r = result<{ agents?: Record<string, unknown>[] }>(json, "orca-ide agent list");
  return (r.agents ?? []).map((a) => ({
    sessionId: String(a.orcaSessionId ?? ""),
    kind: String(a.kind ?? ""),
    agent: String(a.agent ?? ""),
    state: asState(a.state),
    worktreeId: String(a.worktreeId ?? ""),
    paneKey: String(a.paneKey ?? ""),
    lastMessage: typeof a.lastAssistantMessage === "string" ? a.lastAssistantMessage : null,
    updatedAt: numOrNull(a.updatedAt),
  }));
}

/** `orca-ide terminal list --worktree <id> --json`. */
export function parseTerminals(json: string): TerminalRow[] {
  const r = result<{ terminals?: Record<string, unknown>[] }>(json, "orca-ide terminal list");
  return (r.terminals ?? []).map((t) => ({
    handle: String(t.handle ?? ""),
    worktreeId: String(t.worktreeId ?? ""),
    paneKey: `${String(t.tabId ?? "")}:${String(t.leafId ?? "")}`,
    agentIdentity: typeof t.agentIdentity === "string" ? t.agentIdentity : null,
    lastOutputAt: numOrNull(t.lastOutputAt),
  }));
}

/**
 * Pi sessions in one worktree. A terminal is a Pi session when Orca reports a Pi
 * agent in its pane or tags it `agentIdentity: pi`; its state comes from the
 * agent row (`unknown` without one). Pi chats are addressed by session id.
 */
export function piSessions(worktreeId: string, agents: AgentRow[], terminals: TerminalRow[]): PiSession[] {
  const pis = agents.filter((a) => a.agent === "pi" && a.worktreeId === worktreeId);
  const byPane = new Map(pis.filter((a) => a.kind === "terminal").map((a) => [a.paneKey, a]));
  const out: PiSession[] = [];
  for (const t of terminals) {
    if (t.worktreeId !== worktreeId || !t.handle) continue;
    const a = byPane.get(t.paneKey);
    if (!a && t.agentIdentity !== "pi") continue;
    out.push({
      handle: t.handle,
      kind: "terminal",
      sessionId: a?.sessionId || null,
      state: a?.state ?? "unknown",
      lastActivityAt: Math.max(t.lastOutputAt ?? 0, a?.updatedAt ?? 0) || null,
      lastMessage: a?.lastMessage ?? null,
    });
  }
  for (const a of pis)
    if (a.kind === "chat" && a.sessionId)
      out.push({ handle: `orca_session_id:${a.sessionId}`, kind: "chat", sessionId: a.sessionId, state: a.state, lastActivityAt: a.updatedAt, lastMessage: a.lastMessage });
  return out;
}

/** A session that must not be messaged or prompted: mid-task, waiting on a person, or of unknown state. */
export const isBusy = (s: PiSession): boolean => s.state !== "done";

export interface LaunchResult {
  /** Terminal handle (or chat address) of the new session. */
  handle: string;
  kind: "terminal" | "chat";
  /** Orca confirmed the brief reached the agent (`journaled` or `handed-to-terminal`). */
  promptDelivered: boolean;
  detail: string;
}

/** `orca-ide agent launch ... --json`. */
export function parseLaunch(json: string): LaunchResult {
  const r = result<Record<string, unknown>>(json, "orca-ide agent launch");
  const launch = (r.launch ?? r) as {
    outcome?: { kind?: string; handle?: string; sessionId?: string };
    receipt?: { detail?: string };
    prompt?: { outcome?: string };
  };
  const kind = launch.outcome?.kind === "structured" ? "chat" : "terminal";
  const raw = launch.outcome?.handle ?? (r.agentTerminalHandle as string | undefined) ?? "";
  const handle = kind === "chat" && raw && !raw.startsWith("orca_session_id:") ? `orca_session_id:${raw}` : raw;
  if (!handle) throw new Error("orca-ide agent launch: no agent handle in the reply");
  const outcome = launch.prompt?.outcome ?? "unknown";
  return {
    handle,
    kind,
    promptDelivered: outcome === "journaled" || outcome === "handed-to-terminal",
    detail: `prompt ${outcome}${launch.receipt?.detail ? `; ${launch.receipt.detail}` : ""}`,
  };
}

/** `orca-ide orchestration send ... --json`: the stored message id. */
export function parseSend(json: string): string {
  const r = result<Record<string, unknown>>(json, "orca-ide orchestration send");
  const id = (r.message as { id?: string } | undefined)?.id ?? (r.messageId as string | undefined) ?? (r.id as string | undefined);
  return id ? String(id) : "sent";
}

// ---- allowed calls ----

const WORKTREE_ID = /^[A-Za-z0-9_.:-]+::\/[^\n\0]*$/;
const TERMINAL = /^term_[A-Za-z0-9_-]+$/;
const ADDRESS = /^(?:term_[A-Za-z0-9_-]+|orca_session_id:[A-Za-z0-9_-]+)$/;
const safePath = (id: string) => WORKTREE_ID.test(id) && !id.split("::")[1]?.split("/").includes("..");

export const worktreeListArgs = (): string[] => ["worktree", "list", "--limit", "1000", "--json"];
export const agentListArgs = (): string[] => ["agent", "list", "--json"];
export const terminalListArgs = (worktreeId: string): string[] => ["terminal", "list", "--worktree", `id:${worktreeId}`, "--json"];
/** Fresh Pi in an existing worktree, always as a terminal so prflow can mail and close it. */
export const launchArgs = (worktreeId: string, prompt: string): string[] => [
  "agent", "launch", "--agent", "pi", "--surface", "terminal", "--worktree", `id:${worktreeId}`, "--prompt", prompt, "--json",
];
/** Orca mail to a running agent. Never `terminal send`. */
export const sendArgs = (to: string, subject: string, body: string): string[] => [
  "orchestration", "send", "--to", to, "--subject", subject, "--body", body, "--json",
];
/** Close one terminal pane that prflow dispatched to. */
export const closeArgs = (handle: string): string[] => ["terminal", "close", "--terminal", handle, "--json"];

const same = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((x, i) => x === b[i]);

/** Throws unless `args` is one of the exact calls above (or the archive call). */
export function assertOrca(args: readonly string[]): void {
  const sel = (args[2] === "--worktree" ? args[3] : args[7]) ?? "";
  const wt = sel.startsWith("id:") ? sel.slice(3) : "";
  const ok =
    same(args, worktreeListArgs()) ||
    same(args, agentListArgs()) ||
    (args.length === 5 && safePath(wt) && same(args, terminalListArgs(wt))) ||
    (args.length === 11 && safePath(wt) && typeof args[9] === "string" && args[9].length > 0 && same(args, launchArgs(wt, args[9]))) ||
    (args.length === 9 && ADDRESS.test(args[3] ?? "") && !!args[5] && !!args[7] && same(args, sendArgs(args[3] ?? "", args[5] ?? "", args[7] ?? ""))) ||
    (args.length === 5 && TERMINAL.test(args[3] ?? "") && same(args, closeArgs(args[3] ?? "")));
  if (ok) return;
  try {
    assertArchive(args);
  } catch {
    throw new Error(`prflow: orca-ide ${args.slice(0, 2).join(" ")} is not an allowed call`);
  }
}
