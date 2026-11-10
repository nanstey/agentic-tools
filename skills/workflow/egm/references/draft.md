# Draft

## Workflow

1. Apply the no-code gate: confirm the target is planning work. Do not write code or change source files.
2. Read the concept brief or notes and relevant repository context. Resolve the artifact location as in `SKILL.md`.
3. Draft one section at a time in this order: **Problem**, **Technical Plan**, **Alternatives**, **Detailed Implementation**. Present each section for a human gate before continuing.
4. In Detailed Implementation, list every file to create, modify, or delete and explain its rationale, behavior, interfaces, and validation. Do not leave implementation design choices to the implementer.
5. Use [design-doc-template.md](design-doc-template.md), [feature-spec](standards/feature-spec.md), and [implementation-readiness](standards/implementation-readiness.md).
6. Write the approved draft as one file in the resolved location. Set its `Status` to `Draft`, record decisions in `## Decision record`, and stop for user review.

## Section Gates

At each section, distinguish settled decisions from open questions. Resolve contradictions before changing the document. The final document remains `Draft` until the human marks its own `Status` as `Approved`.
