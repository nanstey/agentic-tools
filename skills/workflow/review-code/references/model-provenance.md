# Review dispatch evidence

Lite keeps child sessions in memory. Their human-readable transcripts under
`/tmp/pi-agent-outputs/<agentId>.log` contain text and tools, not final-model
metadata. A background completion record in the parent session JSONL can supply
that metadata:

```sh
jq -r 'select(.type == "custom_message" and .customType == "subagent-result" and .details.status == "completed") | .details.modelId // .details.modelName // "unknown"' "$PI_AGENT_DIR/sessions/<session>.jsonl"
```

Use this evidence only when the reviewed work is positively known to be
produced by the current agent session and the coordinator claims cross-family
verification. Select the opposite reviewer family and keep an unavailable or
unknown completion model in the local packet and user report.

For third-party code, author and completion model provenance do not determine
coverage. Assign source-review work across both reviewer families, verify task
completion and findings, and merge/deduplicate the results. Do not mark the
review incomplete or non-independent because that provenance is unknown or
mixed, and never put it in a PR comment or review body.
