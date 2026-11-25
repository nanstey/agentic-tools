import { invoke, parseJson, isRecord, blocked, type CommandRunner } from "./runner.ts";
import { snapshot, type Snapshot } from "./resolve.ts";
interface ThreadComment { login: string; type: string; at: string }
interface ReviewThread { resolved: boolean; comments: ThreadComment[] }
interface ThreadPage { unresolved: string[]; outdated: string[]; threads: ReviewThread[]; total: number; cursor: string | null }
interface ThreadNode { id: string; resolved: boolean; outdated: boolean; comments: ThreadComment[] }
function parseThreadNode(value: unknown): ThreadNode {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.isResolved !== "boolean" || typeof value.isOutdated !== "boolean") return blocked("thread snapshot", "thread node malformed", "complete thread ids and state");
  if (!isRecord(value.comments) || !Array.isArray(value.comments.nodes) || !isRecord(value.comments.pageInfo) || value.comments.pageInfo.hasNextPage === true) return blocked("thread snapshot", `thread ${value.id} comments are incomplete`, "complete paginated thread comments");
  return { id: value.id, resolved: value.isResolved, outdated: value.isOutdated, comments: value.comments.nodes.map(parseThreadComment) };
}
function parseThreadNodes(nodes: unknown[]): { unresolved: string[]; outdated: string[]; threads: ReviewThread[] } {
  const parsed = nodes.map(parseThreadNode);
  return { unresolved: parsed.filter((thread) => !thread.resolved).map((thread) => thread.id), outdated: parsed.filter((thread) => thread.outdated).map((thread) => thread.id), threads: parsed.map(({ resolved, comments }) => ({ resolved, comments })) };
}
function parseThreadComment(value: unknown): ThreadComment {
  if (!isRecord(value) || typeof value.createdAt !== "string") return blocked("thread snapshot", "thread comment malformed", "complete comment timestamp data");
  if (value.author === null) return { login: "ghost", type: "Ghost", at: value.createdAt };
  if (!isRecord(value.author) || typeof value.author.login !== "string" || typeof value.author.__typename !== "string") return blocked("thread snapshot", "thread comment author malformed", "complete comment author data");
  return { login: value.author.login, type: value.author.__typename, at: value.createdAt };
}
function threadConnection(value: unknown): { nodes: unknown[]; pageInfo: Record<string, unknown> } {
  if (!isRecord(value) || (Array.isArray(value.errors) && value.errors.length) || !isRecord(value.data) || !isRecord(value.data.repository) || !isRecord(value.data.repository.pullRequest)) return blocked("thread snapshot", "GraphQL response omitted review threads or reported errors", "complete paginated thread data");
  const connection = value.data.repository.pullRequest.reviewThreads;
  if (!isRecord(connection) || !Array.isArray(connection.nodes) || !isRecord(connection.pageInfo)) return blocked("thread snapshot", "thread connection malformed", "complete paginated thread data");
  return { nodes: connection.nodes, pageInfo: connection.pageInfo };
}
function parseThreadPage(value: unknown): ThreadPage {
  const connection = threadConnection(value);
  const parsed = parseThreadNodes(connection.nodes);
  const cursor = connection.pageInfo.hasNextPage === true && typeof connection.pageInfo.endCursor === "string" ? connection.pageInfo.endCursor : null;
  if (connection.pageInfo.hasNextPage === true && !cursor) return blocked("thread pagination", "next page cursor missing", "complete paginated thread data");
  return { ...parsed, total: connection.nodes.length, cursor };
}
export async function replyThread(pr: Snapshot, thread: string, body: string, runner: CommandRunner): Promise<unknown> {
  if (!body.trim()) return blocked("thread reply", "reply body is empty", "non-empty disclosed reply text");
  const query = "mutation($id:ID!,$body:String!){addPullRequestReviewThreadReply(input:{pullRequestReviewThreadId:$id,body:$body}){comment{id body}}}";
  const result = await invoke(runner, "gh", ["api", "graphql", "-f", `query=${query}`, "-F", `id=${thread}`, "-f", `body=${body}`], { write: "thread-reply" });
  return parseJson(result, isRecord, "thread reply");
}
export async function resolveThread(pr: Snapshot, thread: string, runner: CommandRunner): Promise<unknown> {
  const query = "mutation($id:ID!){resolveReviewThread(input:{threadId:$id}){thread{id isResolved}}}";
  const result = await invoke(runner, "gh", ["api", "graphql", "-f", `query=${query}`, "-F", `id=${thread}`], { write: "thread-resolve" });
  return parseJson(result, isRecord, "thread resolution");
}
export async function threads(pr: Snapshot, runner: CommandRunner): Promise<{ unresolved: string[]; outdated: string[]; threads: ReviewThread[]; total: number }> {
  const [owner, repo] = pr.repo.split("/"); let cursor: string | null = null; let total = 0; const unresolved: string[] = []; const outdated: string[] = []; const allThreads: ReviewThread[] = [];
  do {
    const args = ["api", "graphql", "-f", "query=query($o:String!,$r:String!,$n:Int!,$c:String){repository(owner:$o,name:$r){pullRequest(number:$n){reviewThreads(first:100,after:$c){nodes{id isResolved isOutdated comments(first:100){nodes{createdAt author{login __typename}} pageInfo{hasNextPage}}} pageInfo{hasNextPage endCursor}}}}}", "-F", `o=${owner}`, "-F", `r=${repo}`, "-F", `n=${pr.number}`];
    if (cursor) args.push("-F", `c=${cursor}`);
    const raw = await invoke(runner, "gh", args); const page = parseThreadPage(parseJson(raw, isRecord, "thread GraphQL query"));
    unresolved.push(...page.unresolved); outdated.push(...page.outdated); allThreads.push(...page.threads); total += page.total; cursor = page.cursor;
  } while (cursor);
  return { unresolved, outdated, threads: allThreads, total };
}
interface ReviewRecord { user: { login: string; type?: string } | null; state: string; submitted_at: string | null; commit_id: string | null }
function validReview(value: unknown): value is ReviewRecord {
  return isRecord(value) && (value.user === null || isRecord(value.user) && typeof value.user.login === "string") && typeof value.state === "string" && (value.submitted_at === null || typeof value.submitted_at === "string") && (value.commit_id === null || typeof value.commit_id === "string");
}
function reviewerThreadsAddressed(threadList: ReviewThread[], reviewer: string, author: string): boolean {
  return threadList.filter((thread) => thread.comments[0]?.login === reviewer && thread.comments[0]?.type === "User").every((thread) => thread.resolved || authorRepliedAfterLastComment(thread.comments, reviewer, author));
}
function authorRepliedAfterLastComment(comments: ThreadComment[], reviewer: string, author: string): boolean {
  const lastReviewerComment = comments.filter((comment) => comment.login === reviewer).map((comment) => comment.at).sort().at(-1);
  return Boolean(lastReviewerComment && comments.some((comment) => comment.login === author && comment.at > lastReviewerComment));
}
function reviewerAllowed(pr: Snapshot, login: string, review: ReviewRecord, requested: Set<string>, threadList: ReviewThread[]): boolean {
  return !requested.has(login) && ["CHANGES_REQUESTED", "COMMENTED"].includes(review.state) && (Boolean(review.commit_id && review.commit_id !== pr.headRefOid) || reviewerThreadsAddressed(threadList, login, pr.author));
}
function latestUserReviews(pr: Snapshot, reviews: ReviewRecord[]): Map<string, ReviewRecord> {
  const latest = new Map<string, ReviewRecord>();
  for (const review of reviews) {
    const login = review.user?.login;
    if (!login || login === pr.author || review.user?.type !== "User" || /\[bot\]$/i.test(login) || !review.submitted_at) continue;
    const prior = latest.get(login);
    if (!prior || (prior.submitted_at ?? "") < review.submitted_at) latest.set(login, review);
  }
  return latest;
}
export function eligibleRerequests(pr: Snapshot, reviews: ReviewRecord[], requested: Set<string>, threadList: ReviewThread[]): string[] {
  return [...latestUserReviews(pr, reviews)].filter(([login, review]) => reviewerAllowed(pr, login, review, requested, threadList)).map(([login]) => login);
}
function readReviewerLogins(value: unknown): Set<string> {
  const requested = parseJson(value as string, isRecord, "requested reviewers");
  if (!Array.isArray(requested.users) || !requested.users.every((user) => isRecord(user) && typeof user.login === "string")) return blocked("reviewer snapshot", "requested reviewers response malformed", "complete reviewer request state");
  return new Set(requested.users.map((user) => (user as { login: string }).login));
}
async function loadEligibility(pr: Snapshot, runner: CommandRunner): Promise<{ pending: string[]; skipped: Record<string, string> }> {
  const raw = await invoke(runner, "gh", ["api", "--paginate", "--slurp", `repos/${pr.repo}/pulls/${pr.number}/reviews?per_page=100`]);
  const pages = parseJson(raw, (value): value is unknown[] => Array.isArray(value), "review history");
  const reviews = pages.flatMap((page) => Array.isArray(page) ? page : []);
  if (!reviews.every(validReview)) return blocked("review pagination", "review page has malformed entries", "complete review history");
  const requested = readReviewerLogins(await invoke(runner, "gh", ["api", `repos/${pr.repo}/pulls/${pr.number}/requested_reviewers`]));
  const state = await threads(pr, runner);
  const pending = eligibleRerequests(pr, reviews as ReviewRecord[], requested, state.threads);
  const candidates = [...new Set((reviews as ReviewRecord[]).flatMap((review) => review.user?.login ? [review.user.login] : []))];
  const skipped = Object.fromEntries(candidates.filter((login) => !pending.includes(login)).map((login) => [login, requested.has(login) ? "already requested" : "not eligible or unresolved feedback remains"]));
  return { pending, skipped };
}
async function requestReviewers(pr: Snapshot, pending: string[], runner: CommandRunner): Promise<void> {
  const current = await snapshot(pr.url, runner);
  if (current.headRefOid !== pr.headRefOid || current.baseRefOid !== pr.baseRefOid) return blocked("review snapshot changed", "base or head changed", "unchanged authoritative base and head");
  for (const login of pending) {
    await invoke(runner, "gh", ["api", "-X", "POST", `repos/${pr.repo}/pulls/${pr.number}/requested_reviewers/rerequest`, "-f", `reviewers[]=${login}`], { write: "rerequest" });
    const verify = readReviewerLogins(await invoke(runner, "gh", ["api", `repos/${pr.repo}/pulls/${pr.number}/requested_reviewers`]));
    if (!verify.has(login)) return blocked("reviewer re-request", `${login} is absent after the API call`, "GitHub confirming the review request");
  }
}
export async function rerequest(pr: Snapshot, runner: CommandRunner, dryRun: boolean): Promise<unknown> {
  const { pending, skipped } = await loadEligibility(pr, runner);
  if (dryRun || !pending.length) return { requested: pending, skipped };
  await requestReviewers(pr, pending, runner);
  return { requested: pending, skipped: {} };
}
