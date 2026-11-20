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
import { loadConfig, type Config } from "./config.ts";
import {
  cleanupBlocker, endDecision, isOutcome, isState, OUTCOMES, parsePr, parseWorktree, skipReason, STATES,
  type Decision, type Local, type Pr, type State, type Worktree,
} from "./core.ts";

export const USAGE = `Usage: task-status.ts <command> [options]

  start [--resume]                 Set In Progress at the start of a response.
  end [--outcome <o>] [--resume]   Set the status at the end of a response.
                                   <o>: finished (default), needs-input, blocked, paused.
                                   finished derives the status from the branch PR.
  set <state> [--resume]           Set one state: ${STATES.join(", ")}.
  show                             Print the current status and PR-derived status.
  cleanup                          Remove this worktree when its PR merged and
                                   nothing is left locally. Run it last: it ends the session.

Options:
  --resume         Allow leaving Paused (only when the user asked to work on the task).
  --config <path>  Shared config file (default: AGENTIC_TOOLS_CONFIG, <repo-root>/config.json,
                   then \${XDG_CONFIG_HOME:-~/.config}/agentic-tools/config.json).

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
const PR_FIELDS = "number,state,isDraft,mergedAt,reviewDecision,mergeStateStatus,headRefOid,statusCheckRollup";

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

/** Write one state, respecting Paused unless the caller resumes. */
async function setState(ctx: Ctx, target: State, reason: string, resume: boolean): Promise<number> {
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
  if (wt.workspaceStatus === id) {
    io.out(`unchanged: ${target} (${reason})\n`);
    return 0;
  }
  const r = await io.run(ctx.orca, ["worktree", "set", "--worktree", `id:${wt.id}`, "--workspace-status", id, "--json"], { cwd: ctx.top });
  if (!r.ok) {
    io.err(`orca-task-status: orca worktree set failed: ${(r.stderr || r.stdout).trim()}\n`);
    return 1;
  }
  io.out(`${label(cfg, wt.workspaceStatus)} -> ${target} (${reason})\n`);
  wt.workspaceStatus = id;
  return 0;
}

/** `owner/repo` from a GitHub remote URL (any host alias), or null. */
export function slugFromRemote(url: string): string | null {
  const m = /^(?:[a-z][a-z0-9+.-]*:\/\/)?(?:[^@/]+@)?[^:/]+(?::\d+)?[:/]([^/]+)\/([^/]+?)(?:\.git)?\/?$/i.exec(url.trim());
  return m ? `${m[1]}/${m[2]}` : null;
}

/** The PR for this branch (null when none) and the checkout state. */
async function prAndLocal(ctx: Ctx): Promise<{ pr: Pr | null; local: Local }> {
  const { io, top, wt, cfg } = ctx;
  const [status, head, remote] = await Promise.all([
    io.run("git", ["status", "--porcelain"], { cwd: top }),
    io.run("git", ["rev-parse", "HEAD"], { cwd: top }),
    io.run("git", ["remote", "get-url", "origin"], { cwd: top }),
  ]);
  if (!status.ok || !head.ok) throw new Error(`git failed: ${(status.stderr || head.stderr).trim()}`);
  const local: Local = { dirty: status.stdout.trim() !== "", head: head.stdout.trim() };
  if (!wt.branch) return { pr: null, local };
  const slug = remote.ok ? slugFromRemote(remote.stdout) : null;
  const env: NodeJS.ProcessEnv = { ...withoutTokens(io.env), GH_PROMPT_DISABLED: "1" };
  const account = accountFor(cfg.accounts, slug);
  if (account) {
    const t = await io.run("gh", ["auth", "token", "-u", account.login], { env });
    if (t.ok && t.stdout.trim()) env.GH_TOKEN = t.stdout.trim();
  }
  const args = ["pr", "view", wt.branch, "--json", PR_FIELDS, ...(slug ? ["--repo", slug] : [])];
  const r = await io.run("gh", args, { cwd: top, env });
  if (!r.ok) {
    if (/no pull requests found/i.test(r.stderr)) return { pr: null, local };
    throw new Error(`gh pr view failed: ${r.stderr.trim()}`);
  }
  return { pr: parsePr(r.stdout), local };
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
  const r = await io.run(ctx.orca, ["worktree", "rm", "--worktree", `id:${wt.id}`, "--json"], { cwd: dirname(ctx.top) });
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
  const outcome = values.outcome ?? "finished";
  if (!isOutcome(outcome)) {
    io.err(`orca-task-status: --outcome must be one of ${OUTCOMES.join(", ")}\n`);
    return 2;
  }
  if (command === "set" && (!arg || !isState(arg))) {
    io.err(`orca-task-status: set needs one of ${STATES.join(", ")}\n`);
    return 2;
  }
  if (!["start", "end", "set", "show", "cleanup"].includes(command)) {
    io.err(`orca-task-status: unknown command "${command}"\n${USAGE}`);
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
        return await setState(ctx, arg as State, "set by agent", resume);
      case "show": {
        const { pr, local } = await prAndLocal(ctx);
        const d = endDecision("finished", pr, local);
        const blocker = cleanupBlocker(ctx.wt, ctx.cfg.statuses.paused, pr, local);
        io.out(`current: ${label(ctx.cfg, ctx.wt.workspaceStatus)}\nfinished would set: ${d.state} (${d.reason})\ncleanup: ${blocker ? `not eligible (${blocker})` : "eligible"}\n`);
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
        }
        const code = await setState(ctx, d.state, d.reason, resume);
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
