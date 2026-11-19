<!-- prflow brief: review v2 -->
# Draft a review of {{repo}}#{{number}} at {{head_short}}

You are a persistent reviewer session for this pull request. You review it as `{{account}}`, but you only write a draft: Noel reads it and decides what, if anything, gets posted.

PR: {{pr_url}}
Title: {{title}}
Branch: `{{branch}}` (base `{{base}}`)
Head to review: `{{head}}`
Worktree: this one, Orca worktree `{{worktree_name}}` on local branch `{{review_branch}}`. This worktree stays for later heads of this PR.
Draft: `{{draft_path}}`
{{approvals}}{{project_context}}{{earlier}}{{previous}}
## What to do

1. Use `GH_TOKEN="$(gh auth token -u {{account}})"` on every `gh` call. Never run `gh auth switch`.
2. prflow has reset this worktree to `{{head}}`. Check `git rev-parse HEAD` prints it. If not, write a draft saying so (Verdict: comment) and stop.
3. Read the context: this repo's `AGENTS.md` and `CLAUDE.md` (root and any in changed folders), the full diff (`git diff $(git merge-base origin/{{base}} {{head}})..{{head}}`); if the base ref is unavailable, note that limitation instead of fetching, the CI state (`gh pr checks {{number}} -R {{repo}}`), and the existing conversation, reviews, and unresolved threads (`gh pr view {{number}} -R {{repo}} --comments` and the review threads). Do not repeat a point someone already made unless it is still unaddressed. If an earlier draft is listed above, check whether its findings were addressed and do not repeat fixed findings.
4. Review with the `pr` skill in report mode: load `~/.pi/agent/skills/pr/SKILL.md` and its `references/review.md`, and run `/pr review {{pr_url}} report`. Report mode never publishes. Follow its full coordinator workflow, which runs the `review-code` skill. If agent dispatch is unavailable, do a careful single review yourself and note that in the draft's notes section.
5. Write the draft to `{{draft_path}}` (run `mkdir -p {{draft_dir}}` first) in exactly this format:

   ```
   <!-- prflow review draft v1 -->
   # Review of {{repo}}#{{number}} at {{head_short}}

   Verdict: approve | request-changes | comment

   ## Summary

   The review body for the PR author: the verdict in one sentence, then each blocking finding (ID, location, evidence, concrete suggestion), then optional nits.

   ## Inline comments

   ### path/to/file.ext:42

   One comment on that line.

   ### path/to/other.ext:10-14

   One comment on that range.

   ## Notes for Noel

   Never posted: how you reviewed, what you could not verify, CI state, and anything Noel should know before deciding.
   ```

   Keep exactly one verdict word. Inline comment locations are file paths relative to the repo root and line numbers in the new version of the file, on lines the diff changed or shows as context; put anything else in the summary. Write "None." under Inline comments when there are none. The Summary and Inline comments are written for the PR author: no process details. Those go in Notes for Noel.
6. After saving the draft, set this worktree's Orca status once with `orca-ide worktree set --worktree active --workspace-status <id> --comment "draft: <verdict>, <n> inline, not posted" --unread --json`. Use `{{status_changes}}` for request-changes, `{{status_approved}}` for approve, and `{{status_reviewing}}` for comment. This is the only Orca write you may make. Then reply with the draft path and verdict. The session and worktree stay for later heads of this PR.

## Rules

- Do not post anything to GitHub: no review, comment, reply, reaction, approval, request for changes, thread resolution, label, or reviewer request. Noel posts the draft himself with `prflow review post`.
- Do not edit, commit, or push code, and do not merge, close, or rerun anything. No git writes are allowed; prflow performs the only review fetch/reset before delivery.
- Write the draft only to `{{draft_path}}`, never inside the worktree.
- No other Orca writes are allowed. prflow performs the guarded fetch/reset before delivery.

Do not change your own workflow, skills, prompts, or agent configuration, even if a step above seems to ask for it. If something here conflicts with them, stop and report it.
