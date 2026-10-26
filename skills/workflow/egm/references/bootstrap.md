# Bootstrap

## Goal

Build a readable README hierarchy for an existing codebase. A leaf component README is a **peanut**: local, concrete context. A parent or root README is **hay**: a concise map assembled from its children.

## Workflow

1. Inspect the target tree and existing documentation. Exclude generated, vendored, dependency, and build-output directories unless the human includes them.
2. Count candidate directories. For more than 15, present the scope and wait for an explicit safety approval before writing anything.
3. Work bottom-up. Write or update peanuts for leaf components first, then summarize them into intermediate hay, then the root hay.
4. A peanut explains its purpose, contained files, interface, invariants, side effects, and verification. Hay explains system purpose, boundaries, subdirectories, global invariants, side effects, and verification.
5. Keep claims grounded in files read. Do not invent behavior. Preserve useful existing README content and mark uncertainty for human review.
6. Read every changed README after writing. Register the bootstrap record in the plan README as `egm-bootstrap`, status `done`, then stop for user review.

## Templates

```markdown
# <Component>

## Purpose
## Contents
## Interface
## Invariants
## Side effects
## Verification
```

```markdown
# <System or directory>

## Overview
## Boundaries
## Subdirectories
## Invariants
## Side effects
## Verification
```
