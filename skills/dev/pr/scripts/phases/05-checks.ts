import { summarizeChecks } from "../../../../../lib/pr/facts.ts";
import { checkState } from "../../../../../lib/pr-state.ts";
import { updatePrStore, readPrStore } from "../../../../../lib/pr/store.ts";
import { invoke, parseJson, isRecord, blocked, type CommandRunner, type Clock } from "../core/runner.ts";
import { refresh, type Snapshot } from "../core/resolve.ts";
import { identityOf, statePath } from "../core/run.ts";
import { option, list, boolean } from "../cli/args.ts";
import { requireRun } from "../core/runner.ts";
import type { MutationContext } from "../core/commands.ts";
function requiredState(pr: Snapshot, name: string): "passed" | "failed" | "pending" | "needs_policy_proof" {
  const check = pr.checks.find((item) => item.name === name);
  if (!check) return "pending";
  const raw = check.typename === "CheckRun" ? check.conclusion ?? check.status : check.state;
  if (/^(NEUTRAL|SKIPPED)$/i.test(raw)) return "needs_policy_proof";
  const state = checkState(check.typename === "CheckRun"
    ? { __typename: "CheckRun", status: check.status, conclusion: check.conclusion }
    : { __typename: "StatusContext", state: check.state });
  return state === "pass" ? "passed" : state === "pending" ? "pending" : "failed";
}
export async function inventory(pr: Snapshot, runner: CommandRunner): Promise<unknown> {
  const [protection, rulesets, workflows] = await Promise.all([
    branchProtection(pr, runner),
    invoke(runner, "gh", ["api", `repos/${pr.repo}/rulesets?per_page=100`, "--paginate", "--slurp"]).then((value) => JSON.parse(value) as unknown),
    invoke(runner, "gh", ["api", `repos/${pr.repo}/actions/workflows?per_page=100`, "--paginate", "--slurp"]).then((value) => JSON.parse(value) as unknown),
  ]);
  return { protection, rulesets, workflows, checks: pr.checks };
}
async function branchProtection(pr: Snapshot, runner: CommandRunner): Promise<unknown | null> {
  const result = await runner("gh", ["api", `repos/${pr.repo}/branches/${encodeURIComponent(pr.baseRefName)}/protection`], process.env);
  if (!result.ok && /404|not found/i.test(result.stderr)) return null;
  if (!result.ok) return blocked("gh API", result.stderr || "branch protection query failed", "complete branch protection data");
  return result.stdout ? JSON.parse(result.stdout) as unknown : null;
}
export async function rerunCancelled(pr: Snapshot, runId: string, runner: CommandRunner): Promise<{ rerun: string[]; skipped: string[]; head: string }> {
  const identity = identityOf(pr); const path = statePath(pr);
  const store = readPrStore(path, identity); const prior = store.cancelledCheckReruns[pr.headRefOid] ?? [];
  const cancelled = summarizeChecks(pr.checks).cancelled.filter((id) => !prior.includes(id));
  const rerun: string[] = []; const skipped: string[] = [];
  for (const id of cancelled) {
    const check = pr.checks.find((item) => (item.url ?? "").split("/").at(-1) === id || item.name === id);
    const jobId = await actionsJobId(pr, check, runner);
    if (!jobId) { skipped.push(id); continue; }
    await invoke(runner, "gh", ["run", "rerun", "--job", jobId, "--repo", pr.repo], { write: "rerun-check" }); rerun.push(id);
    updatePrStore(path, identity, (current) => { current.cancelledCheckReruns[pr.headRefOid] = [...(current.cancelledCheckReruns[pr.headRefOid] ?? []), id]; });
  }
  return { rerun, skipped, head: pr.headRefOid };
}
async function actionsJobId(pr: Snapshot, check: Snapshot["checks"][number] | undefined, runner: CommandRunner): Promise<string | null> {
  const url = check?.url ?? "";
  const direct = /\/runs\/\d+\/job\/(\d+)/.exec(url);
  if (direct) return direct[1]!;
  const run = /\/actions\/runs\/(\d+)/.exec(url);
  if (!run || !check) return null;
  const response = parseJson(await invoke(runner, "gh", ["api", `repos/${pr.repo}/actions/runs/${run[1]}/jobs?per_page=100`]), isRecord, "Actions jobs API");
  if (!Array.isArray(response.jobs)) return blocked("Actions jobs", `run ${run[1]} returned no jobs`, "complete Actions job data");
  const job = response.jobs.find((value) => isRecord(value) && value.name === check.name && Number.isSafeInteger(value.id));
  return isRecord(job) ? String(job.id) : null;
}
type CheckOutcome = { status: "passed" | "failed" | "pending" | "needs_policy_proof" | "overridden"; checks?: string[]; needs_policy_proof?: string[]; overridden?: string[] };
function outcomeFor(states: { name: string; state: ReturnType<typeof requiredState> }[], names: string[], force: boolean): CheckOutcome | null {
  const failed = states.filter((item) => item.state === "failed").map((item) => item.name);
  const pending = states.filter((item) => item.state === "pending").map((item) => item.name);
  const policyProof = states.filter((item) => item.state === "needs_policy_proof").map((item) => item.name);
  if (force && (failed.length || pending.length || policyProof.length)) return { status: "overridden", overridden: [...failed, ...pending, ...policyProof] };
  if (failed.length) return { status: "failed", checks: failed };
  if (policyProof.length) return { status: "needs_policy_proof", needs_policy_proof: policyProof };
  if (!names.length) return { status: "needs_policy_proof", needs_policy_proof: ["no required checks supplied"] };
  return pending.length ? null : { status: "passed", checks: names };
}
export async function waitChecks(pr: Snapshot, names: string[], timeoutMs: number, force: boolean, runner: CommandRunner, clock: Clock): Promise<CheckOutcome> {
  const start = clock.now();
  while (true) {
    const current = await refresh(pr, runner);
    if (current.headRefOid !== pr.headRefOid || current.baseRefOid !== pr.baseRefOid) blocked("check snapshot changed", "base or head changed while waiting", "stable authoritative PR snapshot");
    const outcome = outcomeFor(names.map((name) => ({ name, state: requiredState(current, name) })), names, force);
    if (outcome) return outcome;
    const pending = names.filter((name) => requiredState(current, name) === "pending");
    const remaining = timeoutMs - (clock.now() - start);
    if (remaining <= 0) return { status: "pending", checks: pending };
    await clock.sleep(Math.min(60_000, remaining));
  }
}
export function parseTimeout(value: string | undefined): number {
  if (!value) return 30 * 60_000;
  const match = /^(\d+)(m|h)$/.exec(value);
  if (!match) return blocked("check timeout", value, "a timeout such as 30m");
  return Number(match[1]) * (match[2] === "h" ? 60 : 1) * 60_000;
}

export async function checksCommand({ args, pr, runner, clock, runId }: MutationContext): Promise<unknown> {
  const [operation] = args;
  if (operation === "inventory") return inventory(pr, runner);
  if (operation === "rerun-cancelled") return rerunCancelled(pr, requireRun(runId), runner);
  if (operation === "wait") {
    const required = list(args, "--required");
    if (!required.length) return blocked("check arguments", "--required needs at least one check name", "required check names");
    return waitChecks(pr, required, parseTimeout(option(args, "--timeout")), boolean(args, "--force"), runner, clock);
  }
  return blocked("usage", "unknown checks operation", "inventory, rerun-cancelled, or wait");
}
