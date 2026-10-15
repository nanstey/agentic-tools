# Stacks REST API reference (condensed)

Source: https://github.github.com/gh-stack/reference/rest-api/
All endpoints usable via `gh api` — no extension required.
**If Stacked PRs are not enabled for the repo, Stacks endpoints return `404 Not Found`** (this doubles as the capability probe).

## The `stack` object on pull requests

Present on every REST endpoint returning a PR (`GET .../pulls`, `GET .../pulls/{n}`, `pull_request` webhooks); `null` for standalone PRs.

```
gh api /repos/OWNER/REPO/pulls/42 --jq '.stack'
```

| Field | Description |
| --- | --- |
| `id` | Global stack identifier |
| `number` | Repo-scoped stack number (shown in GitHub UI) |
| `size` | Total PRs in the stack |
| `position` | 1-based; `1` = bottom (closest to trunk) |
| `base.ref` / `base.sha` | The stack's ultimate target branch and its HEAD SHA |

Note: the PR's own `base.ref` is the layer directly below it; `stack.base.ref` is the trunk. They differ for every PR except the bottom one.

## Stacks endpoints

Stacks are addressed by repo-scoped **stack number** (`stack.number`).

### List

```
GET /repos/{owner}/{repo}/stacks
```

Ordered by stack number, newest first. Query params: `pull_request` (filter to the stack containing that PR number), `per_page` (max 100), `page`.

```
gh api "repos/OWNER/REPO/stacks?pull_request=102"
```

### Get

```
GET /repos/{owner}/{repo}/stacks/{stack_number}
```

### Create

```
POST /repos/{owner}/{repo}/stacks
```

Body: `{"pull_requests": [bottom, ..., top]}` — ordered bottom→top, min 2, max 100. Each PR's base ref must match the previous PR's head ref (valid chain). Returns `201`.

```
echo '{"pull_requests": [101, 102, 103]}' | \
  gh api --method POST repos/OWNER/REPO/stacks --input -
```

### Add to top

```
POST /repos/{owner}/{repo}/stacks/{stack_number}/add
```

Body: `{"pull_requests": [...]}` — only the delta, from current top upward (min 1). First new PR's base ref must match current top's head ref. Returns `200`.

### Unstack

```
POST /repos/{owner}/{repo}/stacks/{stack_number}/unstack
```

No body. Removes unmerged PRs; merged/merging/queued PRs are left in place. PRs remain ⇒ `200` with updated stack; none remain ⇒ stack dissolved, `204`.

## Stack resource

| Field | Description |
| --- | --- |
| `id`, `number`, `node_id`, `url` | Identifiers |
| `base.ref` | Trunk branch the stack targets |
| `open` | `true` while any PR is open |
| `created_at` | ISO 8601 |
| `pull_requests[]` | Bottom→top; each: `number`, `state` (`open`/`closed`), `draft`, `merged_at`, `head.ref`, `head.sha` |
