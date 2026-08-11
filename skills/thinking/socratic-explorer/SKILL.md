---
name: socratic-explorer
description: >
  Guides a user through deep exploration of any challenge or topic with a structured
  Socratic method, building from theory through principles to a tailored application and
  capturing the session as documents. Use when the user includes "Socratic" with a topic,
  or asks to "explore this Socratically," "Socratic mode," "walk me through this step by
  step from theory to practice," "help me think through [topic] deeply," or "really
  understand [topic] before acting on it." Applies to any domain where building from theory
  to concrete application beats jumping straight to answers.
user-invocable: true
disable-model-invocation: false
---

# Socratic Explorer

A structured method for deep exploration of any challenge or topic, progressing through three phases: understanding the landscape (Theory), extracting actionable principles (Principles), and building a concrete, tailored solution (Application). The user controls the pace, can critique and revise any phase, and only advances when satisfied. At the end, the skill offers to save the session as a document for later reference.

## Why This Approach Works

Most people ask for answers. Answers without understanding are fragile — they break the moment context shifts. This skill builds understanding first, then derives principles, then constructs a solution grounded in both. The result is an answer the user genuinely owns because they understand *why* it works, not just *what* it says.

The three phases mirror how expert practitioners naturally develop mastery: they study what works in general, extract the underlying principles, and then apply those principles to their specific situation. This skill makes that progression explicit and interactive.

## Trigger Recognition

The user activates this skill by including "Socratic" in their message along with a topic or challenge. Common patterns:

- "Socratic: how to handle a difficult stakeholder"
- "Socratic — designing a migration strategy for our legacy system"
- "Explore this Socratically: what's the best approach to team restructuring"
- "Socratic mode: I need to think through pricing strategy"

Extract the topic/challenge from whatever follows the trigger word.

## Phase 0: Clarification

Before beginning the three-phase arc, establish enough context to produce genuinely useful responses rather than generic ones. Ask clarifying questions — but only the essential ones. The goal is to understand the user's situation well enough to tailor each phase, not to conduct an exhaustive interview.

### What to Establish

1. **The specific challenge or goal.** What are they trying to achieve or understand? If the topic is broad ("leadership"), help narrow it to something actionable ("leading a team through an organizational restructuring").

2. **Their experience level with this topic.** Are they a beginner exploring unfamiliar territory, an intermediate practitioner who knows the basics but is stuck, or an expert looking for blind spots and advanced thinking? This calibrates the depth, vocabulary, and assumed knowledge in all three phases.

3. **Context and constraints.** What's the environment? What constraints exist? What has already been tried? This is the information that separates a tailored response from a generic one.

4. **What success looks like.** What would a useful outcome be? A decision framework? A concrete plan? Deeper understanding? A specific deliverable?

### Clarification Guidelines

- Ask 2 to 4 questions maximum. Combine related questions where possible.
- If the user's initial prompt already provides rich context, acknowledge what you already know and ask only what's missing.
- For simple or well-defined topics, this phase can be as brief as one question.
- Do not ask questions whose answers you can reasonably infer from context.
- Frame questions as choices or options where possible to reduce the user's cognitive load.

### Transition

Once the user answers, confirm your understanding in two to three sentences and announce that you're beginning Phase 1. Do not ask for permission to proceed — the user has already given it by answering the clarifying questions.

## Phase 1: Theory — "What Makes This Work Well"

The first phase explores the general landscape of the topic. The goal is to build a shared understanding of what excellence looks like in this domain, what the known challenges are, and what experienced practitioners have learned.

### Framing

The guiding question for this phase is: **"What makes this type of thing work well in general?"**

This is not the user's specific situation yet. This is the broader context — the patterns, the research, the accumulated wisdom of people who have navigated similar challenges. Think of it as surveying the terrain before planning a route.

### Content Guidelines

Adapt the depth and vocabulary to the user's stated experience level:

- **Beginner**: Build from fundamentals. Define terms. Use analogies. Assume no prior mental model.
- **Intermediate**: Skip basics. Focus on nuances, trade-offs, and common failure modes. Challenge assumptions they've likely formed.
- **Expert**: Go deep. Surface non-obvious dynamics, contrarian perspectives, and edge cases. Assume strong existing knowledge and push beyond it.

Regardless of level:

- Be substantive. Provide real insight, not platitudes.
- Name the tensions and trade-offs honestly rather than presenting a single "right way."
- Use concrete examples to ground abstract points.
- Identify what most people get wrong or overlook about this topic.
- Adapt response length to the complexity of the topic. Simple topics may need 300 words. Complex ones may need 1,500 or more.

### Phase 1 Closing

After delivering the Phase 1 response, ask:

> "Does this capture the landscape well, or would you like me to revise or expand any part of it before we move to the underlying principles?"

### Handling Critique

If the user critiques the response (disagrees, asks for changes, identifies gaps, requests different emphasis):

1. Take the critique seriously. Do not defend the original response unless the critique is factually incorrect.
2. Revise and re-present the *entire* Phase 1 response incorporating the feedback — not a patch or addendum, but a revised whole.
3. Ask the closing question again.

Repeat until the user signals satisfaction and readiness to advance (by saying something like "good," "move on," "next," "Q2," "principles," or similar).

## Phase 2: Principles — "What Frameworks and Principles Apply"

The second phase distills the general landscape into actionable principles, frameworks, and mental models. The shift is from "what's true about this domain" to "what guidelines should inform decisions and actions."

### Framing

The guiding question for this phase is: **"What principles, frameworks, and mental models apply here?"**

This bridges theory and practice. The user should finish this phase with a set of tools for thinking about their specific situation, not just knowledge about the topic in general.

### Content Guidelines

- Extract principles from the Phase 1 discussion — don't introduce entirely disconnected material.
- Present principles as decision-making tools, not academic abstractions. Each principle should help the user make a concrete choice or take a concrete action.
- Where relevant, organize principles into categories: design principles, facilitation principles, decision criteria, questioning techniques, evaluation frameworks, or whatever taxonomy fits the domain.
- Include anti-patterns — what to actively avoid and why.
- Show how principles interact and sometimes conflict. Real expertise involves navigating trade-offs between competing valid principles, not applying a single framework mechanically.
- Provide concrete examples of each principle in action where possible.
- Adapt length to complexity, as in Phase 1.

### Phase 2 Closing

After delivering the Phase 2 response, ask:

> "Do these principles give you what you need, or should I revise before we apply them to your specific situation?"

### Handling Critique

Same as Phase 1: take the critique seriously, revise and re-present the entire Phase 2 response, and ask the closing question again. Repeat until satisfied.

## Phase 3: Application — "Now Build It for My Case"

The third phase applies everything from Phases 1 and 2 to the user's specific situation. This is where general knowledge becomes a concrete, tailored solution.

### Framing

The guiding question for this phase is: **"Now apply all of this to my specific situation."**

This is the deliverable. It should be detailed, actionable, and directly usable. The user should be able to take this output and act on it.

### Content Guidelines

- Reference the user's specific context, constraints, and goals from Phase 0.
- Apply the principles from Phase 2 explicitly — the user should see the connection between the principles and the specific recommendations.
- Be concrete and specific. Include exact language for scripts, specific steps with timing, named tools or techniques, templates, checklists, or whatever the domain demands.
- Address likely failure modes and how to handle them in the user's specific context.
- Where appropriate, include contingency handling: "If X happens, do Y."
- This phase should be the longest and most detailed of the three. The user has invested time building understanding; the payoff is a comprehensive, tailored output.
- Adapt format to what the domain requires. A retrospective design needs a timed agenda with facilitator scripts. A strategy needs a decision framework with criteria. A technical migration needs a phased plan with rollback points. Match the output to the need.

### Phase 3 Closing

After delivering the Phase 3 response, ask:

> "Does this work for your situation, or would you like me to revise any part of it?"

Then, regardless of whether the user critiques or approves, provide three follow-up questions. These should be:

- Worded as if the user is asking them (first person)
- Thought-provoking and extending the exploration into adjacent territory
- Formatted in bold as Q1, Q2, and Q3 with two line breaks before and after each

### Handling Critique

Same as previous phases: revise and re-present the entire Phase 3 response incorporating feedback. Include the three follow-up questions again after each revision.

## Phase 4: Capture the Session

Once Phase 3 is approved (or the user engages a follow-up question), offer to save the
session so the work isn't lost. If the user accepts — or has already asked for a saved
copy — write the record and report the path. If they'd rather keep it in the conversation,
don't push.

Save as Markdown by default, to the working directory (or a path the user names). If the
user wants another format, produce it with whatever tooling is available (for example
`pandoc` to convert the Markdown); don't assume any specific environment.

The record captures the **final approved version** of each phase — not superseded drafts —
in a clear order: title, a short context summary from Phase 0, Phase 1 (Theory), Phase 2
(Principles), Phase 3 (Application), and the three follow-up questions. Preserve each
phase's structure as delivered and add nothing new: no commentary, summaries, or filler.

## Cross-Cutting Guidelines

### Tone Calibration

- Be direct and substantive. Avoid filler, throat-clearing, and hedging.
- Treat the user as intelligent. Explain *why*, not just *what*.
- Name trade-offs honestly. Do not present false certainty.
- Use a warm but professional tone. No sycophancy, no flattery, no excessive enthusiasm.
- If the user's premise contains a flaw, say so clearly and constructively — do not work around it silently.

### Continuity Between Phases

Each phase should build visibly on the previous one. Phase 2 should reference and distill Phase 1. Phase 3 should apply Phase 2's principles using Phase 1's context. The user should experience a coherent arc, not three disconnected essays.

### What This Skill Does NOT Do

- It does not skip phases. Even if the user seems to want an immediate answer, the value of this skill is the progression. If the user wants a quick answer, they should not use the Socratic trigger.
- It does not produce the three follow-up questions until Phase 3 is complete.
- It does not ask for permission to proceed between phases once the user signals readiness. "Move on" means move on.
- It does not save the session until Phase 3 is approved, and does not force a saved copy on a user who declines.

## Opening Message

When triggered, begin with:

> I'll guide you through this Socratically — building from general understanding through principles to a solution tailored to your situation. You'll control the pace: after each phase, you can critique and I'll revise, or you can advance to the next phase.
>
> At the end, I can save the full session as a document for your reference if you'd like.
>
> First, let me make sure I understand your challenge well enough to be genuinely useful.

Then ask the clarifying questions for Phase 0.
