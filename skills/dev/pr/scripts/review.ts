import { createHash } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { invoke, isRecord, blocked, type CommandRunner } from "./runner.ts";
import { refresh, policyHash, type Snapshot } from "./resolve.ts";
export function disclosure(kind: "review" | "comment" | "fold", user: string): { header: string } {
  if (kind === "fold") return { header: `> [!NOTE]\n> 🤖 Folded by ${user}'s Agent` };
  return { header: `> [!NOTE]\n> 🤖 Written by ${user}'s Agent` };
}
export async function marker(pr: Snapshot, head: string, verdict: string, findings: string[], runner: CommandRunner): Promise<unknown> {
  validateMarkerInput(head, verdict);
  const event = verdict.toUpperCase(); const stable = [...findings].sort(); const value = markerValue(head, event, stable);
  return checkMarkerHistory(pr, head, event, stable, value, runner);
}
function validateMarkerInput(head: string, verdict: string): void {
  if (!/^[a-f\d]{40}$/i.test(head)) blocked("review marker", "head is not a full object id", "full 40-character head oid");
  if (!["APPROVE", "REQUEST_CHANGES", "COMMENT"].includes(verdict.toUpperCase())) blocked("review marker", `unsupported verdict ${verdict}`, "APPROVE, REQUEST_CHANGES, or COMMENT");
}
function markerValue(head: string, event: string, findings: string[]): string {
  const data = { event, findings, head }; const digest = createHash("sha256").update(JSON.stringify(data)).digest("hex");
  return `<!-- pr-review: v2 head=${head} event=${event} findings=${findings.join(",")} sha256=${digest} -->`;
}
async function checkMarkerHistory(pr: Snapshot, head: string, event: string, findings: string[], value: string, runner: CommandRunner): Promise<unknown> {
  const reviews = await reviewHistory(pr, runner); const viewer = (await invoke(runner, "gh", ["api", "user", "--jq", ".login"])).trim();
  if (!viewer) return blocked("GitHub identity", "viewer login missing", "authenticated GitHub user");
  const mine = reviews.filter((review) => isRecord(review) && isRecord(review.user) && review.user.login === viewer && typeof review.body === "string");
  const existing = mine.find((review) => isRecord(review) && review.body === value);
  const prior = latestReview(mine);
  const dedup = prior ? deduplicateMarker(prior, head, event, findings, value, pr.threads.length === 0) : null;
  if (dedup) return dedup;
  return { marker: value, duplicate: Boolean(existing), ...(existing ? { existing } : {}) };
}
function latestReview(reviews: unknown[]): Record<string, unknown> | null {
  return reviews.filter((review): review is Record<string, unknown> => isRecord(review) && typeof review.submitted_at === "string" && review.state !== "DISMISSED").sort((a, b) => String(b.submitted_at).localeCompare(String(a.submitted_at)))[0] ?? null;
}
function deduplicateMarker(prior: Record<string, unknown>, head: string, event: string, findings: string[], value: string, noThreads: boolean): unknown | null {
  if (typeof prior.body !== "string") return null;
  const parsed = parseMarker(prior.body); if (!parsed || parsed.event !== event) return null;
  if (parsed.head === head && parsed.findings.join("\0") === findings.join("\0")) return { marker: value, duplicate: true, existing: prior };
  return noThreads && parsed.head !== head && findings.every((id) => parsed.findings.includes(id)) ? { skip: `skipped: no new findings since ${parsed.head.slice(0, 7)}` } : null;
}
async function reviewHistory(pr: Snapshot, runner: CommandRunner): Promise<unknown[]> {
  const raw: unknown = JSON.parse(await invoke(runner, "gh", ["api", "--paginate", "--slurp", `repos/${pr.repo}/pulls/${pr.number}/reviews?per_page=100`]));
  if (!Array.isArray(raw)) return blocked("review pagination", "reviews response malformed", "complete paginated reviews");
  return raw.flatMap((page) => Array.isArray(page) ? page : []);
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return canonicalArray(value);
  if (isRecord(value)) return canonicalObject(value);
  return JSON.stringify(value) ?? "null";
}
function canonicalArray(values: unknown[]): string { return `[${values.map(canonical).join(",")}]`; }
function canonicalObject(value: Record<string, unknown>): string {
  const entries = Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`);
  return `{${entries.join(",")}}`;
}
function parseMarker(body: string): { head: string; event: string; findings: string[] } | null {
  const legacy = /<!-- pr-review: v1=([A-Za-z0-9_-]+); sha256=([a-f0-9]{64}) -->/.exec(body);
  if (legacy) return parseLegacyMarker(legacy[1]!, legacy[2]!);
  return parseV2Marker(body);
}
function parseLegacyMarker(encoded: string, digest: string): { head: string; event: string; findings: string[] } | null {
  try {
    const bytes = Buffer.from(encoded, "base64url"); const text = bytes.toString("utf8"); const payload: unknown = JSON.parse(text);
    if (Buffer.from(text).toString("base64url") !== encoded || canonical(payload) !== text || createHash("sha256").update(bytes).digest("hex") !== digest) return null;
    return validLegacyPayload(payload) ? { head: payload.head, event: payload.event.toUpperCase(), findings: payload.findings } : null;
  } catch { return null; }
}
function validLegacyPayload(value: unknown): value is { head: string; event: string; findings: string[] } {
  if (!isRecord(value) || typeof value.head !== "string" || !/^[a-f0-9]{40}$/i.test(value.head) || typeof value.event !== "string" || !Array.isArray(value.findings) || !value.findings.every((id) => typeof id === "string")) return false;
  return [...value.findings].sort().join("\0") === value.findings.join("\0");
}
function parseV2Marker(body: string): { head: string; event: string; findings: string[] } | null {
  const match = /<!-- pr-review: v2 head=([a-f0-9]{40}) event=(APPROVE|REQUEST_CHANGES|COMMENT) findings=([A-Za-z0-9_.,-]*) sha256=([a-f0-9]{64}) -->/.exec(body);
  if (!match) return null;
  const ids = match[3] ? match[3].split(",") : []; const data = { event: match[2], findings: ids, head: match[1] };
  return [...ids].sort().join(",") === match[3] && createHash("sha256").update(JSON.stringify(data)).digest("hex") === match[4] ? { head: match[1]!, event: match[2]!, findings: ids } : null;
}
export async function react(pr: Snapshot, operation: string, runner: CommandRunner): Promise<unknown> {
  if (operation !== "add" && operation !== "remove") return blocked("reaction arguments", operation, "add or remove");
  const user = (await invoke(runner, "gh", ["api", "user", "--jq", ".login"])).trim();
  if (!user) return blocked("GitHub identity", "viewer login missing", "authenticated GitHub user");
  const endpoint = `repos/${pr.repo}/issues/${pr.number}/reactions`;
  if (operation === "add") return { reaction: await invoke(runner, "gh", ["api", "-X", "POST", endpoint, "-f", "content=eyes"], { write: "review-reaction" }) };
  const raw = JSON.parse(await invoke(runner, "gh", ["api", "--paginate", "--slurp", `${endpoint}?content=eyes&per_page=100`])) as unknown;
  if (!Array.isArray(raw)) return blocked("reaction pagination", "reaction response malformed", "complete paginated reactions");
  const reactions = raw.flatMap((p) => Array.isArray(p) ? p : []).filter((r) => isRecord(r) && r.content === "eyes" && isRecord(r.user) && r.user.login === user);
  for (const item of reactions) { if (!isRecord(item) || !Number.isSafeInteger(item.id)) return blocked("reaction response", "reaction id malformed", "valid viewer reaction ids"); await invoke(runner, "gh", ["api", "-X", "DELETE", `${endpoint}/${item.id}`], { write: "review-reaction" }); }
  return { removed: reactions.length };
}
export async function postReview(pr: Snapshot, event: string, body: string, comments: unknown[], runner: CommandRunner): Promise<unknown> {
  if (!["APPROVE", "REQUEST_CHANGES", "COMMENT"].includes(event)) return blocked("review event", event, "APPROVE, REQUEST_CHANGES, or COMMENT");
  const initialPolicy = await policyHash(pr.headRefOid, runner);
  await assertReviewSnapshot(pr, initialPolicy, runner);
  const response = await postWithRetry(pr, event, body, comments, initialPolicy, runner);
  const after = await refresh(pr, runner);
  const stale = await snapshotChanged(pr, after, initialPolicy, runner);
  return { review: JSON.parse(response), stale, commit_id: pr.headRefOid };
}
async function snapshotChanged(pr: Snapshot, actual: Snapshot, policy: string, runner: CommandRunner): Promise<boolean> {
  return actual.headRefOid !== pr.headRefOid || actual.baseRefOid !== pr.baseRefOid || await policyHash(actual.headRefOid, runner) !== policy;
}
async function assertReviewSnapshot(pr: Snapshot, policy: string, runner: CommandRunner): Promise<void> {
  const actual = await refresh(pr, runner);
  if (await snapshotChanged(pr, actual, policy, runner)) blocked("review snapshot changed", "base, head, or policy changed before POST", "unchanged authoritative snapshot and policy");
}
async function postWithRetry(pr: Snapshot, event: string, body: string, comments: unknown[], policy: string, runner: CommandRunner): Promise<string> {
  try { return await postReviewRequest(pr, event, body, comments, runner); }
  catch (error) {
    if (!comments.length || !/position|line|diff/i.test(String(error))) throw error;
    await assertReviewSnapshot(pr, policy, runner);
    const fallback = `${body}\n\n${comments.map(commentBody).filter(Boolean).join("\n\n")}`;
    return postReviewRequest(pr, event, fallback, [], runner);
  }
}
function commentBody(value: unknown): string { return isRecord(value) && typeof value.body === "string" ? value.body : ""; }
async function postReviewRequest(pr: Snapshot, event: string, body: string, comments: unknown[], runner: CommandRunner): Promise<string> {
  const dir = mkdtempSync(join(tmpdir(), "pr-review-post-")); const input = join(dir, "review.json");
  writeFileSync(input, JSON.stringify({ commit_id: pr.headRefOid, event, body, comments }), { mode: 0o600 });
  try { return await invoke(runner, "gh", ["api", "-X", "POST", `repos/${pr.repo}/pulls/${pr.number}/reviews`, "--input", input], { write: "review-post" }); }
  finally { rmSync(dir, { recursive: true, force: true }); }
}
export async function disclosureHeader(kind: string, runner: CommandRunner): Promise<{ header: string }> {
  const user = await invoke(runner, "gh", ["api", "user", "--jq", ".login"]);
  if (!user) return blocked("GitHub identity", "viewer login missing", "authenticated GitHub user");
  if (kind !== "review" && kind !== "comment" && kind !== "fold") return blocked("disclosure kind", kind, "review, comment, or fold");
  return disclosure(kind, user);
}
