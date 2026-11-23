/**
 * Orca adapter: parsing and the exact `orca-ide` calls prflow may make.
 *
 * Reads: `worktree list`, `agent list`, `terminal list`. Writes: archive a
 * worktree, create a review worktree for one PR (without the caller's Orca
 * identity, see `detachedEnv`), update its status or display name or drop a
 * stray parent (review worktrees only), launch Pi
 * in an existing worktree, mail a running agent with `orchestration send`
 * (never `terminal send`), and close an idle prflow-launched terminal.
 * `assertOrca` rejects every other call.
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
  workspaceStatus?: string | null;
  comment?: string | null;
  isUnread?: boolean | null;
  /** Orca display name, when listed. */
  displayName?: string | null;
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
  workspaceStatus?: string | null;
  comment?: string | null;
  isUnread?: boolean;
  displayName?: string | null;
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
      workspaceStatus: typeof w.workspaceStatus === "string" ? w.workspaceStatus : null,
      comment: typeof w.comment === "string" ? w.comment : null,
      isUnread: typeof w.isUnread === "boolean" ? w.isUnread : null,
      displayName: typeof w.displayName === "string" ? w.displayName : null,
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
 * Archive a Git worktree by path. Orca keeps the branch by default. Never
 * `--force`, never `--delete-branch`; prflow deletes eligible local branches
 * separately with the guarded Git adapter.
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

// ---- review worktrees ----

/** Branches of review worktrees prflow creates; nothing else uses this prefix. */
export const REVIEW_BRANCH_PREFIX = "prflow-review/";
export const isReviewBranch = (b: string): boolean => b.startsWith(REVIEW_BRANCH_PREFIX);

/** `<repo name>-<n>`, lowercase, safe for a persistent review worktree. */
export function reviewSlug(repo: string, number: number, _head8?: string): string {
  const name = (repo.split("/")[1] ?? repo).toLowerCase().replace(/[^a-z0-9._-]/g, "-");
  return `${name}-${number}`;
}
export const reviewWorktreeName = (slug: string): string => `prflow-review-${slug}`;

/**
 * True for a folder named exactly like a review worktree prflow creates
 * (`prflow-review-<repo>-<n>`, see `reviewWorktreeName`). A development
 * worktree whose folder merely starts with `prflow-review-` (for example
 * `prflow-review-list-store`) is not one.
 */
export const isReviewWorktreeFolder = (folder: string): boolean =>
  folder.startsWith("prflow-review-") && /^[a-z0-9._-]+-[1-9]\d{0,9}$/.test(folder.slice("prflow-review-".length));

/**
 * The one review-worktree test for a worktree card: a `prflow-review/` branch
 * (what the tick steps skip) or a canonical review folder name.
 */
export const isReviewWorktree = (branch: string, folder: string): boolean => isReviewBranch(branch) || isReviewWorktreeFolder(folder);
export const reviewBranch = (slug: string): string => `${REVIEW_BRANCH_PREFIX}${slug}`;

/**
 * New Orca worktree for reviewing one PR head: own branch, linked to the PR,
 * no parent lineage, repo setup hooks run.
 */
export const reviewWorktreeArgs = (repoId: string, slug: string, pr: number): string[] => [
  "worktree", "create", "--repo", `id:${repoId}`, "--name", reviewWorktreeName(slug), "--branch", reviewBranch(slug), "--pr", String(pr), "--no-parent", "--setup", "run", "--json",
];

const REPO_ID = /^[A-Za-z0-9_-]+$/;
const SLUG = /^[a-z0-9._-]+-[1-9]\d{0,9}$/;

/** Throws unless `args` is exactly the review worktree creation above. */
export function assertReviewWorktree(args: readonly string[]): void {
  const repoId = (args[3] ?? "").slice(3);
  const slug = (args[5] ?? "").slice("prflow-review-".length);
  const pr = Number(args[9]);
  const ok =
    args.length === 14 &&
    (args[3] ?? "").startsWith("id:") &&
    REPO_ID.test(repoId) &&
    SLUG.test(slug) &&
    !slug.includes("..") &&
    Number.isSafeInteger(pr) &&
    pr > 0 &&
    slug.endsWith(`-${pr}`) &&
    reviewWorktreeArgs(repoId, slug, pr).every((x, i) => x === args[i]);
  if (!ok) throw new Error(`prflow: orca-ide ${args.slice(0, 2).join(" ")} is not the allowed review worktree creation`);
}

/**
 * Orca repo id for `repo` (`owner/repo`) from `worktree list` output: the main
 * worktree of that GitHub project. With several clones, the one whose folder
 * is named after the repo; `null` when none or still ambiguous.
 */
export function repoIdFor(json: string, repo: string): { id: string; path: string } | null {
  const out = JSON.parse(json) as { result?: { worktrees?: (RawWorktree & { repoId?: string })[] } };
  const want = repo.toLowerCase();
  const mains = (out.result?.worktrees ?? []).filter((w) => w.isMainWorktree && !w.isArchived && w.projectId && repoFromProjectId(w.projectId) === want && w.repoId && REPO_ID.test(w.repoId));
  const name = want.split("/")[1] ?? "";
  const pick = mains.length === 1 ? mains : mains.filter((w) => w.path.split("/").at(-1)?.toLowerCase() === name);
  const one = pick.length === 1 ? pick[0] : undefined;
  return one?.repoId ? { id: one.repoId, path: one.path } : null;
}

/** The review worktree for `slug`, if Orca lists it (branch, maybe with Orca's numeric suffix). */
export function findReviewWorktree(rows: OrcaWorktree[], repo: string, number: number, slug: string): OrcaWorktree | null {
  const b = reviewBranch(slug);
  const suffixed = (x: string) => x.startsWith(`${b}-`) && /^\d+$/.test(x.slice(b.length + 1));
  const hits = rows.filter((w) => w.repo === repo.toLowerCase() && w.id && (w.branch === b || suffixed(w.branch)) && (w.linkedPr === null || w.linkedPr === number));
  return hits.length === 1 ? (hits[0] ?? null) : (hits.find((w) => w.branch === b) ?? null);
}

/** `orca-ide worktree set` is limited to a status update for the expected review worktree. */
export const worktreeSetArgs = (path: string, status: string, comment: string, unread?: "--unread" | "--read"): string[] => [
  "worktree", "set", "--worktree", `path:${path}`, "--workspace-status", status, "--comment", comment,
  ...(unread ? [unread] : []), "--json",
];

export function assertWorktreeSet(args: readonly string[], expectedPath?: string): void {
  const path = args[3]?.slice("path:".length) ?? "";
  const status = args[5] ?? "";
  const comment = args[7] ?? "";
  const extra = args.length === 10 ? args[8] : undefined;
  const ok = args.length === (extra ? 10 : 9) && args[0] === "worktree" && args[1] === "set" && args[2] === "--worktree" &&
    (expectedPath === undefined || args[3] === `path:${expectedPath}`) && path.startsWith("/") && !path.split("/").includes("..") &&
    (path.split("/").at(-1)?.startsWith("prflow-review-") ?? false) && /^[a-z0-9][a-z0-9-]{0,40}$/.test(status) &&
    comment.length <= 200 && !/[\x00-\x1f\x7f]/.test(comment) && (!extra || extra === "--unread" || extra === "--read") && args.at(-1) === "--json" &&
    same(args, worktreeSetArgs(expectedPath ?? path, status, comment, extra as "--unread" | "--read" | undefined));
  if (!ok) throw new Error(`prflow: orca-ide ${args.join(" ")} is not the allowed review worktree status call`);
}

/**
 * `orca-ide worktree create --json`: the new worktree's id and path, when the
 * reply has them. `nested` is true when Orca still recorded a parent
 * (`lineage`, `workspaceLineage`, or `crossStoreLineage`) despite `--no-parent`.
 */
export function parseCreatedWorktree(json: string): { id: string; path: string; nested: boolean } | null {
  const r = result<Record<string, unknown>>(json, "orca-ide worktree create");
  const w = (r.worktree ?? r) as { id?: unknown; path?: unknown };
  const nested = [r.lineage, r.workspaceLineage, r.crossStoreLineage].some((x) => x !== undefined && x !== null);
  return typeof w.id === "string" && typeof w.path === "string" && WORKTREE_ID.test(w.id) ? { id: w.id, path: w.path, nested } : null;
}

/**
 * Environment variables that name the calling Orca terminal, chat, bot, or
 * workspace. Orca files a new worktree under the caller's bot folder when the
 * create call carries the caller's terminal handle or agent session id, even
 * with `--no-parent`. prflow drops them from its `worktree create` call, so
 * review worktrees are always top-level in their repo. Connection variables
 * (`ORCA_ENVIRONMENT`, `ORCA_PAIRING_CODE`, `ORCA_USER_DATA_PATH`,
 * `ORCA_CLI_COMMAND`) stay.
 */
export const ORCA_CALLER_ENV = ["ORCA_TERMINAL_HANDLE", "ORCA_AGENT_SESSION_ID", "ORCA_AGENT_SESSION_SPAWN_TOKEN", "ORCA_BOT_TOOLS_TOKEN", "ORCA_WORKSPACE_ID", "ORCA_WORKTREE_ID"] as const;

/** `env` without the caller-identity variables above. */
export function detachedEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const out = { ...env };
  for (const k of ORCA_CALLER_ENV) delete out[k];
  return out;
}

/** Remove a review worktree's Orca parent lineage. */
export const worktreeUnparentArgs = (path: string): string[] => ["worktree", "set", "--worktree", `path:${path}`, "--no-parent", "--json"];

/** Throws unless `args` is exactly `worktreeUnparentArgs` for a `prflow-review-` folder (and `expectedPath`, when given). */
export function assertWorktreeUnparent(args: readonly string[], expectedPath?: string): void {
  const path = args[3]?.slice("path:".length) ?? "";
  const ok = args.length === 6 && (args[3] ?? "").startsWith("path:") && (expectedPath === undefined || path === expectedPath) &&
    path.startsWith("/") && !path.split("/").includes("..") && !/[\n\0]/.test(path) &&
    (path.split("/").at(-1)?.startsWith("prflow-review-") ?? false) && same(args, worktreeUnparentArgs(path));
  if (!ok) throw new Error(`prflow: orca-ide ${args.join(" ")} is not the allowed review worktree unparent call`);
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

/**
 * `orca-ide terminal list --worktree <id> --json`. A terminal whose pane is not
 * mounted in the Orca window (`orphaned: true`) reports synthetic `pty:` tab and
 * leaf ids; its agent row keeps the pane it was recorded in, `recordedPaneKey`.
 */
export function parseTerminals(json: string): TerminalRow[] {
  const r = result<{ terminals?: Record<string, unknown>[] }>(json, "orca-ide terminal list");
  return (r.terminals ?? []).map((t) => ({
    handle: String(t.handle ?? ""),
    worktreeId: String(t.worktreeId ?? ""),
    paneKey: t.orphaned === true && typeof t.recordedPaneKey === "string" && t.recordedPaneKey ? t.recordedPaneKey : `${String(t.tabId ?? "")}:${String(t.leafId ?? "")}`,
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
/** Escape, the only raw input prflow sends: it stops a Pi turn. Never text, never Enter. */
export const ESCAPE = "\x1b";
export const interruptArgs = (handle: string): string[] => ["terminal", "send", "--terminal", handle, "--text", ESCAPE, "--json"];
/** Wait for an interrupted Pi to show its prompt again. */
export const WAIT_IDLE_MS = 30000;
export const waitIdleArgs = (handle: string): string[] => ["terminal", "wait", "--terminal", handle, "--for", "tui-idle", "--timeout-ms", String(WAIT_IDLE_MS), "--json"];

/** Whether a `terminal wait --for tui-idle` reply says the terminal is idle. */
export function parseWaitIdle(stdout: string): boolean {
  try {
    const v = JSON.parse(stdout) as { ok?: boolean; result?: { wait?: { satisfied?: unknown } } };
    return v.ok === true && v.result?.wait?.satisfied === true;
  } catch {
    return false;
  }
}

const same = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((x, i) => x === b[i]);

/**
 * `orca-ide worktree set` limited to the display name of a review worktree:
 * the PR's head branch name, so the author's branch shows in Orca. Only the
 * display name changes; the folder and the local `prflow-review/` branch stay.
 */
export const worktreeNameArgs = (path: string, name: string): string[] => ["worktree", "set", "--worktree", `path:${path}`, "--display-name", name, "--json"];

/** A head branch name usable as a display name: no control characters, no leading `-`. */
export const isDisplayName = (name: string): boolean => name.length > 0 && name.length <= 255 && !name.startsWith("-") && !/[\x00-\x1f\x7f]/.test(name);

/** Throws unless `args` is exactly `worktreeNameArgs` for a `prflow-review-` folder (and `expectedPath`, when given). */
export function assertWorktreeName(args: readonly string[], expectedPath?: string): void {
  const path = args[3]?.slice("path:".length) ?? "";
  const name = args[5] ?? "";
  const ok = args.length === 7 && (args[3] ?? "").startsWith("path:") && (expectedPath === undefined || path === expectedPath) &&
    path.startsWith("/") && !path.split("/").includes("..") && !/[\n\0]/.test(path) &&
    (path.split("/").at(-1)?.startsWith("prflow-review-") ?? false) && isDisplayName(name) && same(args, worktreeNameArgs(path, name));
  if (!ok) throw new Error(`prflow: orca-ide ${args.join(" ")} is not the allowed review worktree rename`);
}

/**
 * `orca-ide worktree set` that moves an ordinary (non-review) worktree's card
 * out of Blocked once its unblock conditions hold: by id, with the status the
 * PR-derived rules give, a comment saying what changed, and `--unread`.
 */
export const taskStatusSetArgs = (worktreeId: string, status: string, comment: string): string[] => [
  "worktree", "set", "--worktree", `id:${worktreeId}`, "--workspace-status", status, "--comment", comment, "--unread", "--json",
];

/**
 * Throws unless `args` is exactly `taskStatusSetArgs` for a non-review
 * worktree (`isReviewWorktree` on `branch` and the id's folder).
 */
export function assertTaskStatusSet(args: readonly string[], branch = ""): void {
  const sel = args[3] ?? "";
  const id = sel.startsWith("id:") ? sel.slice(3) : "";
  const folder = id.split("::")[1]?.split("/").at(-1) ?? "";
  const status = args[5] ?? "";
  const comment = args[7] ?? "";
  const ok = args.length === 10 && safePath(id) && !isReviewWorktree(branch, folder) && /^[a-z0-9][a-z0-9-]{0,40}$/.test(status) &&
    comment.length > 0 && comment.length <= 200 && !/[\x00-\x1f\x7f]/.test(comment) && same(args, taskStatusSetArgs(id, status, comment));
  if (!ok) throw new Error(`prflow: orca-ide ${args.join(" ")} is not the allowed unblock status call`);
}

/**
 * `orca-ide worktree set` that moves an ordinary (non-review) worktree's card
 * to the column its sessions and PR give (`scripts/worktree-status.ts`): by
 * id, status only. The card's comment and unread flag stay as they are.
 */
export const worktreeStatusArgs = (worktreeId: string, status: string): string[] => [
  "worktree", "set", "--worktree", `id:${worktreeId}`, "--workspace-status", status, "--json",
];

/**
 * Throws unless `args` is exactly `worktreeStatusArgs` for a non-review
 * worktree (`isReviewWorktree` on `branch` and the id's folder).
 */
export function assertWorktreeStatusSet(args: readonly string[], branch = ""): void {
  const sel = args[3] ?? "";
  const id = sel.startsWith("id:") ? sel.slice(3) : "";
  const folder = id.split("::")[1]?.split("/").at(-1) ?? "";
  const status = args[5] ?? "";
  const ok = args.length === 7 && safePath(id) && !isReviewWorktree(branch, folder) && /^[a-z0-9][a-z0-9-]{0,40}$/.test(status) &&
    same(args, worktreeStatusArgs(id, status));
  if (!ok) throw new Error(`prflow: orca-ide ${args.join(" ")} is not the allowed worktree status call`);
}

/** Throws unless `args` is one of the exact calls above, the review worktree creation, or the archive call. */
export function assertOrca(args: readonly string[]): void {
  const sel = (args[2] === "--worktree" ? args[3] : args[7]) ?? "";
  const wt = sel.startsWith("id:") ? sel.slice(3) : "";
  const ok =
    same(args, worktreeListArgs()) ||
    same(args, agentListArgs()) ||
    (args.length === 5 && safePath(wt) && same(args, terminalListArgs(wt))) ||
    (args.length === 11 && safePath(wt) && typeof args[9] === "string" && args[9].length > 0 && same(args, launchArgs(wt, args[9]))) ||
    (args.length === 9 && ADDRESS.test(args[3] ?? "") && !!args[5] && !!args[7] && same(args, sendArgs(args[3] ?? "", args[5] ?? "", args[7] ?? ""))) ||
    (args.length === 5 && TERMINAL.test(args[3] ?? "") && same(args, closeArgs(args[3] ?? ""))) ||
    (args.length === 7 && TERMINAL.test(args[3] ?? "") && same(args, interruptArgs(args[3] ?? ""))) ||
    (args.length === 9 && TERMINAL.test(args[3] ?? "") && same(args, waitIdleArgs(args[3] ?? "")));
  if (ok) return;
  if (args[0] === "worktree" && args[1] === "create") return assertReviewWorktree(args);
  if (args[0] === "worktree" && args[1] === "set") {
    if (args[4] === "--display-name") return assertWorktreeName(args);
    if (args[4] === "--no-parent") return assertWorktreeUnparent(args);
    if ((args[3] ?? "").startsWith("id:")) return args.length === 7 ? assertWorktreeStatusSet(args) : assertTaskStatusSet(args);
    return assertWorktreeSet(args);
  }
  try {
    assertArchive(args);
  } catch {
    throw new Error(`prflow: orca-ide ${args.slice(0, 2).join(" ")} is not an allowed call`);
  }
}
