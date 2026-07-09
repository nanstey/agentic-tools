---
name: wayfinder
description: Charts a huge chunk of work — more than one agent session can hold — as a shared map of investigation tickets, then resolves them one at a time until the route to the destination is clear. Use when a loose, oversized idea needs breaking into a navigable plan, backed by an issue tracker or a markdown sub-folder.
user-invocable: true
disable-model-invocation: true
---

# Wayfinder

## Core Contract

Chart a shared map of an oversized effort and resolve its tickets one at a time until the way to the destination is clear.
**Plan, don't do** by default: produce decisions, not deliverables, unless the effort's Notes override it.
The map lives in a pluggable **backend** — an issue tracker or a **markdown workspace** — and its tickets tie to a **branch strategy**. Pick both up front and state the choice.
**Never resolve more than one ticket per session.**
Follow `CLAUDE.md` / `AGENTS.md` on conflict.

A loose idea has arrived — too big for one agent session, and wrapped in fog: the way from here to the **destination** isn't visible yet. Wayfinding is about finding that way, not charging at the destination. This skill charts the way as a **shared map**, then works its tickets one at a time until the route is clear.

The destination varies per effort, and naming it is the first act of charting — it shapes every ticket. It might be a spec to hand off and iterate on, a decision to lock before planning starts, or a change made in place like a data-structure migration. The map is domain-agnostic — engineering work, course content, whatever fits the shape.

## Plan, don't do

Wayfinder is **planning** by default: each ticket resolves a decision, and the map is done when the way is clear — nothing left to decide before someone goes and does the thing. The pull to just do the work is usually the signal you've reached the edge of the map and it's time to hand off. An effort can override this in its **Notes** — carrying execution into the map itself — but absent that, produce decisions, not deliverables.

## Refer by name

Every map and ticket has a **name** — its title (in the tracker) or its markdown filename's title. In everything the human reads — narration, the map's Decisions-so-far — refer to it by that name, never by a bare id, number, or slug. A wall of `#42, #43, #44` is illegible; names read at a glance. The id and link don't vanish — a name wraps its link — but they ride *inside* the name, never stand in for it.

## Backends

The map, its tickets, blocking, and the frontier query all live in a **backend**. Two are supported; choose one when charting and record it in the map's **Notes**.

### Issue tracker

The map is a single issue labelled `wayfinder:map`; its tickets are child issues. Blocking uses the tracker's **native** dependency relationship, which renders the frontier visually in the tracker UI. Where these physically live is tracker-specific — consult the tracker doc's "Wayfinding operations" section if one is provided. Claiming assigns the ticket to the driving dev.

### Markdown workspace (default when no tracker is configured)

The map and its tickets are plain files in a sub-folder of the repo, so the whole effort travels with the branch and reviews as a diff.

```
.wayfinder/<effort-slug>/
  MAP.md                       # the map — the index (see "The map body")
  tickets/
    001-<slug>.md              # one file per ticket
    002-<slug>.md
```

Each ticket file carries frontmatter and a body:

```markdown
---
title: <human-readable ticket name>
type: research | prototype | grilling | task
status: open | claimed | closed
assignee: <name, when claimed>
blocked-by: [003, 007]        # ticket ids that must close first; [] when none
---

## Question

<the decision or investigation this ticket resolves>
```

Backend operations in markdown mode:

- **Ticket id** = the numeric filename prefix; **name** = `title`.
- **Claim** = set `status: claimed` and `assignee` before any work, and commit that change first so concurrent sessions see it.
- **Unblocked** = every id in `blocked-by` points at a `status: closed` file.
- **Frontier** = ticket files that are `open`, unblocked, and unassigned — resolve ties by ascending id.
- **Assets** created while resolving are committed under the ticket's folder (or linked by repo-relative path from the ticket body), never pasted inline.

## Branch strategies

The markdown workspace ties directly to git. Pick the strategy that matches how the resulting work should be reviewed and shipped, and record it in **Notes**.

### Stacked branches (feature branch + a branch per task)

Keep the map on a long-lived feature branch; each ticket that produces real work gets its own branch stacked on top.

- Chart the map on `feat/<effort>`; commit `.wayfinder/<effort>/`.
- For each task ticket, branch `feat/<effort>-<ticket-slug>` off the feature branch, do the work, open a PR targeting the feature branch.
- The feature branch integrates the stack; the map's Decisions-so-far links each task branch/PR.
- Best when tasks are interdependent or should land together behind one integration branch.

### Base-merged plan (land the map, work from base)

Treat the high-level plan as its own shippable artifact, merge it to base, then fan tasks out independently.

- Chart the map on `feat/<effort>`, then merge just the planning commit into base (`main`/`develop`).
- Each task branches off **base**, referencing the now-shared map, and opens a PR targeting base.
- Sessions and PRs stay independent — no stack to restack.
- Best when the plan is stable and tasks are parallelizable with little cross-dependency.

State the chosen strategy when charting; a session working the map follows whatever Notes records.

## The map

The map is the canonical artifact — one issue (tracker) or one `MAP.md` (markdown). It is an **index**, not a store: it lists the decisions made and points at the tickets that hold their detail. A decision lives in exactly one place — its ticket — so the map never restates it, only gists it and links.

### The map body

The whole map at low resolution, loaded once per session. Open tickets are **not** listed here — they're found by the frontier query.

```markdown
## Destination

<what reaching the end of this map looks like — the spec, decision, or change this effort is finding its way to. One or two lines; every session orients to it before choosing a ticket.>

## Notes

<backend (tracker or markdown); branch strategy; domain; skills every session should consult; standing preferences for this effort>

## Decisions so far

<!-- the index — one line per closed ticket: enough to judge relevance, then zoom the link for the detail the ticket holds -->

- [<closed ticket title>](link) — <one-line gist of the answer>

## Not yet specified

<!-- see "Fog of war": in-scope fog you can't ticket yet; graduates as the frontier advances -->

## Out of scope

<!-- see "Out of scope": work ruled beyond the destination; closed, never graduates -->
```

## Ticket types

Every ticket is either **HITL** — human in the loop, worked *with* a human who speaks for themselves — or **AFK**, driven by the agent alone. A HITL ticket only resolves through that live exchange; the agent never stands in for the human's side of it.

Each ticket carries a type (a `wayfinder:<type>` label in a tracker, the `type` frontmatter field in markdown):

- **Research** (AFK): Reading documentation, third-party APIs, or local resources like knowledge bases. Creates a markdown summary as a linked asset. Use when knowledge outside the current working directory is required.
- **Prototype** (HITL): Raise the fidelity of the discussion by making a cheap, rough, concrete artifact to react to — an outline, a rough take, a stub, or UI/logic code via the `prototype` skill. Links the prototype as an asset. Use when "how should it look" or "how should it behave" is the key question.
- **Grilling** (HITL): Conversation, one question at a time, to pin down a decision. The default case.
- **Task** (HITL or AFK): Manual work that must happen before a *decision* can be made — nothing to decide, prototype, or research, but the discussion is blocked until it's done (signing up for a service, provisioning access, moving data so its shape can be seen). This is the one type that *does* rather than decides, and it earns its place by unblocking a decision, not by delivering the destination. The agent drives it alone where it can (AFK); otherwise it hands the human a precise checklist (HITL). Resolved when the work is done; the answer records what was done and any resulting facts (credentials location, new URLs, row counts) later tickets depend on.

## Fog of war

The map is _deliberately_ incomplete: don't chart what you can't yet see. Beyond the live tickets lies the **fog of war** — the dim view of decisions you can tell are coming but can't yet pin down, because they hang on questions still open. Resolving a ticket clears the fog ahead of it, graduating whatever's now specifiable into fresh tickets — one at a time, until the way to the destination is clear and no tickets remain.

The map's **Not yet specified** section is where that dim view is written down: the suspected question, the area to revisit later. Everything here is in scope, just not sharp enough to ticket.

**Fog or ticket?** The test is whether you can state the question precisely now — _not_ whether you can answer it now.

- **Ticket when** the question is already sharp — even if it's blocked and you can't act on it yet.
- **Not yet specified when** you can't yet phrase it that sharply. Don't pre-slice the fog into ticket-sized pieces.

**Not yet specified** excludes what's already decided (Decisions so far), what's already a live ticket, and what's out of scope.

## Out of scope

Fog only ever gathers _toward_ the destination. The destination fixes the scope, so work beyond it is **out of scope** — it isn't fog, and it doesn't belong in **Not yet specified**. It gets its own **Out of scope** section: work consciously ruled out of _this_ effort. Scope, not sharpness, lands it here.

Out-of-scope work never graduates, so it returns only if the destination is redrawn — and then as a fresh effort, not a resumption. When a ticket turns out to sit past the destination — mis-scoped in while charting, or exposed by a resolution — **close it** and leave one line in **Out of scope**: the gist plus why it's out, linking the closed ticket. It stays out of **Decisions so far**, which records the route actually walked.

## Invocation

Two modes. Either way, **never resolve more than one ticket per session.**

### Chart the map

User invokes with a loose idea.

1. **Choose the backend and branch strategy.** Detect a configured tracker; default to the markdown workspace if none. When markdown, pick a branch strategy (stacked branches vs base-merged plan) with the user. Record both in Notes.
2. **Name the destination.** Grill to pin down what this map is finding its way to — the spec, decision, or change. The destination fixes the scope, so it's settled first.
3. **Map the frontier.** Grill again, **breadth-first**: fan out across the whole space rather than deep on any one thread, surfacing the open decisions and the first steps takeable now. **If this surfaces no fog** — the way is already clear, the whole journey small enough for one session — you don't need a map. Stop and ask the user how they'd like to proceed.
4. **Create the map** (tracker issue labelled `wayfinder:map`, or `.wayfinder/<effort>/MAP.md`): Destination and Notes filled in, Decisions-so-far empty, the fog sketched into **Not yet specified**.
5. **Create the tickets you can specify now** — then wire blocking edges in a **second pass** (ids must exist before they can reference each other). Everything you can't yet specify stays in **Not yet specified**.
6. Stop — charting is one session's work; do not also resolve tickets.

### Work through the map

User invokes with a map (URL, number, or workspace path). A ticket is **optional** — without one, you pick the next decision, not the user.

1. Load the **map** — the low-res view, not every ticket body. Read Notes for backend, branch strategy, and skills to consult.
2. Choose the ticket. If the user named one, use it. Otherwise take the first frontier ticket in order. **Claim it** before any work.
3. Resolve it — **zoom as needed**: fetch the full body of any related or closed ticket on demand; invoke the skills Notes names. If in doubt, grill.
4. Record the resolution: post the answer (resolution comment, or an `## Answer` section in the ticket file), **close** the ticket, and **append a context pointer** to the map's Decisions-so-far.
5. Add newly-surfaced tickets (create-then-wire); graduate any fog the answer has made specifiable, clearing each graduated patch from **Not yet specified**. If the answer reveals a ticket sits beyond the destination, **rule it out of scope**. If the decision invalidates other parts of the map, update or delete those tickets.

The user may run unblocked tickets in parallel, so expect other sessions (or branches) to be editing the map concurrently.

## Safety Rules

- Never resolve more than one ticket per session.
- Never do the deliverable work when the effort is in default plan-only mode; produce decisions unless Notes says otherwise.
- Never begin work on a ticket before claiming it (assign / set `status: claimed`) and making that claim visible first.
- Never restate a decision's detail on the map; the map only gists and links.
- Never stand in for the human's side of a HITL ticket.
- Never leave the map's backend and branch strategy unrecorded in Notes.

## Output Style

Report the backend and branch strategy chosen, the map's location (URL or path), the destination in one line, and — per session — the ticket claimed/resolved and the Decisions-so-far entry added. When charting, list the tickets created and what stayed in the fog.
