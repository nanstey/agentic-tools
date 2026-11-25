// `pr` CLI entry: parses the subcommand and routes it to a handler.
//
// Layout (mirrors references/):
//   cli/args.ts     argument parsing and value validation
//   core/           lifecycle state machine and shared plumbing (00-lifecycle, _policy, _state)
//     runner, resolve (snapshot, policy hash), run (run state), authorize, guard,
//     lifecycle (phase selection), facts (lifecycle inputs), commands (snapshot/next/run + mutation preamble)
//   phases/NN-*.ts  one module per lifecycle phase action, numbered like references/NN-*.md
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { AUTHORIZATION_TABLE, renderAuthorizationTable } from "./core/authorize.ts";
import { nextPhase } from "./core/lifecycle.ts";
import { isPlaceholderDescription } from "./core/facts.ts";
import { option, positional, parseArguments } from "./cli/args.ts";
import { systemClock, systemRunner, blocked, type Clock, type CommandRunner } from "./core/runner.ts";
import { guard, draft, push } from "./core/guard.ts";
import { authorizeCommand, mutationCommand, nextCommand, runCommand, snapshotCommand, snapshotTarget, type MutationHandler } from "./core/commands.ts";
import { attach, bodyCommand } from "./phases/03-body.ts";
import { stackCommand } from "./phases/04-stack.ts";
import { checksCommand } from "./phases/05-checks.ts";
import { disclosureHeader, markerCommand, packetCommand, reactCommand, reviewCommand } from "./phases/06-review.ts";
import { docsOnlyCommand } from "./phases/06-docs-only.ts";
import { threads, rerequest, threadCommand } from "./phases/07-threads.ts";
import { cleanupCommand, mergeCommand } from "./phases/10-merge.ts";

export { AUTHORIZATION_TABLE, renderAuthorizationTable, nextPhase, isPlaceholderDescription };
export type { CommandRunner, Clock };

const MUTATIONS: Record<string, MutationHandler> = {
  guard: async ({ pr, runner }) => guard(pr, runner),
  draft: async ({ pr, runId, runner }) => draft(pr, runId!, runner),
  push: async ({ args, pr, runId, runner }) => push(pr, runId!, args.filter((value) => value !== positional(args) && value !== "--run" && value !== runId), runner),
  rerequest: async ({ args, pr, runner }) => rerequest(pr, runner, parseArguments(args).flags.has("--dry-run")),
  body: bodyCommand,
  attach: async ({ args, pr, runId, runner }) => attach(pr, runId!, args, runner),
  merge: mergeCommand,
  cleanup: cleanupCommand,
  checks: checksCommand,
};

export async function execute(args: string[], runner: CommandRunner = systemRunner, clock: Clock = systemClock): Promise<unknown> {
  const [command, ...rest] = args;
  if (!command) return blocked("usage", "missing subcommand", "pr <subcommand>");
  parseArguments(rest);
  const routes: Record<string, (values: string[]) => Promise<unknown>> = {
    snapshot: (values) => snapshotCommand(values, runner),
    next: (values) => nextCommand(values, runner, rerequest),
    authorize: (values) => authorizeCommand(values, runner),
    run: (values) => runCommand(values, runner, clock),
    threads: async (values) => threads(await snapshotTarget(values, runner), runner),
    disclosure: (values) => disclosureHeader(option(values, "--kind") ?? "review", runner),
    "docs-only": (values) => docsOnlyCommand(values, runner),
    packet: (values) => packetCommand(values, runner),
    react: (values) => reactCommand(values, runner),
    review: (values) => reviewCommand(values, runner),
    thread: (values) => threadCommand(values, runner),
    stack: (values) => stackCommand(values, runner),
    marker: (values) => markerCommand(values, runner),
  };
  const mutation = MUTATIONS[command];
  const handler = mutation ? (values: string[]) => mutationCommand(command, values, runner, clock, mutation) : routes[command];
  if (!handler) return blocked("usage", `unknown or incomplete subcommand ${command}`, "a supported pr subcommand");
  return handler(rest);
}
export async function dispatchCli(args: string[], runner: CommandRunner = systemRunner, clock: Clock = systemClock): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  try { return { stdout: `${JSON.stringify(await execute(args, runner, clock))}\n`, stderr: "", exitCode: 0 }; }
  catch (error) { const message = error instanceof Error ? error.message : String(error); return { stdout: "", stderr: `${message.startsWith("blocked:") ? message : `blocked: command/API — ${message}; unblock requires: successful command with complete authorized data`}\n`, exitCode: 1 }; }
}
async function main(): Promise<void> {
  const result = await dispatchCli(process.argv.slice(2));
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  process.exitCode = result.exitCode;
}
if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) void main();
