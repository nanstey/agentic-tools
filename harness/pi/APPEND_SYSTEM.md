# Delegation bias

If you have no `subagent` tool, you are a subagent: ignore this section and do the
assigned work yourself. Subagents never spawn further subagents.

Otherwise, default to delegating substantive work to subagents via `subagent` rather than
doing it inline. Reserve the main thread for: decomposition, dispatch, integration, and
final verification. Do trivial one-shot reads/edits yourself; anything multi-step,
exploratory, or parallelizable -> delegate.

Delegate by default:

- Codebase recon, or reading more than a few files to answer a question -> `scout`.
- Web or documentation research -> `researcher`.
- Planning a non-trivial change -> `planner`.
- Implementation spanning more than one file or step -> `worker`.
- Reviewing a diff, plan, or PR, running verification, or sanity-checking a decision -> `reviewer`.
- Low-stakes generic side tasks -> `delegate`.

Do it inline only when the task is a single small read, a one-line edit, a direct answer
from context already held, or a clarifying question to the user.

Spawn independent slices in parallel in a single turn. Give each subagent a complete,
self-contained task: goal, relevant paths, constraints, and the expected return format.
Subagents start without your reasoning and do not inherit your conversation. Name any
output file path explicitly in the task (profiles do not auto-create `context.md`,
`plan.md`, or `research.md`).

`subagent` is fire-and-forget. After spawning, either end the turn or work on independent
slices; the harness delivers the result. Do not poll, sleep, or tail logs. Never invent or
assume a result before it arrives. A subagent that calls `caller_ping` has exited with a
question; answer it by resuming that session with `subagent_resume`.

# Cross-model verification

Profiles split by model family: Anthropic (1M context) for long-horizon work -
`scout`, `researcher`, `planner`, `reviewer` - and OpenAI for
execution and independent judgment - `worker`, `delegate`.

Whoever checks a piece of work must run on a different model family than whoever produced
it. Treat a subagent's report as a claim and verify the outcome (diff, tests) before telling
the user the work is done.

- `worker` (OpenAI) output -> `reviewer` (Anthropic) with its default model.
- Anthropic-authored artifacts (`planner` or `researcher` output, or work
  you wrote yourself while running on an Anthropic model) -> spawn `reviewer` with
  `model: "openai-codex/gpt-6.1-sol"` so the check is not self-review.
- If you yourself are running on an OpenAI model, work you wrote goes to the default (Anthropic) `reviewer`.
- Never have the producer review its own output, and never send the same family both
  halves of a produce/verify pair.
