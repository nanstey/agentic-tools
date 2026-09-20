---
name: jev-ultrafast
description: Runs Jev Ultrafast through its pinned browser agent and verifies the requested page outcome. Use when a Chrome task benefits from its dynamic indexed action space.
user-invocable: true
disable-model-invocation: false
---

# Jev Ultrafast

> Upstream: [browser-use/jev-ultrafast](https://github.com/browser-use/jev-ultrafast) `0.1.0`, commit [`1231850a0bf1a0c0341fe408ef1668dbbfdfac46`](https://github.com/browser-use/jev-ultrafast/commit/1231850a0bf1a0c0341fe408ef1668dbbfdfac46) (MIT).

## Core Contract

Use the pinned upstream browser agent for an explicitly authorized Chrome task. It selects from observed indexed controls; it is not a replacement for the `typesafe-ai` skill's TypeSafe programming guidance.

## Prerequisites

- Python 3.12 or later and [`uv`](https://docs.astral.sh/uv/).
- Chrome and a working Browser Harness connection. Before a task, run:
  ```sh
  uv tool run --from browser-harness==0.1.13 browser-harness --doctor
  ```
  Follow its Chrome remote-debugging prompt. Do not proceed until the doctor reports a usable connection.
- `TYPESAFE_API_KEY` in the invoking process environment. Do not print, copy, commit, or put its value on a command line.
- `TEXT_MODEL_API_KEY` only if the task can require `TYPE_TEXT`; Jev uses it for the text helper. Configure its compatible endpoint/model settings as required by the chosen provider.

## Install, Update, and Remove

`install.sh` links this skill only. It does not install Python tooling or Jev Ultrafast.

Install the immutable upstream package without cloning it into the target repository:

```sh
uv tool install --python 3.12 "git+https://github.com/browser-use/jev-ultrafast.git@1231850a0bf1a0c0341fe408ef1668dbbfdfac46"
```

Reinstall the same immutable revision to update or repair it:

```sh
uv tool install --reinstall --python 3.12 "git+https://github.com/browser-use/jev-ultrafast.git@1231850a0bf1a0c0341fe408ef1668dbbfdfac46"
```

Remove it with the same manager:

```sh
uv tool uninstall jev-ultrafast
```

## Workflow

1. Confirm the target URL, intended outcome, authorization for any browser action, and how the outcome will be independently verified.
2. Run Browser Harness doctor. Set credentials only in the process environment; set `TEXT_MODEL_API_KEY` only when text generation is needed.
3. Start the inspector. `jev` has no documented command-line options; select a private loopback port with `TYPESAFE_DEMO_PORT`:
   ```sh
   TYPESAFE_DEMO_PORT=8766 jev
   ```
   Open `http://127.0.0.1:8766`, start the demo, and use **Choose next** to inspect a proposed action before execution or **Run automatically** only after authorization.
4. For a scripted task, write an explicit goal and consume states from `Agent.run()`:
   ```python
   from jev_ultrafast import Agent

   with Agent(
       "https://example.com/",
       "Open the requested page and stop when its main heading is visible.",
   ) as agent:
       for state in agent.run():
           print(state["elapsed_ms"], state["status"])
   ```
   Run a script without creating a project or clone in the target repository:
   ```sh
   uv run --no-project --with "git+https://github.com/browser-use/jev-ultrafast.git@1231850a0bf1a0c0341fe408ef1668dbbfdfac46" python task.py
   ```
5. Treat `DONE` as an agent decision, not proof. Independently inspect the resulting URL, visible page content, and task-specific evidence before reporting success.

## Safety Boundaries

- Never expose the inspector beyond its loopback default or relay its port to a network interface.
- Never start a paid model request or browser action without the user's configured credentials and authorization.
- Never treat `DONE` as outcome verification.
- Never claim support for shadow roots, frames, canvas, uploads, pop-up tabs, nested scrolling, arbitrary keyboard widgets, or the full accessible-name specification; these are upstream MVP limitations.

## Output Style

Report the installed immutable revision, Browser Harness doctor result, actions taken, independent outcome evidence, and any blocked or unsupported condition. Never include credential values.
