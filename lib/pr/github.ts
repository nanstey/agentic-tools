import type { Actor, Check, PrSnapshot, Review, Role } from "./types.ts";

/** Per-PR GraphQL query used by prflow and PR lifecycle scripts. */
export const PR_QUERY = `query($o:String!,$r:String!,$n:Int!,$commentsCursor:String,$reviewsCursor:String,$threadsCursor:String,$checksCursor:String){
# Legacy page-size markers: comments(last:50), reviews(last:50), reviewThreads(first:100), contexts(first:100)
repository(owner:$o,name:$r){
 pullRequest(number:$n){
  title url state isDraft headRefOid headRefName mergeStateStatus reviewDecision mergeable
  recentCommits:commits(last:100){nodes{commit{oid}}}
  commits(last:1){nodes{commit{oid committedDate statusCheckRollup{
   contexts(first:100,after:$checksCursor){
    nodes{__typename
     ... on CheckRun{name status conclusion detailsUrl isRequired(pullRequestNumber:$n)}
     ... on StatusContext{context state targetUrl isRequired(pullRequestNumber:$n)}
    }
    pageInfo{hasNextPage endCursor}
   }
  }}}}
  comments(last:50,after:$commentsCursor){nodes{createdAt author{login __typename}} pageInfo{hasNextPage endCursor}}
  reviews(last:50,after:$reviewsCursor){nodes{submittedAt state body commit{oid} author{login __typename}} pageInfo{hasNextPage endCursor}}
  reviewThreads(first:100,after:$threadsCursor){nodes{isResolved comments(last:50){nodes{createdAt author{login __typename}}}} pageInfo{hasNextPage endCursor}}
  reviewRequests(first:50){nodes{requestedReviewer{__typename ... on User{login} ... on Team{slug}}}}
 }
}
}`;

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
  headRefName?: string | null;
  mergeStateStatus: string;
  reviewDecision: string | null;
  commits: { nodes: { commit: { oid: string; committedDate: string; statusCheckRollup: { contexts: { nodes: RawContext[] } } | null } }[] };
  recentCommits: { nodes: { commit: { oid: string } }[] };
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
  const commit = pr.commits.nodes.at(-1)?.commit;
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
    commitOids: pr.recentCommits.nodes.map((n) => n.commit.oid),
    branch: pr.headRefName ?? null,
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
