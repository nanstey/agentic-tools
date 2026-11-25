import { readPrStore, findPrPacket } from "../../../../../lib/pr/store.ts";
import { authorize, renderAuthorizationTable, type PrOwner } from "./authorize.ts";
import { nextPhase } from "./lifecycle.ts";
import { snapshot, policyHash, targetRoot } from "./resolve.ts";
import { lifecycleFacts, localHeadUnavailable } from "./facts.ts";
import { option, positional, boolean, modeValue, actionValue, ownerValue } from "../cli/args.ts";
import { requireRun, blocked, invoke, isRecord, type Clock, type CommandRunner } from "./runner.ts";
import { changeRun, finishRun, getRun, identityOf, startRun, statePath } from "./run.ts";

// Lifecycle-level subcommands (snapshot, next, authorize, run) and the shared
// run/authorization preamble every mutating subcommand goes through.
export type PrSnapshot = Awaited<ReturnType<typeof snapshot>>;
export interface MutationContext { args: string[]; pr: PrSnapshot; runId: string | undefined; runner: CommandRunner; clock: Clock }
export type MutationHandler = (context: MutationContext) => Promise<unknown>;
type Rerequest = Parameters<typeof lifecycleFacts>[3];

export function assertAuthorized(run: ReturnType<typeof getRun>, owner: PrOwner, mutation: string): void {
  const mode = run.force ? "force" : modeValue(run.mode ?? undefined);
  const action = ["ready", "merge"].includes(run.action) && !["convert-ready", "merge"].includes(mutation) ? "lifecycle" : run.action;
  if (!authorize(actionValue(action), mode, owner).includes(mutation)) blocked("authorization", `${mutation} is not allowed for ${action}/${mode}/${owner}`, "an authorized action, mode, and PR owner");
}
export function snapshotTarget(args: string[], runner: CommandRunner) { return snapshot(positional(args), runner); }
export async function snapshotCommand(args: string[], runner: CommandRunner): Promise<unknown> {
  const target = positional(args);
  if (!target) {
    const result = await runner("gh", ["pr", "view", "--json", "number,url"], process.env);
    if (!result.ok && /no pull requests found|no pull request found/i.test(result.stderr)) {
      const root = await targetRoot(runner);
      const [repo, branch, head] = await Promise.all([
        invoke(runner, "gh", ["repo", "view", "--json", "nameWithOwner", "--jq", ".nameWithOwner"]),
        invoke(runner, "git", ["branch", "--show-current"], { cwd: root }),
        invoke(runner, "git", ["rev-parse", "HEAD"], { cwd: root }),
      ]);
      return { exists: false, repo, branch, head };
    }
  }
  const pr = await snapshotTarget(args, runner);
  let policy: string | null;
  try { policy = await policyHash(pr.headRefOid, runner); }
  catch (error) {
    if (!localHeadUnavailable(error)) throw error;
    policy = null;
  }
  return { snapshot: pr, policy };
}
export async function nextCommand(args: string[], runner: CommandRunner, rerequest: Rerequest): Promise<unknown> {
  const idValue = option(args, "--run");
  const result = await snapshotCommand(args, runner);
  if (isRecord(result) && result.exists === false) return nextPhase({ resolved: true, exists: false });
  const pr = await snapshotTarget(args, runner);
  const store = readPrStore(statePath(pr), identityOf(pr));
  const run = idValue ? store.runs[requireRun(idValue)] : undefined;
  const facts = await lifecycleFacts(pr, args, runner, rerequest);
  let reviewReportComplete = false;
  if (pr.owner === "other" || pr.owner === "fork") {
    try {
      const policy = await policyHash(pr.headRefOid, runner);
      const packet = findPrPacket(store, pr.baseRefOid, pr.headRefOid, policy);
      reviewReportComplete = packet !== null && ["clean", "changes_required"].includes(packet.verdict);
    } catch (error) { if (!localHeadUnavailable(error)) throw error; }
  }
  return nextPhase(facts, { phase0Complete: true, owner: pr.owner, automerge: run?.action === "automerge", reviewReportComplete });
}
export async function authorizeCommand(args: string[], runner: CommandRunner): Promise<unknown> {
  const action = actionValue(args[0]); const mode = modeValue(args[1] ?? (boolean(args, "--force") ? "force" : undefined)); const target = option(args, "--pr");
  const owner = option(args, "--owner") ? ownerValue(option(args, "--owner")) : target ? (await snapshot(target, runner)).owner : "own";
  return { action, mode, owner, allowed: authorize(action, mode, owner), table: renderAuthorizationTable() };
}
function mutationName(command: string, args: string[]): string | undefined {
  const names: Record<string, string> = { push: "push", merge: "merge", body: "edit-body", attach: "attach", rerequest: "rerequest", draft: "convert-draft" };
  if (command === "checks" && args[0] === "rerun-cancelled") return "rerun-check";
  return names[command];
}
export async function mutationCommand(command: string, args: string[], runner: CommandRunner, clock: Clock, handler: MutationHandler): Promise<unknown> {
  const idRequired = ["guard", "draft", "push", "rerequest", "body", "attach", "merge", "cleanup"].includes(command) || (command === "checks" && args[0] === "rerun-cancelled");
  const runId = idRequired ? requireRun(option(args, "--run")) : undefined;
  const pr = await snapshotTarget(args, runner); const run = runId ? getRun(pr, runId) : undefined;
  const mutation = mutationName(command, args);
  if (mutation && run) assertAuthorized(run, pr.owner, mutation);
  return handler({ args, pr, runId, runner, clock });
}
export async function runCommand(args: string[], runner: CommandRunner, clock: Clock): Promise<unknown> {
  const [operation, ...rest] = args; const target = option(rest, "--pr");
  if (!target) return blocked("run arguments", "--pr is required", "a PR target");
  const pr = await snapshot(target, runner);
  if (operation === "start") {
    const action = option(rest, "--action"); if (!action) return blocked("run arguments", "--action is required", "a lifecycle action");
    return { run: startRun(pr, action, option(rest, "--mode") ?? null, boolean(rest, "--force"), clock) };
  }
  const id = requireRun(option(rest, "--run")); const current = getRun(pr, id);
  if (operation === "get") return { run: current };
  if (operation === "update") {
    const roundValue = option(rest, "--round");
    return { run: changeRun(pr, id, (run) => { if (roundValue) { const round = Number(roundValue); if (!Number.isSafeInteger(round) || round < 0) blocked("round limit", `invalid round ${roundValue}`, `a round from 0 through ${run.limit}`); if (round > run.limit) blocked("round limit", `round ${round} exceeds limit ${run.limit}`, `reserve a round from 0 through ${run.limit}`); run.round = round; } if (boolean(rest, "--drafted-for-changes")) run.drafted_for_changes = true; }) };
  }
  if (operation === "end") {
    const completion = option(rest, "--completion") ?? "complete";
    if (!["complete", "pending", "forced", "blocked"].includes(completion)) return blocked("completion", completion, "complete, pending, forced, or blocked");
    return { run: finishRun(pr, id, completion) };
  }
  return blocked("usage", "unknown run operation", "start, get, update, or end");
}
