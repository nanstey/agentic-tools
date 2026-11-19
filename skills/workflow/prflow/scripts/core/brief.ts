/**
 * Briefs for Pi sessions: versioned templates (`templates/briefs/<kind>.md`)
 * filled with PR facts. Pure; the caller reads the templates and the facts.
 */
import type { BriefFacts, FeedbackNote } from "../adapters/gh.ts";
import { informationalApproval } from "./classify.ts";
import type { ProjectContext } from "./config.ts";
import type { Actor } from "./types.ts";

export type BriefKind = "ci" | "comments" | "behind" | "nudge" | "restart" | "review" | "review-nudge";
export const BRIEF_KINDS: readonly BriefKind[] = ["ci", "comments", "behind", "nudge", "restart", "review", "review-nudge"];

/** Every brief ends with this sentence (the no-self-edit note). */
export const NO_SELF_EDIT = "Do not change your own workflow, skills, prompts, or agent configuration";

export interface Template {
  /** `<kind> v<n>`, from the first line `<!-- prflow brief: <kind> v<n> -->`. */
  id: string;
  body: string;
}

/** Parse a template file. Throws when the version header is missing or names another kind. */
export function parseTemplate(kind: BriefKind, text: string): Template {
  const m = /^<!-- prflow brief: ([a-z-]+) (v\d+) -->\n/.exec(text);
  if (!m || m[1] !== kind) throw new Error(`brief template ${kind}: first line must be <!-- prflow brief: ${kind} v<n> -->`);
  return { id: `${kind} ${m[2]}`, body: text.slice(m[0].length) };
}

/** Fill `{{name}}` placeholders. Throws on a placeholder with no value, so a brief is never sent half-filled. */
export function render(t: Template, vars: Record<string, string>): string {
  const out = t.body.replace(/\{\{([a-z_]+)\}\}/g, (_, name: string) => {
    const v = vars[name];
    if (v === undefined) throw new Error(`brief ${t.id}: no value for {{${name}}}`);
    return v;
  });
  return `${out.replace(/\n{3,}/g, "\n\n").trim()}\n`;
}

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 3)}...` : s);
const ts = (iso: string) => `${iso.slice(0, 16).replace("T", " ")}Z`;
const who = (a: Actor) => a?.login ?? "ghost";
const quote = (body: string, n = 1500) =>
  clip(body.trim() || "(no text)", n)
    .split("\n")
    .map((l) => `  > ${l}`.trimEnd())
    .join("\n");
const isHuman = (a: Actor, me: string) => a !== null && a.typename !== "Bot" && a.login !== me;

/**
 * The feedback a comments brief lists: human comments and reviews newer than
 * the head commit and the author's own latest reply, and unresolved threads whose
 * last comment is a human's newer than the head. Approvals that ask for no
 * changes are left out, as in the classifier.
 */
export function feedbackItems(f: BriefFacts, headCommittedDate: string, me: string): string[] {
  const mine = [...f.comments, ...f.reviews].filter((n) => n.author?.login === me).map((n) => n.at);
  const cutoff = [headCommittedDate, ...mine].reduce((m, x) => (x > m ? x : m));
  const item = (n: FeedbackNote, what: string) => `- **${who(n.author)}** ${what} (${ts(n.at)}) ${n.url}\n${quote(n.body)}`;
  const out: { at: string; text: string }[] = [];
  for (const c of f.comments) if (isHuman(c.author, me) && c.at > cutoff) out.push({ at: c.at, text: item(c, "commented") });
  for (const r of f.reviews) {
    if (!isHuman(r.author, me) || r.at <= cutoff) continue;
    if (informationalApproval({ state: r.state, body: r.body, at: r.at, author: r.author, commitOid: null })) continue;
    if (r.body.trim() === "" && r.state !== "CHANGES_REQUESTED") continue;
    out.push({ at: r.at, text: item(r, r.state === "CHANGES_REQUESTED" ? "requested changes" : "reviewed") });
  }
  for (const t of f.threads) {
    const last = t.comments.at(-1);
    if (t.isResolved || !last || !isHuman(last.author, me) || last.at <= headCommittedDate) continue;
    const where = t.path ? `\`${t.path}${t.line ? `:${t.line}` : ""}\`` : "a thread";
    const lines = t.comments.slice(-5).map((c) => `  - **${who(c.author)}** (${ts(c.at)}) ${c.url}\n${quote(c.body, 1000).replace(/^ {2}/gm, "    ")}`);
    out.push({ at: last.at, text: `- Unresolved thread on ${where}, last comment ${last.url}\n${lines.join("\n")}` });
  }
  return out.sort((a, b) => a.at.localeCompare(b.at)).map((x) => x.text);
}

/** Lines from `gh run view --log-failed` that most likely name the cause (at most 20 lines, 2500 chars). */
export function logExcerpt(log: string): string {
  const lines = log
    .split("\n")
    // `<job>\t<step>\t<timestamp> <text>`: keep the text.
    .map((l) => l.split("\t").slice(-1)[0] ?? "")
    .map((l) => l.replace(/^\uFEFF?\d{4}-\d\d-\d\dT[\d:.]+Z ?/, "").trimEnd())
    .filter((l) => l.trim() !== "");
  const hits = lines.filter((l) => /error|fail|exception|assert|expected|panic|not ok|✗|×/i.test(l));
  const pick = (hits.length ? hits : lines).slice(-20).join("\n");
  return pick.length > 2500 ? pick.slice(-2500) : pick;
}

export interface FailedJob {
  name: string;
  url: string | null;
  /** `logExcerpt` output, or why there is none. */
  cause: string;
}

export function ciDetails(jobs: FailedJob[]): string {
  return jobs
    .map((j) => {
      const fence = j.cause.includes("```") ? "~~~~" : "```";
      return `- **${j.name}**: ${j.url ?? "(no log URL)"}\n  Likely cause, from \`gh run view --log-failed\`:\n\n${fence}\n${j.cause}\n${fence}`;
    })
    .join("\n\n");
}

export function behindDetails(mergeState: string, base: string): string {
  return mergeState === "DIRTY"
    ? `GitHub reports the branch as DIRTY: it conflicts with \`${base}\`.`
    : `GitHub reports the branch as BEHIND \`${base}\`; the base must be merged in before the PR can merge.`;
}

export function projectContextText(p: ProjectContext | null): string {
  if (!p) return "";
  const docs = p.folder ? `\`${p.path}/AGENTS.md\` and \`${p.path}/${p.folder}/AGENTS.md\`` : `\`${p.path}/AGENTS.md\``;
  return `\nProject context: this PR belongs to the shared project documented in \`${p.path}\`${p.folder ? ` (\`${p.folder}/\`)` : ""}. Run \`git pull\` there, then read ${docs} to see how this PR relates to other tasks, and follow its rules for updating those docs when you change a PR.\n`;
}

/** Project context for a reviewer: read-only. */
export function reviewProjectContextText(p: ProjectContext | null): string {
  if (!p) return "";
  const docs = p.folder ? `\`${p.path}/AGENTS.md\` and \`${p.path}/${p.folder}/AGENTS.md\`` : `\`${p.path}/AGENTS.md\``;
  return `\nProject context: this PR belongs to the shared project documented in \`${p.path}\`${p.folder ? ` (\`${p.folder}/\`)` : ""}. Read ${docs} and the task this PR implements there to judge whether it does what its task needs and how it relates to other tasks. Do not edit, commit, or pull in that checkout.\n`;
}

export function otherTriggersText(kinds: string[]): string {
  return kinds.length ? `\nAlso open on this PR: ${kinds.join(", ")}. prflow sends a separate brief for each once this one is done; you need not act on them now.\n` : "";
}

/** For a retry: what the earlier attempt left behind. */
export function previousText(attempt: number, reason: string | null, lastMessage: string | null): string {
  if (attempt <= 1) return "";
  const msg = lastMessage?.trim() ? `Its last message:\n\n${quote(lastMessage, 2000)}\n` : "It left no message.\n";
  return `\n## Previous attempt\n\nThis is attempt ${attempt}. Attempt ${attempt - 1} ended: ${reason ?? "unknown"}. ${msg}\nCheck the branch and the PR for work it already pushed or replied to, and continue from there. Do not redo finished work.\n`;
}

/** For a review request on a PR someone else already approved. */
export function approvalsText(approvers: string[]): string {
  return approvers.length ? `\nAlready approved by ${approvers.join(", ")} with no changes requested, so this review is low priority. Still review it fully.\n` : "";
}

/** For a review of a newer head: the earlier draft to build on. */
export function earlierDraftText(head8: string | null, path: string | null, account: string): string {
  if (!head8 || !path) return "";
  return `\n## Earlier draft\n\nprflow saved a draft for the earlier head \`${head8}\` at \`${path}\`, and \`${account}\` may have posted it. Review the full PR, but say for each earlier finding whether it is fixed, still open, or moot, and mark new findings as new.\n`;
}
