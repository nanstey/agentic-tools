import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { readPrStore, putPrPacket, findPrPacket, updatePrStore } from "../../../../lib/pr/store.ts";
import { realpathSync } from "node:fs";
import { authorize, AUTHORIZATION_TABLE, renderAuthorizationTable, type Action, type Mode, type PrOwner } from "./authorize.ts";
import { nextPhase, type LifecycleFacts } from "./lifecycle.ts";
import { snapshot, policyHash, targetRoot } from "./resolve.ts";
import { summarizeChecks } from "../../../../lib/pr/facts.ts";
import { systemClock, systemRunner, requireRun, blocked, invoke, isRecord, type Clock, type CommandRunner } from "./runner.ts";
import { changeRun, finishRun, getRun, identityOf, startRun, statePath } from "./run.ts";
import { guard, draft, push } from "./guard.ts";
import { inventory, parseTimeout, rerunCancelled, waitChecks } from "./checks.ts";
import { attach, updateBody } from "./body.ts";
import { threads, rerequest, replyThread, resolveThread } from "./threads.ts";
import { cleanup, merge } from "./merge.ts";
import { disclosureHeader, marker, postReview, react } from "./review.ts";
import { readFileSync } from "node:fs";
import { docsOnly } from "./docs-only.ts";
import { collapseCheck, link, probe } from "./stack.ts";

export { AUTHORIZATION_TABLE, renderAuthorizationTable, nextPhase };
export type { CommandRunner, Clock };
function option(args: string[], name: string): string | undefined { return parseArguments(args).flags.get(name)?.[0]; }
function firstTarget(args: string[]): string | undefined { return parseArguments(args).positionals[0]; }
const parsedArguments = new WeakMap<string[], { positionals: string[]; flags: Map<string, string[]> }>();
const BOOLEAN_FLAGS = new Set(["--force", "--dry-run", "--preserve-evidence", "--no-required-checks", "--force-with-lease", "--drafted-for-changes"]);
const MULTI_FLAGS = new Set(["--required", "--finding", "--coverage", "--judged"]);
function parseFlag(args: string[], index: number, flags: Map<string, string[]>): number {
  const token = args[index]!; const values = flags.get(token) ?? []; flags.set(token, values);
  if (BOOLEAN_FLAGS.has(token)) { values.push("true"); return index; }
  if (MULTI_FLAGS.has(token)) return parseMultiValues(args, index, values);
  if (args[index + 1] && !args[index + 1]!.startsWith("--")) { values.push(args[index + 1]!); return index + 1; }
  return index;
}
function parseMultiValues(args: string[], index: number, values: string[]): number {
  while (args[index + 1] && !args[index + 1]!.startsWith("--")) values.push(args[++index]!);
  return index;
}
export function parseArguments(args: string[]): { positionals: string[]; flags: Map<string, string[]> } {
  const cached = parsedArguments.get(args); if (cached) return cached;
  const positionals: string[] = []; const flags = new Map<string, string[]>();
  for (let i = 0; i < args.length; i++) {
    if (args[i]!.startsWith("--")) i = parseFlag(args, i, flags);
    else positionals.push(args[i]!);
  }
  const result = { positionals, flags }; parsedArguments.set(args, result); return result;
}
function positional(args: string[]): string | undefined {
  return parseArguments(args).positionals.find((value) => !["force", "inventory", "rerun-cancelled", "wait"].includes(value));
}
function boolean(args: string[], name: string): boolean { return parseArguments(args).flags.has(name); }
export function list(args: string[], name: string): string[] { return parseArguments(args).flags.get(name) ?? []; }
function modeValue(value: string | undefined): Mode { return value === "fix" || value === "comment" || value === "report" || value === "force" ? value : "none"; }
function actionValue(value: string | undefined): Action { if (value && value in AUTHORIZATION_TABLE) return value as Action; return blocked("authorization action", value ?? "missing action", "a declared /pr action"); }
function localHeadUnavailable(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return /^blocked: git repository root/.test(error.message) || /^blocked: git API — .*(?:not a tree object|not a valid object name|bad object|could not get object info)/i.test(error.message);
}
function ownerValue(value: string | undefined): PrOwner { return value === "other" || value === "fork" ? value : "own"; }
const JUDGMENT_NAMES = new Set(["description-staleness", "ui-evidence", "required-check-policy", "claims-verification-evidence"]);
function judgmentInputs(args: string[]): Map<string, boolean> {
  const judged = new Map<string, boolean>();
  for (const value of list(args, "--judged")) {
    const [test, result, extra] = value.split("=");
    if (!test || !JUDGMENT_NAMES.has(test) || extra !== undefined || !["pass", "fail"].includes(result ?? "")) return blocked("judgment input", value, "--judged <description-staleness|ui-evidence|required-check-policy|claims-verification-evidence>=<pass|fail>");
    judged.set(test, result === "pass");
  }
  return judged;
}
function assertAuthorized(run: ReturnType<typeof getRun>, owner: PrOwner, mutation: string): void {
  const mode = run.force ? "force" : modeValue(run.mode ?? undefined);
  const action = ["ready", "merge"].includes(run.action) && !["convert-ready", "merge"].includes(mutation) ? "lifecycle" : run.action;
  if (!authorize(actionValue(action), mode, owner).includes(mutation)) blocked("authorization", `${mutation} is not allowed for ${action}/${mode}/${owner}`, "an authorized action, mode, and PR owner");
}
async function localCommitFacts(pr: Awaited<ReturnType<typeof snapshot>>, runner: CommandRunner): Promise<{ unpushed: boolean; dirty: boolean }> {
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
function descriptionFacts(pr: Awaited<ReturnType<typeof snapshot>>, judged: Map<string, boolean>, described: boolean): Pick<LifecycleFacts, "placeholder" | "staleDescription" | "claimsUnverified"> {
  const section = pr.body.split(/(?=^## )/m).find((part) => /^## Evidence\s*$/m.test(part.split("\n")[0] ?? ""));
  const evidence = section?.split("\n").slice(1).join("\n") ?? "";
  const claimsVerified = Boolean(evidence) && new RegExp(`(?:head|headRefOid)\\s*[:=]\\s*${pr.headRefOid}\\b`, "i").test(evidence);
  return { placeholder: isPlaceholderDescription(pr.title, pr.body), staleDescription: judged.has("description-staleness") ? !judged.get("description-staleness") : described ? false : null, claimsUnverified: !claimsVerified };
}
async function lifecycleFacts(pr: Awaited<ReturnType<typeof snapshot>>, args: string[], runner: CommandRunner): Promise<LifecycleFacts> {
  const judged = judgmentInputs(args);
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
export async function execute(args: string[], runner: CommandRunner = systemRunner, clock: Clock = systemClock): Promise<unknown> {
  const [command, ...rest] = args;
  if (!command) return blocked("usage", "missing subcommand", "pr <subcommand>");
  parseArguments(rest);
  const routes: Record<string, (values: string[]) => Promise<unknown>> = {
    snapshot: (values) => snapshotCommand(values, runner),
    next: (values) => nextCommand(values, runner),
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
    guard: (values) => mutationCommand(command, values, runner, clock),
    draft: (values) => mutationCommand(command, values, runner, clock),
    push: (values) => mutationCommand(command, values, runner, clock),
    rerequest: (values) => mutationCommand(command, values, runner, clock),
    body: (values) => mutationCommand(command, values, runner, clock),
    attach: (values) => mutationCommand(command, values, runner, clock),
    merge: (values) => mutationCommand(command, values, runner, clock),
    cleanup: (values) => mutationCommand(command, values, runner, clock),
    checks: (values) => mutationCommand(command, values, runner, clock),
  };
  const handler = routes[command];
  if (!handler) return blocked("usage", `unknown or incomplete subcommand ${command}`, "a supported pr subcommand");
  return handler(rest);
}
function snapshotTarget(args: string[], runner: CommandRunner) { return snapshot(positional(args), runner); }
async function snapshotCommand(args: string[], runner: CommandRunner): Promise<unknown> {
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
async function nextCommand(args: string[], runner: CommandRunner): Promise<unknown> {
  const idValue = option(args, "--run");
  const result = await snapshotCommand(args, runner);
  if (isRecord(result) && result.exists === false) return nextPhase({ resolved: true, exists: false });
  const pr = await snapshotTarget(args, runner);
  const store = readPrStore(statePath(pr), identityOf(pr));
  const run = idValue ? store.runs[requireRun(idValue)] : undefined;
  const facts = await lifecycleFacts(pr, args, runner);
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
async function authorizeCommand(args: string[], runner: CommandRunner): Promise<unknown> {
  const action = actionValue(args[0]); const mode = modeValue(args[1] ?? (boolean(args, "--force") ? "force" : undefined)); const target = option(args, "--pr");
  const owner = option(args, "--owner") ? ownerValue(option(args, "--owner")) : target ? (await snapshot(target, runner)).owner : "own";
  return { action, mode, owner, allowed: authorize(action, mode, owner), table: renderAuthorizationTable() };
}
async function docsOnlyCommand(args: string[], runner: CommandRunner): Promise<unknown> {
  const base = args[0] && !args[0].startsWith("--") ? args[0] : undefined;
  const head = args[1] && !args[1].startsWith("--") ? args[1] : undefined;
  if (!base || !head) return blocked("usage", "base and head are required", "pr docs-only <base> <head>");
  const result = await docsOnly(base, head, runner, option(args, "--skill-dir"));
  await recordDocsOnlyResult(args, base, head, result.clean, runner);
  return result;
}
async function recordDocsOnlyResult(args: string[], base: string, head: string, clean: boolean, runner: CommandRunner): Promise<void> {
  const runId = option(args, "--run"); if (!runId) return;
  const target = option(args, "--pr"); if (!target) return blocked("docs-only arguments", "--pr is required when recording a run result", "pr docs-only <base> <head> --run <id> --pr <pr>");
  const pr = await snapshot(target, runner); getRun(pr, runId);
  if (base !== pr.baseRefOid || head !== pr.headRefOid) return blocked("docs-only identity", "base/head do not match the PR snapshot", "the exact PR base and head OIDs");
  const key = `${pr.baseRefOid}..${pr.headRefOid}`; updatePrStore(statePath(pr), identityOf(pr), (store) => { store.docsOnlyResults[key] = clean; });
}
const FULL_OID = /^[a-f\d]{40}$/;
async function packetPolicy(pr: Awaited<ReturnType<typeof snapshot>>, runner: CommandRunner, head = pr.headRefOid): Promise<string> {
  try { return await policyHash(head, runner); }
  catch (error) {
    if (localHeadUnavailable(error)) return blocked("policy hash", `head ${head} is unavailable locally`, `fetch pull/${pr.number}/head first`);
    throw error;
  }
}
async function packetGet(args: string[], pr: Awaited<ReturnType<typeof snapshot>>, runner: CommandRunner): Promise<unknown> {
  const base = option(args, "--base"); const head = option(args, "--head");
  if (!base || !head) return blocked("packet arguments", "base and head are required", "pr packet get <pr> --base <oid> --head <oid>");
  if (!FULL_OID.test(head)) return blocked("packet arguments", `invalid head ${head}`, "a lowercase full head OID");
  const policy = option(args, "--policy") ?? await packetPolicy(pr, runner, head);
  return { packet: findPrPacket(readPrStore(statePath(pr), identityOf(pr)), base, head, policy) };
}
function parsePacketRows(values: string[], sep: string, field: string): [string, string][] {
  return values.map((value) => { const at = value.indexOf(sep); if (at < 1 || at === value.length - 1) return blocked("packet arguments", value, `valid ${field} entries`); return [value.slice(0, at), value.slice(at + 1)]; });
}
async function packetPut(args: string[], pr: Awaited<ReturnType<typeof snapshot>>, runner: CommandRunner): Promise<unknown> {
  const required = ["--run", "--base", "--head", "--depth", "--reason", "--verdict"];
  if (required.some((key) => !option(args, key))) return blocked("packet arguments", "required packet field missing", "run, base, head, depth, reason, verdict");
  const packetHead = option(args, "--head")!;
  if (!FULL_OID.test(packetHead)) return blocked("packet arguments", `invalid head ${packetHead}`, "a lowercase full head OID");
  const policy = option(args, "--policy") ?? await packetPolicy(pr, runner, packetHead);
  const run = getRun(pr, option(args, "--run")!); if (run.round > run.limit) return blocked("round limit", `round ${run.round} exceeds limit ${run.limit}`, "a valid active run");
  const verdict = option(args, "--verdict")!;
  if (!["clean", "changes_required", "incomplete"].includes(verdict)) return blocked("packet verdict", verdict, "clean, changes_required, or incomplete");
  const findings = parsePacketRows(list(args, "--finding"), ":", "finding").map(([id, category]) => ({ id, category }));
  const coverage = parsePacketRows(list(args, "--coverage"), "=", "coverage").map(([path, status]) => ({ path, status }));
  const packet = { base: option(args, "--base")!, head: packetHead, policy, depth: option(args, "--depth")!, reason: option(args, "--reason")!, verdict, findings, coverage, storedAt: new Date().toISOString() };
  putPrPacket(statePath(pr), identityOf(pr), packet); return { packet };
}
async function packetCommand(args: string[], runner: CommandRunner): Promise<unknown> {
  const pr = await snapshot(args[1], runner);
  if (args[0] === "get") return packetGet(args, pr, runner);
  if (args[0] === "put") return packetPut(args, pr, runner);
  return blocked("usage", "expected packet put or get", "pr packet put|get");
}
async function reactCommand(args: string[], runner: CommandRunner): Promise<unknown> {
  const operation = args[0];
  const pr = await snapshot(firstTarget(args.slice(1)), runner); const run = getRun(pr, requireRun(option(args, "--run"))); assertAuthorized(run, pr.owner, "react");
  return react(pr, operation!, runner);
}
async function reviewCommand(args: string[], runner: CommandRunner): Promise<unknown> {
  if (args[0] !== "post") return blocked("usage", "expected review post", "pr review post <pr>");
  const pr = await snapshot(args[1], runner); const run = getRun(pr, requireRun(option(args, "--run"))); assertAuthorized(run, pr.owner, "post-review");
  const event = option(args, "--event"); const bodyFile = option(args, "--body-file");
  if (!event || !bodyFile) return blocked("review arguments", "event and body file are required", "--event <E> --body-file <f>");
  let comments: unknown[] = [];
  const commentsFile = option(args, "--comments-file"); if (commentsFile) { const parsed: unknown = JSON.parse(readFileSync(commentsFile, "utf8")); if (!Array.isArray(parsed)) return blocked("review comments", "comments file must be an array", "JSON array of inline comments"); comments = parsed; }
  return postReview(pr, event, readFileSync(bodyFile, "utf8"), comments, runner);
}
async function threadCommand(args: string[], runner: CommandRunner): Promise<unknown> {
  const pr = await snapshot(firstTarget(args.slice(1)), runner); const run = getRun(pr, requireRun(option(args, "--run"))); assertAuthorized(run, pr.owner, args[0] === "reply" ? "post-comment" : "resolve-threads");
  const id = option(args, "--thread"); if (!id) return blocked("thread arguments", "thread id is required", "--thread <id>");
  if (!pr.threads.some((thread) => thread.id === id)) return blocked("thread target", id, "a thread belonging to the target PR");
  if (args[0] === "reply") { const file = option(args, "--body-file"); if (!file) return blocked("thread arguments", "body file is required", "--body-file <f>"); return replyThread(pr, id, readFileSync(file, "utf8"), runner); }
  if (args[0] === "resolve") return resolveThread(pr, id, runner);
  return blocked("usage", "expected thread reply or resolve", "pr thread reply|resolve");
}
async function markerCommand(args: string[], runner: CommandRunner): Promise<unknown> {
  const pr = await snapshotTarget(args, runner); const head = option(args, "--head"); const verdict = option(args, "--verdict");
  if (!head || !verdict) return blocked("marker arguments", "--head and --verdict are required", "full head oid and verdict");
  return marker(pr, head, verdict, list(args, "--finding"), runner);
}
function mutationName(command: string, args: string[]): string | undefined {
  const names: Record<string, string> = { push: "push", merge: "merge", body: "edit-body", attach: "attach", rerequest: "rerequest", draft: "convert-draft" };
  if (command === "checks" && args[0] === "rerun-cancelled") return "rerun-check";
  return names[command];
}
async function mutationCommand(command: string, args: string[], runner: CommandRunner, clock: Clock): Promise<unknown> {
  const idRequired = ["guard", "draft", "push", "rerequest", "body", "attach", "merge", "cleanup"].includes(command) || (command === "checks" && args[0] === "rerun-cancelled");
  const runId = idRequired ? requireRun(option(args, "--run")) : undefined;
  const pr = await snapshotTarget(args, runner); const run = runId ? getRun(pr, runId) : undefined;
  const mutation = mutationName(command, args);
  if (mutation && run) assertAuthorized(run, pr.owner, mutation);
  return runMutation(command, args, pr, runId, runner, clock);
}
async function runMutation(command: string, args: string[], pr: Awaited<ReturnType<typeof snapshot>>, runId: string | undefined, runner: CommandRunner, clock: Clock): Promise<unknown> {
  const handlers: Record<string, () => Promise<unknown>> = {
    guard: async () => guard(pr, runner), draft: async () => draft(pr, runId!, runner),
    push: async () => push(pr, runId!, args.filter((value) => value !== positional(args) && value !== "--run" && value !== runId), runner),
    rerequest: async () => rerequest(pr, runner, boolean(args, "--dry-run")),
    body: async () => { const file = option(args, "--file"); if (!file) return blocked("body arguments", "--file is required", "PR body file"); const result = await updateBody(pr, file, boolean(args, "--preserve-evidence"), runner); updatePrStore(statePath(pr), identityOf(pr), (store) => { if (!store.describedHeads.includes(pr.headRefOid)) store.describedHeads.push(pr.headRefOid); }); return result; },
    attach: async () => attach(pr, runId!, args, runner), merge: async () => {
      const noRequiredChecks = boolean(args, "--no-required-checks"); const proof = option(args, "--policy-proof");
      if (noRequiredChecks && !proof?.trim()) return blocked("required checks", "--no-required-checks requires --policy-proof <text>", "an explicit trusted-policy reason");
      if (noRequiredChecks) changeRun(pr, runId!, (run) => { run.policyProof = proof!.trim(); });
      return merge(pr, runId!, boolean(args, "--force"), list(args, "--required"), runner, clock, noRequiredChecks, proof);
    },
    cleanup: async () => cleanupCommand(pr, runId!, runner),
    checks: async () => checksCommand(args, pr, runner, clock, runId),
  };
  return handlers[command]!();
}
async function cleanupCommand(pr: Awaited<ReturnType<typeof snapshot>>, runId: string, runner: CommandRunner): Promise<unknown> {
  if (pr.owner !== "own" || pr.fork) return blocked("post-merge cleanup", `owner=${pr.owner}, fork=${pr.fork}`, "an own, non-fork PR");
  const run = getRun(pr, runId);
  if (!["merge", "automerge", "lifecycle"].includes(run.action)) return blocked("post-merge cleanup", `action=${run.action}`, "a merge, automerge, or lifecycle run");
  const root = await targetRoot(runner);
  const branch = await invoke(runner, "git", ["branch", "--show-current"], { cwd: root });
  const head = await invoke(runner, "git", ["rev-parse", "HEAD"], { cwd: root });
  const status = await invoke(runner, "git", ["status", "--porcelain"], { cwd: root });
  if (status) return blocked("post-merge cleanup", `working tree is dirty: ${status}`, "a clean working tree before cleanup");
  if (pr.state.toUpperCase() !== "MERGED" || branch !== pr.headRefName || head !== pr.headRefOid) return blocked("post-merge cleanup", `state=${pr.state}, branch=${branch}, HEAD=${head}`, "merged PR and current branch HEAD matching the PR head");
  return cleanup(pr, runner);
}
async function runCommand(args: string[], runner: CommandRunner, clock: Clock): Promise<unknown> {
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
async function checksCommand(args: string[], pr: Awaited<ReturnType<typeof snapshot>>, runner: CommandRunner, clock: Clock, runId: string | undefined): Promise<unknown> {
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
async function stackPrs(repo: string, numbers: string[], runner: CommandRunner): Promise<Awaited<ReturnType<typeof snapshot>>[]> {
  const prs = [];
  for (const number of numbers) {
    const pr = await snapshot(`https://github.com/${repo}/pull/${number}`, runner);
    if (pr.owner !== "own" || pr.fork) return blocked("stack link", `PR #${number} owner=${pr.owner}, fork=${pr.fork}`, "own, non-fork PRs only");
    prs.push(pr);
  }
  return prs;
}
function authorizeStackRun(prs: Awaited<ReturnType<typeof snapshot>>[], runId: string): void {
  for (const pr of prs) {
    try { assertAuthorized(getRun(pr, runId), pr.owner, "stack-link"); return; }
    catch (error) { if (!(error instanceof Error) || !/run.*not found|unknown run/i.test(error.message)) throw error; }
  }
  blocked("stack link", `run ${runId} does not belong to a listed PR`, "a stack-link run on one listed PR");
}
async function stackLinkCommand(args: string[], runner: CommandRunner): Promise<unknown> {
  const runId = requireRun(option(args, "--run")); const repo = option(args, "--repo"); const numbers = args.filter((value) => /^\d+$/.test(value));
  if (!repo || !numbers.length) return blocked("stack link", "--repo and PR numbers are required", "explicit owner/repository and PR numbers");
  authorizeStackRun(await stackPrs(repo, numbers, runner), runId);
  return link(repo, numbers, runner);
}
async function stackCommand(args: string[], runner: CommandRunner): Promise<unknown> {
  const [operation, ...rest] = args;
  if (operation === "probe") return probe(runner, option(rest, "--repo"));
  if (operation === "link") return stackLinkCommand(rest, runner);
  if (operation === "collapse-check") return collapseCheck(rest.filter((value) => /^[a-f\d]{7,40}$/i.test(value)), runner);
  return blocked("usage", "unknown stack operation", "probe, link, or collapse-check");
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
