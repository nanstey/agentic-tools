import { invoke, blocked, type Clock, type CommandRunner } from "./runner.ts";
import { snapshot, repositoryRoot, type Snapshot } from "./resolve.ts";
import { finishRun } from "./run.ts";
import { waitChecks } from "./checks.ts";
export function squashSubject(title: string, number: number): string { const suffix = ` (#${number})`; return title.endsWith(suffix) ? title : `${title}${suffix}`; }
async function viewerIsAdmin(pr: Snapshot, runner: CommandRunner): Promise<boolean> {
  const result = await invoke(runner, "gh", ["repo", "view", "--repo", pr.repo, "--json", "viewerPermission"]);
  try { return (JSON.parse(result) as { viewerPermission?: string }).viewerPermission === "ADMIN"; }
  catch { return blocked("repository permission", "invalid viewer permission response", "verified ADMIN permission"); }
}
async function checkMergeGates(pr: Snapshot, required: string[], force: boolean, noRequiredChecks: boolean, policyProof: string | undefined, runner: CommandRunner, clock: Clock): ReturnType<typeof waitChecks> {
  if (noRequiredChecks) {
    if (required.length || !policyProof?.trim()) return blocked("required checks", "--no-required-checks requires --policy-proof <text> and no --required entries", "an explicit trusted-policy reason that proves no checks are required");
    return Promise.resolve({ status: "passed" as const, checks: [] });
  }
  if (!required.length) return blocked("required checks", "no required checks supplied", "agent-provided required check list or verified policy proof");
  return waitChecks(pr, required, 30 * 60_000, force, runner, clock);
}
async function mergeCommand(pr: Snapshot, subject: string, force: boolean, runner: CommandRunner): Promise<void> {
  const args = ["pr", "merge", String(pr.number), "--repo", pr.repo, "--squash", "--subject", subject, "--body", "", "--match-head-commit", pr.headRefOid];
  try { await invoke(runner, "gh", args, { write: "merge" }); }
  catch (error) {
    if (!force || !/branch protection|protected branch/i.test(String(error)) || !(await viewerIsAdmin(pr, runner))) throw error;
    await invoke(runner, "gh", [...args, "--admin"], { write: "merge" });
  }
}
export async function merge(pr: Snapshot, runId: string, force: boolean, required: string[], runner: CommandRunner, clock: Clock, noRequiredChecks = false, policyProof?: string): Promise<unknown> {
  if (pr.stack) return blocked("native stack", "stack members merge only in the GitHub web UI", pr.url);
  const checks = await checkMergeGates(pr, required, force, noRequiredChecks, policyProof, runner, clock);
  if (["pending", "failed", "needs_policy_proof"].includes(checks.status)) return { status: checks.status, ...(checks.checks ? { checks: checks.checks } : {}), ...(checks.needs_policy_proof ? { needs_policy_proof: checks.needs_policy_proof } : {}) };
  const subject = squashSubject(pr.title, pr.number);
  await mergeCommand(pr, subject, force, runner);
  const final = await snapshot(String(pr.number), runner);
  if (final.state !== "MERGED") return { status: "queued", subject, url: pr.url };
  finishRun(pr, runId, "merged");
  return { status: "merged", subject, overridden: checks.overridden ?? [] };
}
function orcaExecutable(): string {
  return process.env.ORCA_CLI_COMMAND ?? (process.env.ORCA_DEV_REPO_ROOT ? "orca-dev" : process.platform === "linux" ? "orca-ide" : "orca");
}
function parseCurrentWorktree(stdout: string): string | { error: string } {
  let value: unknown;
  try { value = JSON.parse(stdout) as unknown; } catch { return { error: "invalid Orca response" }; }
  if (!value || typeof value !== "object") return { error: "invalid Orca response" };
  const worktree = (value as { result?: { worktree?: { id?: unknown; isMainWorktree?: unknown } } }).result?.worktree;
  if (worktree?.isMainWorktree !== false || typeof worktree.id !== "string") return { error: "invalid Orca current worktree response" };
  return worktree.id;
}
async function removeCapturedWorktree(executable: string, id: string, runner: CommandRunner): Promise<{ cleanup: string }> {
  const selector = `id:${id}`;
  const removed = await runner(executable, ["worktree", "rm", "--worktree", selector, "--force", "--json"], process.env, repositoryRoot);
  return removed.ok ? { cleanup: `remove:${id}` } : { cleanup: `cleanup failed: ${removed.stderr || removed.stdout || "Orca remove failed"}` };
}
export async function cleanup(pr: Snapshot, runner: CommandRunner): Promise<{ cleanup: string }> {
  const gitDir = await invoke(runner, "git", ["rev-parse", "--path-format=absolute", "--git-dir"], { cwd: repositoryRoot });
  const commonDir = await invoke(runner, "git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], { cwd: repositoryRoot });
  if (gitDir === commonDir) return { cleanup: "primary" };
  const executable = orcaExecutable();
  if (!(await runner(executable, ["--version"], process.env, repositoryRoot)).ok) return { cleanup: "skipped (Orca unavailable)" };
  const current = await runner(executable, ["worktree", "current", "--json"], process.env, repositoryRoot);
  if (!current.ok) return /selector_not_found/.test(current.stdout) ? { cleanup: "skipped (outside Orca)" } : { cleanup: `cleanup failed: ${current.stderr || current.stdout || "Orca current failed"}` };
  const worktree = parseCurrentWorktree(current.stdout);
  if (typeof worktree !== "string") return { cleanup: `cleanup failed: ${worktree.error}` };
  return removeCapturedWorktree(executable, worktree, runner);
}
