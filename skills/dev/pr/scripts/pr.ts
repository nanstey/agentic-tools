import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { readPrStore, putPrPacket, findPrPacket, updatePrStore } from "../../../../lib/pr/store.ts";
import { realpathSync } from "node:fs";
import { authorize, AUTHORIZATION_TABLE, renderAuthorizationTable, type Action, type Mode, type PrOwner } from "./authorize.ts";
import { nextPhase, type LifecycleFacts } from "./lifecycle.ts";
import { snapshot, policyHash, repositoryRoot } from "./resolve.ts";
import { summarizeChecks } from "../../../../lib/pr/facts.ts";
import { systemClock, systemRunner, requireRun, blocked, type Clock, type CommandRunner } from "./runner.ts";
import { changeRun, getRun, identityOf, startRun, statePath } from "./run.ts";
import { guard, draft, push } from "./guard.ts";
import { inventory, parseTimeout, rerunCancelled, waitChecks } from "./checks.ts";
import { attach, updateBody } from "./body.ts";
import { threads, rerequest } from "./threads.ts";
import { cleanup, merge } from "./merge.ts";
import { disclosureHeader, marker, postReview, react } from "./review.ts";
import { replyThread, resolveThread } from "./threads.ts";
import { readFileSync } from "node:fs";
import { docsOnly } from "./docs-only.ts";
import { collapseCheck, link, probe } from "./stack.ts";

export { AUTHORIZATION_TABLE, renderAuthorizationTable, nextPhase };
export type { CommandRunner, Clock };
function option(args: string[], name: string): string | undefined { const index = args.indexOf(name); return index < 0 ? undefined : args[index + 1]; }
function skipPositionalOption(args: string[], index: number): number {
  const flag = args[index]!;
  if (["--force", "--dry-run", "--preserve-evidence"].includes(flag)) return index;
  if (flag === "--required") { while (args[index + 1] && !args[index + 1]!.startsWith("--")) index++; return index; }
  return index + 1;
}
function positional(args: string[]): string | undefined {
  const values: string[] = [];
  for (let index = 0; index < args.length; index++) {
    const value = args[index]!;
    if (value.startsWith("--")) { index = skipPositionalOption(args, index); continue; }
    if (!["force", "inventory", "rerun-cancelled", "wait"].includes(value)) values.push(value);
  }
  return values[0];
}
function boolean(args: string[], name: string): boolean { return args.includes(name); }
export function list(args: string[], name: string): string[] {
  const values: string[] = [];
  for (let i = 0; i < args.length; i++) if (args[i] === name && args[i + 1]) {
    if (name === "--required") { while (args[i + 1] && !args[i + 1]!.startsWith("--") && args[i + 1] !== "force") values.push(args[++i]!); }
    else values.push(args[++i]!);
  }
  return values;
}
function modeValue(value: string | undefined): Mode { return value === "fix" || value === "comment" || value === "report" || value === "force" ? value : "none"; }
function actionValue(value: string | undefined): Action { if (value && value in AUTHORIZATION_TABLE) return value as Action; return blocked("authorization action", value ?? "missing action", "a declared /pr action"); }
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
  if (!authorize(actionValue(run.action), mode, owner).includes(mutation)) blocked("authorization", `${mutation} is not allowed for ${run.action}/${mode}/${owner}`, "an authorized action, mode, and PR owner");
}
async function localCommitFacts(runner: CommandRunner): Promise<{ unpushed: boolean; dirty: boolean }> {
  const git = async (args: string[]) => runner("git", args, process.env, repositoryRoot);
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
  const local = await localCommitFacts(runner);
  const checks = summarizeChecks(pr.checks);
  const store = readPrStore(statePath(pr), identityOf(pr));
  const policy = await policyHash(pr.headRefOid, runner);
  const packet = findPrPacket(store, pr.baseRefOid, pr.headRefOid, policy);
  const described = store.describedHeads.includes(pr.headRefOid);
  const reviewerState = await rerequest(pr, runner, true) as { requested?: string[] };
  return { resolved: true, exists: pr.state.toUpperCase() !== "NOT_FOUND", unpushed: local.unpushed, dirtyValidated: local.dirty,
    ...descriptionFacts(pr, judged, described), uiChangedNoScreenshots: judged.has("ui-evidence") ? !judged.get("ui-evidence") : undefined,
    behind: pr.mergeStateStatus === "BEHIND", conflicting: ["DIRTY", "CONFLICTING"].includes(pr.mergeStateStatus),
    stackOutOfOrder: pr.stack !== null && pr.mergeStateStatus === "BEHIND", checksObserved: checks.total > 0,
    requiredCheckFailedOrMissing: judged.has("required-check-policy") ? (checks.failed.length > 0 && !judged.get("required-check-policy")) : checks.failed.length ? true : null,
    packetComplete: packet?.verdict === "clean", docsOnlyClean: Object.entries(store.docsOnlyResults).some(([key, clean]) => key.endsWith(`..${pr.headRefOid}`) && clean),
    unresolvedThreads: pr.threads.filter((thread) => !thread.isResolved).length,
    addressedReviewers: Boolean(reviewerState.requested?.length), isDraft: pr.isDraft, requiredCheckPolicyKnown: judged.has("required-check-policy") };
}
export async function execute(args: string[], runner: CommandRunner = systemRunner, clock: Clock = systemClock): Promise<unknown> {
  const [command, ...rest] = args;
  if (!command) return blocked("usage", "missing subcommand", "pr <subcommand>");
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
async function snapshotCommand(args: string[], runner: CommandRunner): Promise<unknown> { return { snapshot: await snapshotTarget(args, runner) }; }
async function nextCommand(args: string[], runner: CommandRunner): Promise<unknown> {
  const id = requireRun(option(args, "--run")); const pr = await snapshotTarget(args, runner); const run = readPrStore(statePath(pr), identityOf(pr)).runs[id];
  return nextPhase(await lifecycleFacts(pr, args, runner), { phase0Complete: true, owner: pr.owner, automerge: run?.action === "automerge", reviewReportComplete: run?.completion === "review_report_complete" });
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
  const runId = option(args, "--run");
  if (runId) {
    const target = option(args, "--pr"); if (!target) return blocked("docs-only arguments", "--pr is required when recording a run result", "pr docs-only <base> <head> --run <id> --pr <pr>");
    const pr = await snapshot(target, runner); getRun(pr, runId);
    const key = `${base}..${head}`; updatePrStore(statePath(pr), identityOf(pr), (store) => { store.docsOnlyResults[key] = result.clean; });
  }
  return result;
}
async function packetCommand(args: string[], runner: CommandRunner): Promise<unknown> {
  const pr = await snapshot(args[1], runner); const identity = identityOf(pr); const path = statePath(pr);
  if (args[0] === "get") {
    const base = option(args, "--base"); const head = option(args, "--head"); const policy = option(args, "--policy");
    if (!base || !head || !policy) return blocked("packet arguments", "base, head, and policy are required", "pr packet get <pr> --base <oid> --head <oid> --policy <hash>");
    return { packet: findPrPacket(readPrStore(path, identity), base, head, policy) };
  }
  if (args[0] !== "put") return blocked("usage", "expected packet put or get", "pr packet put|get");
  const required = ["--run", "--base", "--head", "--policy", "--depth", "--reason", "--verdict"];
  if (required.some((key) => !option(args, key))) return blocked("packet arguments", "required packet field missing", "run, base, head, policy, depth, reason, verdict");
  const run = getRun(pr, option(args, "--run")!); if (run.round > run.limit) return blocked("round limit", `round ${run.round} exceeds limit ${run.limit}`, "a valid active run");
  const verdict = option(args, "--verdict")!;
  if (!["clean", "changes_required", "incomplete"].includes(verdict)) return blocked("packet verdict", verdict, "clean, changes_required, or incomplete");
  const parseRows = (values: string[], sep: string, field: string) => values.map((value) => { const at = value.indexOf(sep); if (at < 1 || at === value.length - 1) return blocked("packet arguments", value, `valid ${field} entries`); return [value.slice(0, at), value.slice(at + 1)]; });
  const findings = parseRows(list(args, "--finding"), ":", "finding").map(([id, category]) => ({ id: id!, category: category! }));
  const coverage = parseRows(list(args, "--coverage"), "=", "coverage").map(([path, status]) => ({ path: path!, status: status! }));
  const packet = { base: option(args, "--base")!, head: option(args, "--head")!, policy: option(args, "--policy")!, depth: option(args, "--depth")!, reason: option(args, "--reason")!, verdict, findings, coverage, storedAt: new Date().toISOString() };
  putPrPacket(path, identity, packet); return { packet };
}
async function reactCommand(args: string[], runner: CommandRunner): Promise<unknown> {
  const pr = await snapshotTarget(args, runner); const run = getRun(pr, requireRun(option(args, "--run"))); assertAuthorized(run, pr.owner, "react");
  return react(pr, args.at(-1)!, runner);
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
  const pr = await snapshot(args[1], runner); const run = getRun(pr, requireRun(option(args, "--run"))); assertAuthorized(run, pr.owner, args[0] === "reply" ? "post-comment" : "resolve-threads");
  const id = option(args, "--thread"); if (!id) return blocked("thread arguments", "thread id is required", "--thread <id>");
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
  if (getRun(pr, runId).completion !== "merged") return blocked("post-merge cleanup", "run has no confirmed merged completion", "successful merge recorded for this PR run");
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
    return { run: changeRun(pr, id, (run) => { run.completion = completion; }) };
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
async function stackCommand(args: string[], runner: CommandRunner): Promise<unknown> {
  const [operation, ...rest] = args;
  if (operation === "probe") return probe(runner, option(rest, "--repo"));
  if (operation === "link") {
    requireRun(option(rest, "--run")); const repo = option(rest, "--repo"); const numbers = rest.filter((value) => /^\d+$/.test(value));
    if (!repo) return blocked("stack link", "--repo is required", "explicit owner/repository"); return link(repo, numbers, runner);
  }
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
