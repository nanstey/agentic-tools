import type { Actor, Check, PrSnapshot, Review, Role } from "../core/types.ts";

/**
 * Per-PR GraphQL query. A superset of the legacy precheck query, so the same
 * response feeds both the legacy script and prflow in parity tests.
 */
export const PR_QUERY = `query($o:String!,$r:String!,$n:Int!){repository(owner:$o,name:$r){pullRequest(number:$n){
title url state isDraft headRefOid headRefName mergeStateStatus reviewDecision mergeable
commits(last:1){nodes{commit{committedDate statusCheckRollup{contexts(first:100){nodes{__typename
 ... on CheckRun{name status conclusion detailsUrl isRequired(pullRequestNumber:$n)}
 ... on StatusContext{context state targetUrl isRequired(pullRequestNumber:$n)}}}}}}}
comments(last:50){nodes{createdAt author{login __typename}}}
reviews(last:50){nodes{submittedAt state body commit{oid} author{login __typename}}}
reviewThreads(first:100){nodes{isResolved comments(last:50){nodes{createdAt author{login __typename}}}}}
reviewRequests(first:50){nodes{requestedReviewer{__typename ... on User{login} ... on Team{slug}}}}}}}`;

/** Commands prflow may run. Anything else, or any write, throws. */
export function assertReadOnly(args: readonly string[]): void {
  const [a, b] = args;
  const ok =
    (a === "search" && b === "prs") ||
    (a === "pr" && (b === "list" || b === "view")) ||
    (a === "auth" && b === "token") ||
    a === "api";
  if (!ok) throw new Error(`prflow: gh ${a ?? ""} ${b ?? ""} is not an allowed read call`);
  if (a === "api") {
    if (b !== "graphql") throw new Error("prflow: only gh api graphql is allowed");
    // Only `-f`/`-F` field pairs; no --input, --method, or other body sources.
    const rest = args.slice(2);
    for (let i = 0; i < rest.length; i += 2) {
      const flag = rest[i];
      const value = rest[i + 1];
      if ((flag !== "-f" && flag !== "-F") || value === undefined)
        throw new Error(`prflow: gh api graphql argument ${flag ?? ""} is not allowed`);
      if (value.startsWith("query=") && !/^query=\s*query\b/.test(value))
        throw new Error("prflow: only GraphQL queries are allowed");
      if (/\bmutation\b/.test(value)) throw new Error("prflow: GraphQL mutations are not allowed");
      if (flag === "-F" && value.slice(value.indexOf("=") + 1).startsWith("@"))
        throw new Error("prflow: file-valued fields are not allowed");
    }
  }
}

export interface SearchHit {
  repo: string;
  number: number;
}

/** `gh search prs ... --json number,repository` output. */
export function parseSearch(json: string): SearchHit[] {
  const rows = JSON.parse(json) as { number: number; repository: { nameWithOwner: string } }[];
  return rows.map((r) => ({ repo: r.repository.nameWithOwner, number: r.number }));
}

type RawActor = { login: string; __typename: string } | null;
type RawContext =
  | { __typename: "CheckRun"; name: string; status: string; conclusion: string | null; detailsUrl: string | null; isRequired?: boolean }
  | { __typename: "StatusContext"; context: string; state: string; targetUrl: string | null; isRequired?: boolean };

interface RawPr {
  title: string;
  url: string;
  state: string;
  isDraft: boolean;
  headRefOid: string;
  mergeStateStatus: string;
  reviewDecision: string | null;
  commits: { nodes: { commit: { committedDate: string; statusCheckRollup: { contexts: { nodes: RawContext[] } } | null } }[] };
  comments: { nodes: { createdAt: string; author: RawActor }[] };
  reviews: { nodes: { submittedAt: string | null; state: string; body: string | null; commit: { oid: string } | null; author: RawActor }[] };
  reviewThreads: { nodes: { isResolved: boolean; comments: { nodes: { createdAt: string; author: RawActor }[] } }[] };
  reviewRequests?: { nodes: { requestedReviewer: { __typename: string; login?: string; slug?: string } | null }[] };
}

const actor = (a: RawActor): Actor => (a ? { login: a.login, typename: a.__typename } : null);

function check(c: RawContext): Check {
  return c.__typename === "CheckRun"
    ? { typename: "CheckRun", name: c.name, status: c.status, conclusion: c.conclusion, url: c.detailsUrl, isRequired: c.isRequired ?? false }
    : { typename: "StatusContext", name: c.context, state: c.state, url: c.targetUrl, isRequired: c.isRequired ?? false };
}

/** Parse the `PR_QUERY` response into a snapshot. Returns `null` when the PR is missing. */
export function parsePr(json: string, repo: string, number: number, role: Role, account: string): PrSnapshot | null {
  const out = JSON.parse(json) as { data?: { repository?: { pullRequest?: RawPr | null } | null } };
  const pr = out.data?.repository?.pullRequest;
  if (!pr) return null;
  const commit = pr.commits.nodes[0]?.commit;
  if (!commit) return null;
  const reviews: Review[] = pr.reviews.nodes.map((r) => ({
    at: r.submittedAt,
    state: r.state,
    body: r.body ?? "",
    author: actor(r.author),
    commitOid: r.commit?.oid ?? null,
  }));
  return {
    repo,
    number,
    title: pr.title,
    url: pr.url,
    role,
    account,
    state: pr.state,
    isDraft: pr.isDraft,
    headSha: pr.headRefOid,
    headCommittedDate: commit.committedDate,
    mergeStateStatus: pr.mergeStateStatus,
    reviewDecision: pr.reviewDecision,
    checks: (commit.statusCheckRollup?.contexts.nodes ?? []).map(check),
    comments: pr.comments.nodes.map((c) => ({ at: c.createdAt, author: actor(c.author) })),
    reviews,
    threads: pr.reviewThreads.nodes.map((t) => ({
      isResolved: t.isResolved,
      comments: t.comments.nodes.map((c) => ({ at: c.createdAt, author: actor(c.author) })),
    })),
    reviewRequests: (pr.reviewRequests?.nodes ?? []).flatMap((n) => {
      const r = n.requestedReviewer;
      if (!r) return [];
      return r.login ? [r.login] : r.slug ? [`team:${r.slug}`] : [];
    }),
  };
}

export function prArgs(repo: string, number: number): string[] {
  const [o, r] = repo.split("/");
  return ["api", "graphql", "-f", `query=${PR_QUERY}`, "-F", `o=${o}`, "-F", `r=${r}`, "-F", `n=${number}`];
}

export interface PrRef {
  number: number;
  state: string;
  title: string;
  url: string;
}

/** `gh pr list/view --json number,state,title,url` output (object or array). */
export function parsePrRefs(json: string): PrRef[] {
  const v = JSON.parse(json) as PrRef | PrRef[];
  return Array.isArray(v) ? v : [v];
}
