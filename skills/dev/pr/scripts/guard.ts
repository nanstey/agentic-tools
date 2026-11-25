import { invoke, blocked, requireRun, type CommandRunner } from "./runner.ts";
import { repositoryRoot, snapshot, type Snapshot } from "./resolve.ts";
import { changeRun, getRun } from "./run.ts";
export async function guard(pr: Snapshot, runner: CommandRunner, allowAhead = false): Promise<{ guard: "passed"; pr: string }> {
  const branch = await invoke(runner, "git", ["branch", "--show-current"], { cwd: repositoryRoot });
  const head = await invoke(runner, "git", ["rev-parse", "HEAD"], { cwd: repositoryRoot });
  const status = await invoke(runner, "git", ["status", "--porcelain"], { cwd: repositoryRoot });
  if (pr.owner !== "own" || pr.fork || branch !== pr.headRefName || (!allowAhead && head !== pr.headRefOid) || status) blocked("working tree guard", `owner=${pr.owner}, branch=${branch}, HEAD=${head}, dirty=${Boolean(status)}`, "own PR head on a clean matching checkout");
  return { guard: "passed", pr: pr.url };
}
export async function draft(pr: Snapshot, runId: string, runner: CommandRunner): Promise<{ drafted: true; head: string }> {
  requireRun(runId); getRun(pr, runId);
  if (pr.owner !== "own" || pr.fork) blocked("draft conversion", `owner=${pr.owner}`, "an own PR");
  if (!pr.isDraft) await invoke(runner, "gh", ["pr", "ready", String(pr.number), "--repo", pr.repo, "--undo"], { write: "draft" });
  const refreshed = await snapshot(String(pr.number), runner);
  if (!refreshed.isDraft || refreshed.headRefOid !== pr.headRefOid) blocked("draft conversion", "draft state or head did not confirm", "PR draft at unchanged head");
  changeRun(pr, runId, (run) => { run.drafted_for_changes = true; }); return { drafted: true, head: refreshed.headRefOid };
}
function validateForceSyntax(args: string[]): void {
  if (args.some((arg) => arg === "-f" || arg === "--force") || args.some((arg) => arg.startsWith("+"))) blocked("force push", "plain force or force refspec is forbidden", "--force-with-lease");
}
function pushTarget(args: string[]): string | undefined {
  const destination = args.filter((arg) => !arg.startsWith("-")).at(-1);
  return destination?.split(":").at(-1)?.replace(/^refs\/heads\//, "");
}
async function protectPushTarget(pr: Snapshot | null, target: string | undefined, runner: CommandRunner): Promise<void> {
  const branch = target ?? await invoke(runner, "git", ["branch", "--show-current"], { cwd: repositoryRoot });
  if (["main", "develop", pr?.baseRefName].includes(branch)) blocked("protected branch", branch, "a non-default feature branch");
  if (!pr) return;
  const defaultBranch = await invoke(runner, "gh", ["repo", "view", "--repo", pr.repo, "--json", "defaultBranchRef", "--jq", ".defaultBranchRef.name"]);
  if (branch === defaultBranch) blocked("protected branch", branch, "a non-default feature branch");
}
async function validatePushOwnerAndDraft(pr: Snapshot, runId: string, runner: CommandRunner): Promise<void> {
  if (pr.owner !== "own" || pr.fork) blocked("push ownership", `owner=${pr.owner}`, "an own PR");
  await guard(pr, runner, true);
  if (!pr.isDraft && !getRun(pr, runId).drafted_for_changes) blocked("draft before push", "run is not marked drafted_for_changes", "drafted PR or recorded conversion for this run");
}
export async function push(pr: Snapshot | null, runId: string, args: string[], runner: CommandRunner): Promise<{ pushed: string }> {
  requireRun(runId);
  if (pr) await validatePushOwnerAndDraft(pr, runId, runner);
  validateForceSyntax(args);
  const target = pushTarget(args);
  await protectPushTarget(pr, target, runner);
  const result = await invoke(runner, "git", ["push", ...args.filter((arg) => arg !== "--run" && arg !== runId)], { cwd: repositoryRoot });
  if (pr) { const fresh = await snapshot(String(pr.number), runner); if (fresh.headRefOid === pr.headRefOid) blocked("push verification", "PR head did not advance", "updated authoritative PR head"); }
  return { pushed: result };
}
