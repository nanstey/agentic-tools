---
name: terse
description: Keeps responses concise and outcome-first by removing redundancy and non-essential detail. Use when writing docs, skills, comments, and chat responses.
user-invocable: true
disable-model-invocation: false
---

- Avoid repetition.
- Write only what is needed to convey the main idea.
- Summaries should state outcomes, not process.
- Consider whether the writing is even necessary. Is the comment or tsdoc explaining something non-obvious? Eliminate unhelpful comments where code is self-documenting.
- Remove comments that appear reference plan options or alternative implementations. Only reference other implementation options if they would otherwise have been the assumed default choice.