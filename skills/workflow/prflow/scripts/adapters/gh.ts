import type { Actor } from "../../../../../lib/pr/types.ts";
import { actor, type RawActor } from "../../../../../lib/pr/actors.ts";
export { PR_QUERY, parsePr, prArgs } from "../../../../../lib/pr/github.ts";

const REPO = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const RUN_ID = /^[1-9]\d{0,19}$/;
export const jobLogArgs = (repo: string, jobId: string): string[] => ["run", "view", "--job", jobId, "-R", repo, "--log-failed"];
function isJobLog(args: readonly string[]): boolean {
  return args.length === 7 && RUN_ID.test(args[3] ?? "") && REPO.test(args[5] ?? "") && jobLogArgs(args[5] ?? "", args[3] ?? "").every((x, i) => x === args[i]);
}

/** Commands prflow may run. Anything else, or any write, throws. */
export function assertReadOnly(args: readonly string[]): void {
  const [a, b] = args;
  if (a === "run") {
    if (!isJobLog(args)) throw new Error(`prflow: gh ${args.join(" ")} is not an allowed read call`);
    return;
  }
  const ok = (a === "search" && b === "prs") || (a === "pr" && (b === "list" || b === "view")) || (a === "auth" && b === "token") || a === "api";
  if (!ok) throw new Error(`prflow: gh ${a ?? ""} ${b ?? ""} is not an allowed read call`);
  if (a === "api") {
    if (b !== "graphql") throw new Error("prflow: only gh api graphql is allowed");
    const rest = args.slice(2);
    for (let i = 0; i < rest.length; i += 2) {
      const flag = rest[i];
      const value = rest[i + 1];
      if ((flag !== "-f" && flag !== "-F") || value === undefined) throw new Error(`prflow: gh api graphql argument ${flag ?? ""} is not allowed`);
      if (value.startsWith("query=") && !/^query=\s*query\b/.test(value)) throw new Error("prflow: only GraphQL queries are allowed");
      if (/\bmutation\b/.test(value)) throw new Error("prflow: GraphQL mutations are not allowed");
      if (flag === "-F" && value.slice(value.indexOf("=") + 1).startsWith("@")) throw new Error("prflow: file-valued fields are not allowed");
    }
  }
}

export interface SearchHit { repo: string; number: number }
export function parseSearch(json: string): SearchHit[] {
  const rows = JSON.parse(json) as { number: number; repository: { nameWithOwner: string } }[];
  return rows.map((r) => ({ repo: r.repository.nameWithOwner, number: r.number }));
}

export interface PrRef {
  number: number;
  state: string;
  title: string;
  url: string;
  /** Head commit sha, when requested. */
  headRefOid?: string;
}

/** `gh pr list/view --json number,state,title,url,headRefOid` output (object or array). */
export function parsePrRefs(json: string): PrRef[] {
  const v = JSON.parse(json) as PrRef | PrRef[];
  return Array.isArray(v) ? v : [v];
}

/**
 * Feedback detail for a comments brief: bodies, URLs, and thread locations.
 * Read-only; fetched only when prflow writes a brief.
 */
export const BRIEF_QUERY = `query($o:String!,$r:String!,$n:Int!){repository(owner:$o,name:$r){pullRequest(number:$n){
baseRefName headRefName
comments(last:50){nodes{createdAt url body author{login __typename}}}
reviews(last:50){nodes{submittedAt state url body author{login __typename}}}
reviewThreads(first:100){nodes{isResolved path line originalLine comments(last:20){nodes{createdAt url body author{login __typename}}}}}}}}`;

export function briefArgs(repo: string, number: number): string[] {
  const [o, r] = repo.split("/");
  return ["api", "graphql", "-f", `query=${BRIEF_QUERY}`, "-F", `o=${o}`, "-F", `r=${r}`, "-F", `n=${number}`];
}

export interface FeedbackNote {
  at: string;
  author: Actor;
  url: string;
  body: string;
}

export interface BriefFacts {
  baseRef: string;
  headRef: string;
  comments: FeedbackNote[];
  reviews: (FeedbackNote & { state: string })[];
  threads: { isResolved: boolean; path: string | null; line: number | null; comments: FeedbackNote[] }[];
}

type RawNote = { createdAt?: string; submittedAt?: string | null; url: string; body: string | null; author: RawActor };
const note = (n: RawNote): FeedbackNote => ({ at: n.createdAt ?? n.submittedAt ?? "", author: actor(n.author), url: n.url, body: n.body ?? "" });

/** Parse the `BRIEF_QUERY` response. Returns `null` when the PR is missing. */
export function parseBriefFacts(json: string): BriefFacts | null {
  const out = JSON.parse(json) as {
    data?: {
      repository?: {
        pullRequest?: {
          baseRefName: string;
          headRefName: string;
          comments: { nodes: RawNote[] };
          reviews: { nodes: (RawNote & { state: string })[] };
          reviewThreads: { nodes: { isResolved: boolean; path: string | null; line: number | null; originalLine: number | null; comments: { nodes: RawNote[] } }[] };
        } | null;
      } | null;
    };
  };
  const pr = out.data?.repository?.pullRequest;
  if (!pr) return null;
  return {
    baseRef: pr.baseRefName,
    headRef: pr.headRefName,
    comments: pr.comments.nodes.map(note),
    reviews: pr.reviews.nodes.filter((r) => r.submittedAt).map((r) => ({ ...note(r), state: r.state })),
    threads: pr.reviewThreads.nodes.map((t) => ({ isResolved: t.isResolved, path: t.path, line: t.line ?? t.originalLine, comments: t.comments.nodes.map(note) })),
  };
}
