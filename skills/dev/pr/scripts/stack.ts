import { invoke, blocked, isRecord, type CommandRunner, type CommandResult } from "./runner.ts";
import { targetRoot } from "./resolve.ts";

const STACK_RECOVERY: Record<number, [string, string]> = {
  1: ["generic gh-stack error", "inspect the reported error and retry"],
  2: ["not in a stack or stack not found", "initialize a stack or verify the stack number"],
  3: ["rebase conflict", "resolve the reported files, stage them, and run gh stack rebase --continue"],
  4: ["GitHub API failure", "check gh auth status, then retry"],
  5: ["invalid gh-stack arguments", "correct the arguments and run gh stack top before add"],
  6: ["branch belongs to multiple stacks", "check out a non-shared branch first"],
  7: ["rebase already in progress", "resolve and continue, or abort the existing rebase"],
  8: ["stack locked by another process", "wait for the lock to clear, then retry"],
  9: ["stacked PRs are not enabled for this repository", "use the T2/T3 fallback"],
};
function failedStack(result: CommandResult, action: string): never {
  blocked("stack operation", `${action}: ${stackFailureReason(result)}`, stackRecovery(result));
}
function stackFailureReason(result: CommandResult): string {
  const [reason] = recoveryFor(result);
  return result.stderr ? `${reason} (${result.stderr})` : reason;
}
function stackRecovery(result: CommandResult): string {
  return recoveryFor(result)[1];
}
function recoveryFor(result: CommandResult): [string, string] {
  const code = Number.isInteger(result.exitCode) ? result.exitCode! : 1;
  return STACK_RECOVERY[code] ?? STACK_RECOVERY[1]!;
}
function hasExtension(output: string): boolean { return output.split("\n").some((line) => /gh-stack/i.test(line)); }
async function stackRepository(runner: CommandRunner, explicit?: string): Promise<string> {
  if (explicit && /^[^/]+\/[^/]+$/.test(explicit)) return explicit;
  const result = await invoke(runner, "gh", ["repo", "view", "--json", "nameWithOwner"]);
  try {
    const parsed = JSON.parse(result) as { nameWithOwner?: unknown };
    if (typeof parsed.nameWithOwner === "string" && /^[^/]+\/[^/]+$/.test(parsed.nameWithOwner)) return parsed.nameWithOwner;
  } catch { /* handled below */ }
  return blocked("stack capability", "repository nameWithOwner missing or invalid", "valid owner/repo context");
}
async function setIfUnset(runner: CommandRunner, key: string, value: string): Promise<void> {
  const root = await targetRoot(runner);
  const current = await runner("git", ["config", "--get", key], process.env, root);
  if (current.ok) return;
  if (current.exitCode !== 1) return blocked("stack preflight", current.stderr || `cannot read ${key}`, `verified ${key} configuration`);
  const set = await runner("git", ["config", key, value], process.env, root);
  if (!set.ok) blocked("stack preflight", set.stderr || `cannot set ${key}`, `set ${key} to ${value}`);
}
async function preflight(runner: CommandRunner): Promise<void> {
  const root = await targetRoot(runner);
  await setIfUnset(runner, "rerere.enabled", "true");
  const remotes = await runner("git", ["remote"], process.env, root);
  if (!remotes.ok) return blocked("stack preflight", remotes.stderr || "cannot list remotes", "available git remote configuration");
  if (remotes.stdout.trim().split(/\s+/).filter(Boolean).length > 1) await setIfUnset(runner, "remote.pushDefault", "origin");
}
async function restFeature(repo: string, runner: CommandRunner): Promise<boolean> {
  const result = await runner("gh", ["api", `repos/${repo}/stacks`], process.env);
  if (result.ok) return true;
  if (/404|not found/i.test(result.stderr)) return false;
  return blocked("stack capability", result.stderr || "Stacks REST probe failed", "successful stack API probe or confirmed unsupported endpoint");
}
export async function probe(runner: CommandRunner, repoOverride?: string): Promise<{ tier: "T1" | "T2" | "T3"; extension: boolean; feature: boolean }> {
  const extensionResult = await runner("gh", ["extension", "list"], process.env);
  if (!extensionResult.ok) return blocked("stack capability", extensionResult.stderr || "extension listing failed", "successful gh extension query");
  const extension = hasExtension(extensionResult.stdout);
  const repo = await stackRepository(runner, repoOverride);
  const feature = await restFeature(repo, runner);
  if (!feature) return { tier: "T3", extension, feature: false };
  if (!extension) return { tier: "T2", extension, feature: true };
  const cli = await runner("gh", ["stack", "view", "--json"], process.env);
  if (!cli.ok && cli.exitCode === 9) return { tier: "T2", extension: true, feature: true };
  if (!cli.ok) failedStack(cli, "gh stack view --json");
  await preflight(runner);
  return { tier: "T1", extension: true, feature: true };
}
function validStackLinkInput(repo: string, numbers: string[]): void {
  if (!/^[^/]+\/[^/]+$/.test(repo) || numbers.length < 2 || numbers.some((value) => !/^\d+$/.test(value))) blocked("stack link", "at least two PR numbers and explicit owner/repo are required", "explicit bottom-to-top PR numbers");
}
function shaField(value: unknown): string | undefined { return isRecord(value) && typeof value.sha === "string" ? value.sha : undefined; }
function stackPullIdentity(value: unknown, number: string): { base: string; head: string } {
  const head = isRecord(value) ? shaField(value.head) : undefined;
  const base = isRecord(value) ? shaField(value.base) : undefined;
  if (!head || !base) return blocked("stack link", `PR #${number} has incomplete base/head identity`, "complete PR base/head data");
  return { base, head };
}
async function verifyStackChain(repo: string, numbers: string[], runner: CommandRunner): Promise<void> {
  let priorHead: string | undefined;
  for (const number of numbers) {
    const raw = JSON.parse(await invoke(runner, "gh", ["api", `repos/${repo}/pulls/${number}`])) as unknown;
    const identity = stackPullIdentity(raw, number);
    if (priorHead && identity.base !== priorHead) blocked("stack link", `PR #${number} base does not equal prior PR head`, "a verified bottom-to-top base chain");
    priorHead = identity.head;
  }
}
export async function link(repo: string, numbers: string[], runner: CommandRunner): Promise<unknown> {
  validStackLinkInput(repo, numbers);
  await verifyStackChain(repo, numbers, runner);
  const args = ["api", `repos/${repo}/stacks`, "-X", "POST", ...numbers.flatMap((number) => ["-F", `pull_requests[]=${number}`])];
  return JSON.parse(await invoke(runner, "gh", args, { write: "stack-link" }));
}
export async function collapseCheck(heads: string[], runner: CommandRunner): Promise<{ collapseAllowed: true; heads: string[] }> {
  const root = await targetRoot(runner);
  if (heads.length < 2) return blocked("stack collapse", "at least two stack heads are required", "a linear stack with a survivor");
  const survivor = heads.at(-1)!;
  for (const head of heads.slice(0, -1)) {
    const result = await runner("git", ["merge-base", "--is-ancestor", head, survivor], process.env, root);
    if (!result.ok) return blocked("stack ancestry", `${head} is not an ancestor of ${survivor}`, "survivor containing every lower head");
  }
  const status = await runner("git", ["status", "--porcelain"], process.env, root);
  if (!status.ok || status.stdout.trim()) return blocked("stack collapse", status.stderr || "working tree is dirty or unavailable", "clean working tree");
  const rebase = await runner("git", ["rev-parse", "--verify", "REBASE_HEAD"], process.env, root);
  if (rebase.ok) return blocked("stack collapse", "a rebase is in progress", "finish or abort the rebase first");
  if (!/Needed a single revision|unknown revision|fatal: Needed/i.test(rebase.stderr)) return blocked("stack collapse", rebase.stderr || "cannot determine rebase state", "verified no rebase in progress");
  return { collapseAllowed: true, heads };
}
