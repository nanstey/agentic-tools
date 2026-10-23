---
name: durable
description: Operates the Durable local agent engine through its CLI. Use when checking, attaching to, chatting with, queueing, stopping, or approving Durable work.
user-invocable: true
disable-model-invocation: false
---

# Durable

Durable is a local agent engine for operating durable work across sessions and
machines. Its machine-local configuration is managed by the Durable CLI, not by
this skill.

## Commands

- `durable doctor` — check local setup and an agent's readiness.
- `durable status` — show agent state.
- `durable attach` — attach to an agent or conversation.
- `durable chat` — create, list, or resume chat conversations.
- `durable queue` — inspect queued work.
- `durable stop` — stop an agent or worker.
- `durable approve` — approve a pending action.

For installation, configuration, and complete operator procedures, see the
[Durable operator guide](https://github.com/nanstey/durable/blob/main/docs/operator.md).
