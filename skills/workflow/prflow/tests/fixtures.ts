/**
 * Synthetic GitHub GraphQL fixtures in the `PR_QUERY` response shape. The same
 * JSON feeds prflow (`parsePr`).
 */

export const ME = "octocat";
export const HEAD = "c0ffee11aabbccddeeff00112233445566778899";
export const HEAD_AT = "2026-01-10T12:00:00Z";
export const BEFORE = "2026-01-10T11:00:00Z";
export const AFTER = "2026-01-10T13:00:00Z";
export const LATER = "2026-01-10T14:00:00Z";

type Author = { login: string; __typename: string } | null;
export const user = (login: string): Author => ({ login, __typename: "User" });
export const bot = (login: string): Author => ({ login, __typename: "Bot" });
export const me = user(ME);
export const alice = user("alice");

export const run = (name: string, status: string, conclusion: string | null, detailsUrl: string | null = `https://github.com/o/r/actions/runs/1/job/${name}-id`, isRequired = false) => ({
  __typename: "CheckRun",
  name,
  status,
  conclusion,
  detailsUrl,
  isRequired,
});
export const ok = (name: string, required = false) => run(name, "COMPLETED", "SUCCESS", undefined, required);
export const status = (context: string, state: string, targetUrl: string | null = `https://ci.example/build/${context}-id`, isRequired = false) => ({
  __typename: "StatusContext",
  context,
  state,
  targetUrl,
  isRequired,
});

export const comment = (author: Author, createdAt: string) => ({ createdAt, author });
export const review = (author: Author, state: string, submittedAt: string | null, body = "", oid: string | null = HEAD) => ({
  submittedAt,
  state,
  body,
  commit: oid ? { oid } : null,
  author,
});
export const thread = (isResolved: boolean, ...comments: ReturnType<typeof comment>[]) => ({
  isResolved,
  comments: { nodes: comments },
});

export interface PrSpec {
  title?: string;
  state?: string;
  isDraft?: boolean;
  head?: string;
  committedDate?: string;
  merge?: string;
  decision?: string | null;
  /** `null` means no status rollup at all. */
  checks?: unknown[] | null;
  comments?: unknown[];
  reviews?: unknown[];
  threads?: unknown[];
  requests?: string[];
}

/** A full `PR_QUERY` response for one PR. */
export function prResponse(s: PrSpec = {}): unknown {
  const checks = s.checks === undefined ? [ok("build")] : s.checks;
  return {
    data: {
      repository: {
        pullRequest: {
          title: s.title ?? "Fixture PR",
          url: "https://github.com/Acme/widgets/pull/1",
          state: s.state ?? "OPEN",
          isDraft: s.isDraft ?? false,
          headRefOid: s.head ?? HEAD,
          headRefName: "feature",
          mergeStateStatus: s.merge ?? "CLEAN",
          reviewDecision: s.decision === undefined ? "APPROVED" : s.decision,
          mergeable: "MERGEABLE",
          commits: {
            nodes: [
              {
                commit: {
                  committedDate: s.committedDate ?? HEAD_AT,
                  statusCheckRollup: checks === null ? null : { contexts: { nodes: checks } },
                },
              },
            ],
          },
          comments: { nodes: s.comments ?? [] },
          reviews: { nodes: s.reviews ?? [] },
          reviewThreads: { nodes: s.threads ?? [] },
          reviewRequests: {
            nodes: (s.requests ?? []).map((login) => ({ requestedReviewer: { __typename: "User", login } })),
          },
        },
      },
    },
  };
}

export interface Case {
  name: string;
  pr: PrSpec;
  /** Expected triggers as `kind[:detail]`. */
  lines: string[];
  kind: string;
}

/** Author-PR cases: expected triggers and the chosen kind. */
export const CASES: Case[] = [
  // merge
  { name: "clean approved green", pr: {}, lines: ["merge"], kind: "merge-ready" },
  { name: "clean approved, no rollup", pr: { checks: null }, lines: ["merge"], kind: "merge-ready" },
  { name: "clean approved, empty rollup", pr: { checks: [] }, lines: ["merge"], kind: "merge-ready" },
  { name: "clean, review required", pr: { decision: "REVIEW_REQUIRED" }, lines: [], kind: "waiting" },
  { name: "clean, no decision", pr: { decision: null }, lines: [], kind: "waiting" },
  { name: "blocked approved", pr: { merge: "BLOCKED" }, lines: [], kind: "waiting" },
  { name: "unstable approved", pr: { merge: "UNSTABLE" }, lines: [], kind: "waiting" },
  { name: "skipped and neutral are green", pr: { checks: [run("a", "COMPLETED", "SKIPPED"), run("b", "COMPLETED", "NEUTRAL")] }, lines: ["merge"], kind: "merge-ready" },
  // pending
  { name: "check run in progress", pr: { checks: [ok("a"), run("b", "IN_PROGRESS", null)] }, lines: [], kind: "waiting" },
  { name: "check run queued with failure", pr: { checks: [run("a", "COMPLETED", "FAILURE"), run("b", "QUEUED", null)] }, lines: [], kind: "waiting" },
  { name: "status pending", pr: { checks: [status("ci", "PENDING")] }, lines: [], kind: "waiting" },
  { name: "status expected", pr: { checks: [status("ci", "EXPECTED")] }, lines: [], kind: "waiting" },
  { name: "pending hides behind", pr: { merge: "BEHIND", checks: [run("a", "PENDING", null)] }, lines: [], kind: "waiting" },
  // ci
  { name: "failure", pr: { checks: [run("lint", "COMPLETED", "FAILURE")] }, lines: ["ci:lint-id"], kind: "ci" },
  {
    name: "all bad conclusions sorted",
    pr: {
      checks: [
        run("z", "COMPLETED", "TIMED_OUT"),
        run("b", "COMPLETED", "STARTUP_FAILURE"),
        run("a", "COMPLETED", "ACTION_REQUIRED"),
        run("m", "COMPLETED", "FAILURE"),
        run("c", "COMPLETED", "CANCELLED"),
      ],
    },
    lines: ["ci:a-id,b-id,m-id,z-id"],
    kind: "ci",
  },
  { name: "status failure and error", pr: { checks: [status("y", "FAILURE"), status("x", "ERROR")] }, lines: ["ci:x-id,y-id"], kind: "ci" },
  { name: "job id falls back to name", pr: { checks: [run("lint", "COMPLETED", "FAILURE", null), status("ctx", "ERROR", "")] }, lines: ["ci:ctx,lint"], kind: "ci" },
  { name: "trailing slash url falls back to name", pr: { checks: [run("lint", "COMPLETED", "FAILURE", "https://x/y/")] }, lines: ["ci:lint"], kind: "ci" },
  { name: "failure beats behind", pr: { merge: "DIRTY", checks: [run("t", "COMPLETED", "FAILURE")] }, lines: ["ci:t-id"], kind: "ci" },
  // rerun
  { name: "cancelled", pr: { checks: [ok("a"), run("e2e", "COMPLETED", "CANCELLED")] }, lines: ["rerun:e2e-id"], kind: "rerun" },
  { name: "cancelled sorted", pr: { checks: [run("b", "COMPLETED", "CANCELLED"), status("ok", "SUCCESS"), run("a", "COMPLETED", "CANCELLED")] }, lines: ["rerun:a-id,b-id"], kind: "rerun" },
  { name: "failure beats cancelled", pr: { checks: [run("b", "COMPLETED", "CANCELLED"), status("x", "ERROR")] }, lines: ["ci:x-id"], kind: "ci" },
  { name: "cancelled beats behind", pr: { merge: "BEHIND", checks: [run("x", "COMPLETED", "CANCELLED")] }, lines: ["rerun:x-id"], kind: "rerun" },
  // behind
  { name: "behind", pr: { merge: "BEHIND" }, lines: ["behind"], kind: "behind" },
  { name: "dirty", pr: { merge: "DIRTY", decision: "REVIEW_REQUIRED" }, lines: ["behind"], kind: "behind" },
  // comments
  { name: "human comment after head", pr: { comments: [comment(alice, AFTER)] }, lines: [`comments:${AFTER}`, "merge"], kind: "merge-ready" },
  { name: "human comment before head", pr: { comments: [comment(alice, BEFORE)] }, lines: ["merge"], kind: "merge-ready" },
  { name: "bot and ghost comments ignored", pr: { decision: null, comments: [comment(bot("ci-bot"), AFTER), comment(null, AFTER)] }, lines: [], kind: "waiting" },
  { name: "own later reply answers", pr: { decision: null, comments: [comment(alice, AFTER), comment(me, LATER)] }, lines: [], kind: "waiting" },
  { name: "own earlier comment does not answer", pr: { decision: null, comments: [comment(me, AFTER), comment(alice, LATER)] }, lines: [`comments:${LATER}`], kind: "comments" },
  { name: "own reply at same second does not answer", pr: { decision: null, comments: [comment(alice, AFTER), comment(me, AFTER)] }, lines: [`comments:${AFTER}`], kind: "comments" },
  { name: "latest of several", pr: { decision: null, comments: [comment(alice, LATER), comment(user("bob"), AFTER)] }, lines: [`comments:${LATER}`], kind: "comments" },
  { name: "approval without body ignored", pr: { reviews: [review(alice, "APPROVED", AFTER)] }, lines: ["merge"], kind: "merge-ready" },
  { name: "approval with body counts", pr: { reviews: [review(alice, "APPROVED", AFTER, "nit: rename")] }, lines: [`comments:${AFTER}`, "merge"], kind: "merge-ready" },
  { name: "changes requested without body counts", pr: { decision: "CHANGES_REQUESTED", reviews: [review(alice, "CHANGES_REQUESTED", AFTER)] }, lines: [`comments:${AFTER}`], kind: "comments" },
  { name: "bot review ignored", pr: { decision: null, reviews: [review(bot("copilot"), "COMMENTED", AFTER, "summary")] }, lines: [], kind: "waiting" },
  { name: "own review answers", pr: { decision: null, comments: [comment(alice, AFTER)], reviews: [review(me, "COMMENTED", LATER)] }, lines: [], kind: "waiting" },
  { name: "unresolved thread last human", pr: { decision: null, threads: [thread(false, comment(alice, AFTER))] }, lines: [`comments:${AFTER}`], kind: "comments" },
  { name: "resolved thread ignored", pr: { decision: null, threads: [thread(true, comment(alice, AFTER))] }, lines: [], kind: "waiting" },
  { name: "thread last reply mine", pr: { decision: null, threads: [thread(false, comment(alice, AFTER), comment(me, LATER))] }, lines: [], kind: "waiting" },
  { name: "thread uses last comment time", pr: { decision: null, threads: [thread(false, comment(alice, BEFORE), comment(user("bob"), AFTER))] }, lines: [`comments:${AFTER}`], kind: "comments" },
  { name: "empty thread ignored", pr: { decision: null, threads: [thread(false)] }, lines: [], kind: "waiting" },
  { name: "comments and ci", pr: { comments: [comment(alice, AFTER)], checks: [run("t", "COMPLETED", "FAILURE")] }, lines: [`comments:${AFTER}`, "ci:t-id"], kind: "ci" },
  { name: "comments and behind", pr: { merge: "BEHIND", comments: [comment(alice, AFTER)] }, lines: [`comments:${AFTER}`, "behind"], kind: "comments" },
  { name: "comments while checks pending", pr: { comments: [comment(alice, AFTER)], checks: [run("t", "IN_PROGRESS", null)] }, lines: [`comments:${AFTER}`], kind: "comments" },
  // draft
  { name: "draft is skipped", pr: { isDraft: true, comments: [comment(alice, AFTER)], checks: [run("t", "COMPLETED", "FAILURE")] }, lines: [], kind: "waiting" },
];
