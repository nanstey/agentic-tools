import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";
import { PR_QUERY, parsePr } from "../../../../lib/pr/index.ts";
import type { PrSnapshot } from "../../../../lib/pr/types.ts";
import { invoke, parseJson, isRecord, blocked, type CommandRunner } from "./runner.ts";

export const scriptDirectory = dirname(fileURLToPath(import.meta.url));
export const repositoryRoot = resolve(scriptDirectory, "../../../..");
export interface Snapshot extends PrSnapshot {
  owner: "own" | "other" | "fork";
  fork: boolean;
  author: string;
  headRefName: string;
  headRefOid: string;
  baseRefName: string;
  baseRefOid: string;
  stack: unknown | null;
  body: string;
}
function targetParts(url: string): { repo: string; number: number } {
  const parsed = new URL(url);
  const parts = parsed.pathname.split("/").filter(Boolean);
  const number = Number(parts.at(-1));
  if (!parts[0] || !parts[1] || !Number.isSafeInteger(number)) return blocked("PR target", url, "a PR number, URL, or current branch with an open PR");
  return { repo: `${parts[0]}/${parts[1]}`, number };
}
type CursorPage = { nodes: unknown[]; pageInfo: { hasNextPage: boolean; endCursor: string | null } };
const EMPTY_PAGE: CursorPage = { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } };
export function pageAt(value: unknown, path: string[]): CursorPage {
  let current = value;
  for (const key of path) {
    // A fresh head has statusCheckRollup null until checks register: zero observed checks.
    if (current === null && key === "contexts") return EMPTY_PAGE;
    if (Array.isArray(current) && /^\d+$/.test(key)) current = current[Number(key)];
    else if (isRecord(current)) current = current[key];
    else return blocked("PR pagination", path.join("."), "complete page data");
  }
  if (!isRecord(current)) return invalidPage(path);
  return parsePage(current, path);
}
function invalidPage(path: string[]): never {
  return blocked("PR pagination", path.join("."), "pageInfo and nodes for every connection");
}
function parsePage(current: Record<string, unknown>, path: string[]): CursorPage {
  if (!Array.isArray(current.nodes) || !isRecord(current.pageInfo) || typeof current.pageInfo.hasNextPage !== "boolean") return invalidPage(path);
  const cursor = current.pageInfo.endCursor;
  if (current.pageInfo.hasNextPage && typeof cursor !== "string") return blocked("PR pagination", path.join("."), "an end cursor for every remaining page");
  return { nodes: current.nodes, pageInfo: { hasNextPage: current.pageInfo.hasNextPage, endCursor: typeof cursor === "string" ? cursor : null } };
}
const COLLECTIONS = { comments: ["comments"], reviews: ["reviews"], threads: ["reviewThreads"], checks: ["commits", "nodes", "0", "commit", "statusCheckRollup", "contexts"] };
async function fetchCompletePr(runner: CommandRunner, repo: string, number: number): Promise<string> {
  const [owner, name] = repo.split("/");
  const cursors: Record<string, string> = {};
  let merged: Record<string, unknown> | undefined;
  while (true) {
    const response = await fetchPrPage(runner, owner!, name!, number, cursors);
    const pr = pagePullRequest(response);
    if (!pr) return JSON.stringify(response);
    const firstPage = !merged;
    if (firstPage) merged = structuredClone(pr) as Record<string, unknown>;
    const more = mergePrPage(pr, merged!, cursors, firstPage);
    if (!more) return JSON.stringify({ data: { repository: { pullRequest: merged } } });
  }
}
async function fetchPrPage(runner: CommandRunner, owner: string, name: string, number: number, cursors: Record<string, string>): Promise<Record<string, unknown>> {
  const args = ["api", "graphql", "-f", `query=${PR_QUERY}`, "-F", `o=${owner}`, "-F", `r=${name}`, "-F", `n=${number}`];
  for (const [key, cursor] of Object.entries(cursors)) args.push("-F", `${key}=${cursor}`);
  const response = parseJson(await invoke(runner, "gh", args), isRecord, "GitHub GraphQL API");
  if (isRecord(response.errors) || Array.isArray(response.errors) && response.errors.length) return blocked("gh API", JSON.stringify(response.errors), "successful complete GraphQL pagination");
  return response;
}
function pagePullRequest(response: Record<string, unknown>): Record<string, unknown> | null {
  const data = response.data;
  const pr = isRecord(data) && isRecord(data.repository) ? data.repository.pullRequest : undefined;
  return isRecord(pr) ? pr : null;
}
function mergePrPage(pr: Record<string, unknown>, merged: Record<string, unknown>, cursors: Record<string, string>, firstPage: boolean): boolean {
  let more = false;
  for (const [key, path] of Object.entries(COLLECTIONS)) {
    const page = pageAt(pr, path);
    if (!firstPage) appendPage(merged, pr, path, page.nodes);
    if (page.pageInfo.hasNextPage) { cursors[`${key}Cursor`] = page.pageInfo.endCursor!; more = true; }
    else delete cursors[`${key}Cursor`];
  }
  return more;
}
function appendPage(target: Record<string, unknown>, source: Record<string, unknown>, path: string[], nodes: unknown[]): void {
  let destination: unknown = target;
  let original: unknown = source;
  for (const key of path.slice(0, -1)) { destination = (destination as Record<string, unknown>)[key]; original = (original as Record<string, unknown>)[key]; }
  const field = path.at(-1)!;
  const targetConnection = (destination as Record<string, unknown>)[field] as Record<string, unknown>;
  const sourceConnection = (original as Record<string, unknown>)[field] as Record<string, unknown>;
  targetConnection.nodes = [...(targetConnection.nodes as unknown[]), ...nodes];
  targetConnection.pageInfo = sourceConnection.pageInfo;
}
function isPolicySurface(path: string): boolean {
  return path.startsWith("skills/") || path.startsWith("agents/") || path.startsWith("harness/") || path.startsWith(".agents/") || /(^|\/)(AGENTS|CLAUDE|GEMINI)\.md$/i.test(path);
}
/** Policy identity is SHA-256 over sorted policy-surface paths and their blob OIDs at the PR head. */
export async function policyHash(head: string, runner: CommandRunner): Promise<string> {
  const output = await invoke(runner, "git", ["ls-tree", "-r", head], { cwd: repositoryRoot });
  const entries = output.split("\n").filter(Boolean).flatMap((line) => {
    const match = line.match(/^[0-7]{6} blob ([a-f\d]{40})\t(.+)$/);
    return match && isPolicySurface(match[2]!) ? [[match[2]!, match[1]!]] : [];
  }).sort(([a], [b]) => a!.localeCompare(b!));
  if (!entries.length) return createHash("sha256").update("").digest("hex");
  return createHash("sha256").update(entries.map(([path, oid]) => `${path}\0${oid}`).join("\n")).digest("hex");
}
async function initialPr(target: string | undefined, runner: CommandRunner): Promise<{ repo: string; number: number; login: string }> {
  const args = ["pr", "view", ...(target ? [target] : []), "--json", "number,url"];
  const initial = parseJson(await invoke(runner, "gh", args), isRecord, "gh pr view");
  if (typeof initial.url !== "string" || typeof initial.number !== "number") return blocked("PR resolution", "number or URL missing", "one accessible pull request");
  const identity = targetParts(initial.url);
  const login = await invoke(runner, "gh", ["api", "user", "--jq", ".login"]);
  if (!login) return blocked("GitHub identity", "viewer login missing", "authenticated GitHub user");
  return { ...identity, login };
}
async function stackMetadata(repo: string, number: number, runner: CommandRunner): Promise<unknown | null> {
  const raw = await runner("gh", ["api", `repos/${repo}/pulls/${number}`], process.env, repositoryRoot);
  if (!raw.ok) {
    if (/404|not found/i.test(raw.stderr)) return null;
    return blocked("stack snapshot", raw.stderr || "API request failed", "accessible PR metadata");
  }
  return parseJson(raw.stdout, isRecord, "GitHub PR REST API").stack ?? null;
}
function snapshotOwner(detail: Record<string, unknown>, login: string): "own" | "other" | "fork" {
  const author = isRecord(detail.author) && typeof detail.author.login === "string" ? detail.author.login : "";
  return detail.isCrossRepository === true ? "fork" : author === login ? "own" : "other";
}
export async function snapshot(target: string | undefined, runner: CommandRunner): Promise<Snapshot> {
  const identity = await initialPr(target, runner);
  const gql = await fetchCompletePr(runner, identity.repo, identity.number);
  const basic = parsePr(gql, identity.repo, identity.number, "reviewer", identity.login);
  if (!basic) return blocked("PR snapshot", "PR missing or has no commit", "an accessible PR with a commit");
  const detail = parseJson(await invoke(runner, "gh", ["pr", "view", String(identity.number), "--repo", identity.repo, "--json", "author,headRefName,headRefOid,baseRefName,baseRefOid,isCrossRepository,isDraft,state,url,title,body"]), isRecord, "gh pr view details");
  const author = isRecord(detail.author) && typeof detail.author.login === "string" ? detail.author.login : "";
  validateBranchIdentity(detail);
  const owner = snapshotOwner(detail, identity.login);
  const stack = await stackMetadata(identity.repo, identity.number, runner);
  return { ...basic, role: owner === "own" ? "author" : "reviewer", owner, fork: owner === "fork", author, headRefName: detail.headRefName as string, headRefOid: detail.headRefOid as string, baseRefName: detail.baseRefName as string, baseRefOid: detail.baseRefOid as string, stack, body: typeof detail.body === "string" ? detail.body : "" };
}
function validateBranchIdentity(detail: Record<string, unknown>): void {
  for (const field of ["headRefName", "headRefOid", "baseRefName", "baseRefOid"] as const) if (typeof detail[field] !== "string") blocked("PR snapshot", `${field} missing`, "complete branch and object identity");
}
