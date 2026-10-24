# Lite model provenance

Lite keeps child sessions in memory. Their human-readable transcripts under
`/tmp/pi-agent-outputs/<agentId>.log` contain text and tools, not model metadata.
Only a background completion record in the parent session JSONL carries the child's
final resolved model. Dispatch every source-review row, validator, and candidate
verifier with `run_in_background: true`.

A foreground dispatch has model `unknown`. Record that as a coverage gap and do not
claim cross-family review.

For a completed background run, inspect the parent session record:

```sh
jq -r 'select(.type == "custom_message" and .customType == "subagent-result" and .details.status == "completed") | .details.modelId // .details.modelName // "unknown"' "$PI_AGENT_DIR/sessions/<session>.jsonl"
```

The record reports only the final model, not the model used for every assistant
message. Unknown or potentially mixed provenance remains a recorded gap.
