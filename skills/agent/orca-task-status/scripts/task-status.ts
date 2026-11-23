#!/usr/bin/env node
/**
 * orca-task-status: set this Orca worktree's board status from the agent's
 * outcome and its PR, and remove the worktree once its PR merged.
 *
 * Commands: start, end, set, show, cleanup. Status writes are best effort:
 * outside Orca, in a main checkout, or in a prflow review worktree the command
 * prints `skipped: <reason>` and exits 0.
 */
import { parseArgs } from "node:util";
import { realpathSync } from "node:fs";
import { dirname } from "node:path";
import { pathToFileURL } from "node:url";
import { accountFor } from "../../../../lib/accounts.ts";
import { run as runCmd, type CmdResult } from "../../../../lib/runtime.ts";
import {
  blockedComment, blockedStatePath, clearBlocked, formatCondition, isBlockedComment, parseConditions, parseReason, putBlocked, readBlocked, waitsOnlyOnCi,
  type BlockedRecord, type Condition,
} from "../../../../lib/blocked.ts";
import { loadConfig, type Config } from "./config.ts";
import {
  cleanupBlocker, endDecision, isOutcome, type Outcome, isState, OUTCOMES, parsePr, parseWorktree, skipReason, STATES,
  type Decision, type Local, type Pr, type State, type Worktree,
} from "./core.ts";

export const USAGE = `Usage: task-status.ts <command> [options]

  start [--resume]                 Set In Progress at the start of a response.
  end [--outcome <o>] [--resume]   Set the status at the end of a response.
                                   <o>: finished (default), needs-input, blocked, paused.
                                   finished derives the status from the branch PR.
                                   blocked needs --reason and --until.
  set <state> [--resume]           Set one state: ${STATES.join(", ")}.
                                   set blocked needs --reason and --until.
  show                             Print the current status and PR-derived status.
  cleanup                          Remove this worktree after its PR merged and HEAD matches.
                                   Run it last: it ends the session.

Options:
  --resume         Allow leaving Paused (only when the user asked to work on the task).
  --reason <text>  Blocked only: why the task is blocked (one line, at most 160 characters).
  --until <cond>   Blocked only, repeatable: what must be true to unblock it. All must hold.
                   checks-pass               this branch's PR has no pending or failing
                                             required checks
                   pr-approved               this branch's PR is approved
                   "pr-merged <owner/repo#n>" that PR merged
                   manual                    only a person unblocks it (stands alone)
  --config <path>  Shared config file (default: AGENTIC_TOOLS_CONFIG, <repo-root>/config.json,
                   then \${XDG_CONFIG_HOME:-~/.config}/agentic-tools/config.json).

Blocked records live in \${XDG_STATE_HOME:-~/.local/state}/agentic-tools/blocked.json;
prflow tick re-checks them and moves the card out once every condition holds.

ORCA_TASK_STATUS=0 disables every command.
`;

export type Run = (cmd: string, args: string[], opts: { cwd?: string; env?: NodeJS.ProcessEnv }) => Promise<CmdResult>;

export interface Io {
  run: Run;
  env: NodeJS.ProcessEnv;
  cwd: string;
  out: (s: string) => void;
  err: (s: string) => void;
  config?: Config;
}

const TIMEOUT_MS = 30_000;
const PR_FIELDS = "number,state,isDraft,mergedAt,reviewDecision,mergeStateStatus,headRefOid,headRefName,isCrossRepository,statusCheckRollup";

class Skip extends Error {}

interface Ctx {
  io: Io;
  orca: string;
  top: string;
  wt: Worktree;
  cfg: Config;
}

/** Resolve the checkout and its Orca worktree, or throw Skip when this tool should not act. */
async function context(io: Io, configPath: string | undefined): Promise<Ctx> {
  if (io.env.ORCA_TASK_STATUS === "0") throw new Skip("disabled by ORCA_TASK_STATUS=0");
  const orca = io.env.ORCA_CLI_COMMAND || "orca-ide";
  const top = await io.run("git", ["rev-parse", "--show-toplevel"], { cwd: io.cwd });
  if (!top.ok) throw new Skip("not a git checkout");
  const dir = top.stdout.trim();
  const cur = await io.run(orca, ["worktree", "current", "--json"], { cwd: dir });
  if (!cur.ok) {
    if (/ENOENT/.test(cur.stderr)) throw new Skip(`Orca unavailable (${orca} not found)`);
    if (/selector_not_found/.test(cur.stdout + cur.stderr)) throw new Skip("outside an Orca worktree");
    throw new Error(`orca worktree current failed: ${(cur.stderr || cur.stdout).trim().split("\n")[0]}`);
  }
  const wt = parseWorktree(cur.stdout);
  const skip = skipReason(wt);
  if (skip) throw new Skip(skip);
  const cfg = io.config ?? loadConfig(configPath, io.env);
  return { io, orca, top: dir, wt, cfg };
}

const label = (cfg: Config, id: string): string =>
  (Object.entries(cfg.statuses).find(([, v]) => v === id)?.[0]) ?? id;

/** Why the task is blocked and what unblocks it (`--reason`, `--until`). */
interface Block {
  reason: string;
  conditions: Condition[];
}

/** The record for this worktree, with its PR when one can be read. */
async function blockedRecord(ctx: Ctx, block: Block): Promise<BlockedRecord> {
  let pr: number | null = null;
  let repo: string | null = null;
  try {
    const found = await prAndLocal(ctx);
    pr = found.pr?.number ?? null;
    repo = found.slug;
  } catch {
    // The PR is optional; prflow looks it up by branch when it is missing.
  }
  const { wt } = ctx;
  return {
    worktreeId: wt.id, path: wt.path || ctx.top, branch: wt.branch, repo, pr,
    reason: block.reason, conditions: block.conditions.map(formatCondition), setAt: new Date().toISOString(),
  };
}

/**
 * Write one state, respecting Paused unless the caller resumes. Blocked also
 * writes its record and card comment; any other state removes the record and
 * clears a Blocked comment.
 */
async function setState(ctx: Ctx, target: State, reason: string, resume: boolean, block?: Block): Promise<number> {
  const { io, cfg, wt } = ctx;
  const id = cfg.statuses[target];
  if (!id) {
    io.err(`orca-task-status: no Orca status id for "${target}"; set taskStatus.statuses.${target} in the shared config\n`);
    return 1;
  }
  const pausedId = cfg.statuses.paused;
  if (pausedId && wt.workspaceStatus === pausedId && target !== "paused" && !resume) {
    io.out(`kept paused: ${target} (${reason}) needs --resume\n`);
    return 0;
  }
  const statePath = blockedStatePath(io.env);
  const record = block ? await blockedRecord(ctx, block) : null;
  if (record) putBlocked(statePath, record);
  const clearRecord = () => {
    try {
      clearBlocked(statePath, wt.id);
    } catch (e) {
      io.err(`orca-task-status: could not clear the blocked record: ${(e as Error).message}\n`);
    }
  };
  const comment = block ? blockedComment(block.reason, block.conditions) : isBlockedComment(wt.comment) ? "" : null;
  if (wt.workspaceStatus === id && (comment === null || comment === wt.comment)) {
    if (!block) clearRecord();
    io.out(`unchanged: ${target} (${reason})\n`);
    return 0;
  }
  const args = ["worktree", "set", "--worktree", `id:${wt.id}`, "--workspace-status", id, ...(comment === null ? [] : ["--comment", comment]), "--json"];
  const r = await io.run(ctx.orca, args, { cwd: ctx.top });
  if (!r.ok) {
    if (record) clearBlocked(statePath, wt.id, record.setAt);
    io.err(`orca-task-status: orca worktree set failed: ${(r.stderr || r.stdout).trim()}\n`);
    return 1;
  }
  if (!block) clearRecord();
  io.out(`${wt.workspaceStatus === id ? "updated" : `${label(cfg, wt.workspaceStatus)} ->`} ${target} (${reason})\n`);
  wt.workspaceStatus = id;
  if (comment !== null) wt.comment = comment;
  return 0;
}

/** `owner/repo` from a GitHub remote URL (any host alias), or null. */
export function slugFromRemote(url: string): string | null {
  const m = /^(?:[a-z][a-z0-9+.-]*:\/\/)?(?:[^@/]+@)?[^:/]+(?::\d+)?[:/]([^/]+)\/([^/]+?)(?:\.git)?\/?$/i.exec(url.trim());
  return m ? `${m[1]}/${m[2]}` : null;
}

/** The PR for this branch (null when none) and the checkout state. */
async function prAndLocal(ctx: Ctx): Promise<{ pr: Pr | null; local: Local; slug: string | null }> {
  const { io, top, wt, cfg } = ctx;
  const [status, head, remote] = await Promise.all([
    io.run("git", ["status", "--porcelain"], { cwd: top }),
    io.run("git", ["rev-parse", "HEAD"], { cwd: top }),
    io.run("git", ["remote", "get-url", "origin"], { cwd: top }),
  ]);
  if (!status.ok || !head.ok) throw new Error(`git failed: ${(status.stderr || head.stderr).trim()}`);
  const local: Local = { dirty: status.stdout.trim() !== "", head: head.stdout.trim() };
  const slug = remote.ok ? slugFromRemote(remote.stdout) : null;
  if (!wt.branch) return { pr: null, local, slug };
  const env: NodeJS.ProcessEnv = { ...withoutTokens(io.env), GH_PROMPT_DISABLED: "1" };
  const account = accountFor(cfg.accounts, slug);
  if (account) {
    const t = await io.run("gh", ["auth", "token", "-u", account.login], { env });
    if (t.ok && t.stdout.trim()) env.GH_TOKEN = t.stdout.trim();
  }
  const args = ["pr", "view", wt.branch, "--json", PR_FIELDS, ...(slug ? ["--repo", slug] : [])];
  const r = await io.run("gh", args, { cwd: top, env });
  if (!r.ok) {
    if (/no pull requests found/i.test(r.stderr)) return { pr: null, local, slug };
    throw new Error(`gh pr view failed: ${r.stderr.trim()}`);
  }
  return { pr: parsePr(r.stdout), local, slug };
}

function withoutTokens(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const out = { ...env };
  delete out.GH_TOKEN;
  delete out.GITHUB_TOKEN;
  return out;
}

async function cleanup(ctx: Ctx): Promise<number> {
  const { io, wt, cfg } = ctx;
  const { pr, local } = await prAndLocal(ctx);
  const blocker = cleanupBlocker(wt, cfg.statuses.paused, pr, local);
  if (blocker) {
    io.out(`cleanup refused: ${blocker}\n`);
    return 1;
  }
  if (cfg.statuses.done && wt.workspaceStatus !== cfg.statuses.done) await setState(ctx, "done", `PR #${pr!.number} merged`, false);
  io.out(`removing worktree ${wt.id}; this ends the session\n`);
  const r = await io.run(ctx.orca, ["worktree", "rm", "--worktree", `id:${wt.id}`, "--force", "--json"], { cwd: dirname(ctx.top) });
  if (!r.ok) {
    io.err(`orca-task-status: orca worktree rm failed: ${(r.stderr || r.stdout).trim()}\n`);
    return 1;
  }
  io.out("removed\n");
  return 0;
}

export async function main(argv: string[], io: Io): Promise<number> {
  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        outcome: { type: "string" },
        resume: { type: "boolean" },
        config: { type: "string" },
        reason: { type: "string" },
        until: { type: "string", multiple: true },
        help: { type: "boolean", short: "h" },
      },
    });
  } catch (e) {
    io.err(`orca-task-status: ${(e as Error).message}\n${USAGE}`);
    return 2;
  }
  const { values, positionals } = parsed;
  const [command, arg] = positionals;
  if (values.help || !command) {
    io.out(USAGE);
    return values.help ? 0 : 2;
  }
  const given = values.outcome ?? "finished";
  if (!isOutcome(given)) {
    io.err(`orca-task-status: --outcome must be one of ${OUTCOMES.join(", ")}\n`);
    return 2;
  }
  let outcome: Outcome = given;
  if (command === "set" && (!arg || !isState(arg))) {
    io.err(`orca-task-status: set needs one of ${STATES.join(", ")}\n`);
    return 2;
  }
  if (!["start", "end", "set", "show", "cleanup"].includes(command)) {
    io.err(`orca-task-status: unknown command "${command}"\n${USAGE}`);
    return 2;
  }
  const blocking = (command === "end" && outcome === "blocked") || (command === "set" && arg === "blocked");
  let block: Block | undefined;
  if (blocking) {
    try {
      block = { reason: parseReason(values.reason), conditions: parseConditions(values.until ?? []) };
    } catch (e) {
      io.err(`orca-task-status: blocked needs --reason "<why>" and one or more --until <condition>: ${(e as Error).message}\n`);
      return 2;
    }
    if (block && waitsOnlyOnCi(block.conditions)) {
      if (command === "set") {
        io.err("orca-task-status: waiting for CI is In Review, not Blocked; run set in-review or end --outcome finished\n");
        return 2;
      }
      io.out("waiting for CI is In Review, not Blocked: deriving the state from the PR (end --outcome finished)\n");
      outcome = "finished";
      block = undefined;
    }
  } else if (values.reason !== undefined || values.until !== undefined) {
    io.err("orca-task-status: --reason and --until apply only to end --outcome blocked and set blocked\n");
    return 2;
  }
  const resume = values.resume === true;
  let ctx: Ctx;
  try {
    ctx = await context(io, values.config);
  } catch (e) {
    if (e instanceof Skip) {
      io.out(`skipped: ${e.message}\n`);
      return 0;
    }
    io.err(`orca-task-status: ${(e as Error).message}\n`);
    return 1;
  }
  try {
    switch (command) {
      case "start":
        return await setState(ctx, "in-progress", "agent working", resume);
      case "set":
        return await setState(ctx, arg as State, block ? `${block.reason}; until: ${block.conditions.map(formatCondition).join(", ")}` : "set by agent", resume, block);
      case "show": {
        const { pr, local } = await prAndLocal(ctx);
        const d = endDecision("finished", pr, local);
        const blocker = cleanupBlocker(ctx.wt, ctx.cfg.statuses.paused, pr, local);
        const rec = readBlocked(blockedStatePath(io.env)).records[ctx.wt.id];
        const blocked = rec ? `blocked record: ${rec.reason} · until: ${rec.conditions.join(", ")} (set ${rec.setAt})\n` : "";
        io.out(`current: ${label(ctx.cfg, ctx.wt.workspaceStatus)}\n${blocked}finished would set: ${d.state} (${d.reason})\ncleanup: ${blocker ? `not eligible (${blocker})` : "eligible"}\n`);
        return 0;
      }
      case "end": {
        let d: Decision;
        let pr: Pr | null = null;
        let local: Local | null = null;
        if (outcome === "finished") {
          ({ pr, local } = await prAndLocal(ctx));
          d = endDecision(outcome, pr, local);
        } else {
          d = endDecision(outcome, null, { dirty: false, head: "" });
          if (block) d = { ...d, reason: `${block.reason}; until: ${block.conditions.map(formatCondition).join(", ")}` };
        }
        const code = await setState(ctx, d.state, d.reason, resume, block);
        if (code === 0 && pr?.state === "MERGED" && local) {
          const blocker = cleanupBlocker(ctx.wt, ctx.cfg.statuses.paused, pr, local);
          io.out(blocker ? `cleanup: not eligible (${blocker})\n` : "cleanup: eligible; send your final report, then run cleanup as the last command\n");
        }
        return code;
      }
      case "cleanup":
        return await cleanup(ctx);
    }
  } catch (e) {
    io.err(`orca-task-status: ${(e as Error).message}\n`);
    return 1;
  }
  return 2;
}

const entry = process.argv[1];
if (entry && import.meta.url === pathToFileURL(realpathSync(entry)).href) {
  const io: Io = {
    run: (cmd, args, opts) => runCmd(cmd, args, opts.env ?? process.env, opts.cwd, TIMEOUT_MS),
    env: process.env,
    cwd: process.cwd(),
    out: (s) => process.stdout.write(s),
    err: (s) => process.stderr.write(s),
  };
  process.exitCode = await main(process.argv.slice(2), io);
}
