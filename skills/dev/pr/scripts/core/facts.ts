import { readPrStore, findPrPacket } from "../../../../../lib/pr/store.ts";
import { summarizeChecks } from "../../../../../lib/pr/facts.ts";
import { identityOf, statePath } from "./run.ts";
import { policyHash, targetRoot } from "./resolve.ts";
import { invoke, blocked, type CommandRunner } from "./runner.ts";
import type { Snapshot } from "./resolve.ts";
import type { LifecycleFacts } from "./lifecycle.ts";
import { judgmentInputs as parseJudgments } from "../cli/args.ts";
export function localHeadUnavailable(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return /^blocked: git repository root/.test(error.message) || /^blocked: git API — .*(?:not a tree object|not a valid object name|bad object|could not get object info)/i.test(error.message);
}
async function localCommitFacts(pr: Snapshot, runner: CommandRunner): Promise<{ unpushed: boolean; dirty: boolean }> {
  if (pr.owner !== "own" || pr.fork) return { unpushed: false, dirty: false };
  const root = await targetRoot(runner);
  const branch = await invoke(runner, "git", ["branch", "--show-current"], { cwd: root });
  if (branch !== pr.headRefName) return { unpushed: false, dirty: false };
  const git = async (args: string[]) => runner("git", args, process.env, root);
  const upstream = await git(["rev-list", "--count", "@{u}..HEAD"]);
  if (!upstream.ok && !/no upstream|unknown revision|ambiguous argument/i.test(upstream.stderr)) return blocked("local commit facts", upstream.stderr || "git query failed", "complete local/upstream commit state");
  const localStatus = await git(["status", "--porcelain"]);
  if (!localStatus.ok) return blocked("local commit facts", localStatus.stderr || "git status failed", "complete working-tree state");
  return { unpushed: Number(upstream.stdout.trim()) > 0, dirty: Boolean(localStatus.stdout.trim()) };
}
export function isPlaceholderDescription(title: string, body: string): boolean {
  return !title.trim() || /^(?:title|placeholder|todo)\b/i.test(title) || ["Summary", "Changes", "Testing"].some((heading) => !new RegExp(`^## ${heading}\\s*$`, "m").test(body));
}
export function descriptionFacts(pr: Snapshot, judged: Map<string, boolean>, described: boolean): Pick<LifecycleFacts, "placeholder" | "staleDescription" | "claimsUnverified"> {
  const section = pr.body.split(/(?=^## )/m).find((part) => /^## Evidence\s*$/m.test(part.split("\n")[0] ?? ""));
  const evidence = section?.split("\n").slice(1).join("\n") ?? "";
  const claimsVerified = Boolean(evidence) && new RegExp(`(?:head|headRefOid)\\s*[:=]\\s*${pr.headRefOid}\\b`, "i").test(evidence);
  return { placeholder: isPlaceholderDescription(pr.title, pr.body), staleDescription: judged.has("description-staleness") ? !judged.get("description-staleness") : described ? false : null, claimsUnverified: !claimsVerified };
}
export async function lifecycleFacts(pr: Snapshot, args: string[], runner: CommandRunner, rerequest: (pr: Snapshot, runner: CommandRunner, dryRun: boolean) => Promise<unknown>): Promise<LifecycleFacts> {
  const judged = parseJudgments(args);
  const local = await localCommitFacts(pr, runner);
  const checks = summarizeChecks(pr.checks);
  const store = readPrStore(statePath(pr), identityOf(pr));
  let packet = null;
  try {
    const policy = await policyHash(pr.headRefOid, runner);
    packet = findPrPacket(store, pr.baseRefOid, pr.headRefOid, policy);
  } catch (error) {
    if (!localHeadUnavailable(error)) throw error;
  }
  const described = store.describedHeads.includes(pr.headRefOid);
  const reviewerState = await rerequest(pr, runner, true) as { requested?: string[] };
  return { resolved: true, exists: pr.state.toUpperCase() !== "NOT_FOUND", unpushed: local.unpushed, dirtyValidated: local.dirty,
    ...descriptionFacts(pr, judged, described), uiChangedNoScreenshots: judged.has("ui-evidence") ? !judged.get("ui-evidence") : undefined,
    behind: pr.mergeStateStatus === "BEHIND", conflicting: ["DIRTY", "CONFLICTING"].includes(pr.mergeStateStatus),
    stackOutOfOrder: pr.stack !== null && pr.mergeStateStatus === "BEHIND", checksObserved: checks.total > 0,
    requiredCheckFailedOrMissing: judged.has("required-check-policy") ? (checks.failed.length > 0 && !judged.get("required-check-policy")) : checks.failed.length ? true : null,
    packetComplete: packet?.verdict === "clean", docsOnlyClean: store.docsOnlyResults[`${pr.baseRefOid}..${pr.headRefOid}`] === true,
    unresolvedThreads: pr.threads.filter((thread) => !thread.isResolved).length,
    addressedReviewers: Boolean(reviewerState.requested?.length), isDraft: pr.isDraft, requiredCheckPolicyKnown: judged.has("required-check-policy") };
}
