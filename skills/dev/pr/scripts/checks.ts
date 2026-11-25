import { summarizeChecks } from "../../../../lib/pr/facts.ts";
import { updatePrStore, readPrStore } from "../../../../lib/pr/store.ts";
import { invoke, parseJson, isRecord, blocked, type CommandRunner, type Clock } from "./runner.ts";
import { repositoryRoot, snapshot, type Snapshot } from "./resolve.ts";
import { identityOf, statePath } from "./run.ts";
function requiredState(pr: Snapshot, name: string): "passed" | "failed" | "pending" | "needs_policy_proof" {
  const check = pr.checks.find((item) => item.name === name);
  if (!check) return "pending";
  const state = check.typename === "CheckRun" ? check.conclusion ?? check.status : check.state;
  if (/^(SUCCESS|SUCCESSFUL)$/i.test(state)) return "passed";
  if (/^(NEUTRAL|SKIPPED)$/i.test(state)) return "needs_policy_proof";
  if (/^(FAILURE|FAILED|ERROR|TIMED_OUT|ACTION_REQUIRED)$/i.test(state)) return "failed";
  return "pending";
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
  const result = await runner("gh", ["api", `repos/${pr.repo}/branches/${encodeURIComponent(pr.baseRefName)}/protection`], process.env, repositoryRoot);
  if (!result.ok && /404|not found/i.test(result.stderr)) return null;
  if (!result.ok) return blocked("gh API", result.stderr || "branch protection query failed", "complete branch protection data");
  return result.stdout ? JSON.parse(result.stdout) as unknown : null;
}
export async function rerunCancelled(pr: Snapshot, runId: string, runner: CommandRunner): Promise<{ rerun: string[]; head: string }> {
  const identity = identityOf(pr); const path = statePath(pr);
  const store = readPrStore(path, identity); const prior = store.cancelledCheckReruns[pr.headRefOid] ?? [];
  const cancelled = summarizeChecks(pr.checks).cancelled.filter((id) => !prior.includes(id));
  for (const id of cancelled) await invoke(runner, "gh", ["run", "rerun", id, "--failed", "--repo", pr.repo], { write: "rerun-check" });
  updatePrStore(path, identity, (current) => { current.cancelledCheckReruns[pr.headRefOid] = [...prior, ...cancelled]; });
  return { rerun: cancelled, head: pr.headRefOid };
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
    const current = await snapshot(String(pr.number), runner);
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
