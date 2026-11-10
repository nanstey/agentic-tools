#!/usr/bin/env bash
# Offline consistency checks for role-only Pi delegation profiles and catalog.
set -euo pipefail
REPO="$(cd "$(dirname "$0")/../.." && pwd)"
python3 - "$REPO" <<'PY'
from pathlib import Path
import json
import re
import sys

repo = Path(sys.argv[1])
agents_dir = repo / "agents"
append = (repo / "harness/pi/APPEND_SYSTEM.md").read_text()
readme = (repo / "README.md").read_text()
settings = json.loads((repo / "harness/pi/subagents.json").read_text())
expected = {
    "delegation-scout": "[read, grep, find, ls, bash, ext:builtin:codemode/codemode]",
    "delegation-researcher": "[read, ext:dist/web_search, ext:dist/fetch_content, ext:dist/get_search_content]",
    "delegation-planner": "[read, grep, find, ls, write]",
    "delegation-worker": "[read, grep, find, ls, bash, edit, write, ext:builtin:codemode/codemode]",
    "delegation-reviewer": "[read, grep, find, ls, bash, ext:builtin:codemode/codemode]",
}
# The APPEND_SYSTEM table is the source of truth for exact role/model/thinking
# selections. Keep the patch's runtime allowlist in lock-step with every cell.
expected_selections = {}
for line in append.splitlines():
    if not line.startswith("| `delegation-"):
        continue
    role = re.match(r"\| `(delegation-[^`]+)`", line).group(1)
    selections = set(re.findall(r"`([^`]+)`, (low|medium|high)", line))
    if not selections:
        fail(f"routing table row for {role} has no model/thinking selections")
    expected_selections.setdefault(role, set()).update(f"{model}|{thinking}" for model, thinking in selections)
expected_models = {selection.rsplit("|", 1)[0] for selections in expected_selections.values() for selection in selections}
expected_thinking = {selection.rsplit("|", 1)[1] for selections in expected_selections.values() for selection in selections}

def fail(message):
    raise SystemExit(f"FAIL: {message}")

def parse_agent(path):
    text = path.read_text()
    if not text.startswith("---\n"):
        fail(f"{path.relative_to(repo)} lacks frontmatter")
    try:
        raw, body = text[4:].split("\n---\n", 1)
    except ValueError:
        fail(f"{path.relative_to(repo)} has unterminated frontmatter")
    fields = {}
    for line in raw.splitlines():
        if ": " in line:
            key, value = line.split(": ", 1)
            fields[key] = value
    return fields, body

files = sorted(agents_dir.glob("*.md"))
actual = {path.stem for path in files}
if actual != set(expected):
    fail(f"agent files differ: expected {sorted(expected)}, found {sorted(actual)}")

for path in files:
    fields, body = parse_agent(path)
    name = path.stem
    if fields.get("name") != name:
        fail(f"{path.relative_to(repo)} name does not match filename")
    if not fields.get("description"):
        fail(f"{name} has no description")
    if fields.get("tools") != expected[name]:
        fail(f"{name} tools drift")
    if "model" in fields or "thinking" in fields:
        fail(f"{name} must not pin model or thinking")
    if name == "delegation-planner":
        if "exclude_extensions" in fields:
            fail("delegation-planner must not set exclude_extensions when extensions are false")
    elif fields.get("exclude_extensions") != "[pi-jev, pi-fallback-models]":
        fail(f"{name} must exclude pi-jev and pi-fallback-models")
    extensions = fields.get("extensions")
    if extensions != "false" and "ext:" not in fields.get("tools", ""):
        fail(f"{name} must disable extensions or allow at least one extension tool")
    if name == "delegation-planner" and extensions != "false":
        fail("delegation-planner must disable extensions")
    required = {
        "skills": "true",
        "allowed_subagents": "none",
        "prompt_mode": "append",
        "inherit_context": "false",
        "run_in_background": "true",
        "isolation": "off",
        "persist_session": "false",
        "output_transcript": "true",
    }
    for key, value in required.items():
        if fields.get(key) != value:
            fail(f"{name} {key} must be {value}")
    if name == "delegation-planner":
        for text in (
            "plan file path",
            "write or update only that one plan file",
            "Do not edit application source, tests, configuration, dependencies, or unrelated files.",
        ):
            if text not in body:
                fail(f"{name} lacks planning-artifact write boundary: {text!r}")

catalog = {}
for line in readme.splitlines():
    match = re.fullmatch(r"\| \[`([^`]+)`\]\((agents/[^)]+)\) \| (.*) \|", line)
    if match:
        name, path, description = match.groups()
        if name.startswith("delegation-"):
            catalog[name] = (path, description)
if set(catalog) != set(expected):
    fail(f"README delegation catalog differs: expected {sorted(expected)}, found {sorted(catalog)}")
for name in expected:
    fields, _ = parse_agent(agents_dir / f"{name}.md")
    if catalog[name] != (f"agents/{name}.md", fields["description"]):
        fail(f"README catalog row drifts from agents/{name}.md")

for required in (
    "fallbackSubagent", "scopeModels", "widgetMode", "fleetView", "agentMentions",
    "workflowsEnabled", "schedulingEnabled", "disableDefaultAgents", "packageAgents", "packageWorkflows", "worktreeIsolation",
):
    if required not in settings:
        fail(f"subagents.json omits {required}")
if settings["fallbackSubagent"] is not False or settings["scopeModels"] is not False:
    fail("subagents.json must fail closed and leave policy scope to the strict patch")
for key in ("fleetView", "workflowsEnabled", "schedulingEnabled", "disableDefaultAgents", "packageAgents", "packageWorkflows", "worktreeIsolation"):
    expected_value = False if key != "disableDefaultAgents" else True
    if settings[key] is not expected_value:
        fail(f"subagents.json {key} drift")
if settings["widgetMode"] != "off" or settings["agentMentions"] != "off":
    fail("subagents.json must disable widget and mentions")
if settings.get("maxSubagentDepth") != 1 or settings.get("rememberAgents") is not False:
    fail("subagents.json must disable nesting and persistent agent memory")

for text in (
    "delegation-scout", "delegation-researcher", "delegation-planner", "delegation-worker", "delegation-reviewer",
    "exact provider-qualified `model` and `thinking`", "get_subagent_result", "no stop/cancel tool",
    "effective-at-start", "package-provided agent types", "package-provided workflows",
    "The coordinator selects the delegation role", "state is exactly `{ task, context }`",
    "`role`", "`files touched`", "`producer family`", "`ambiguity`", "`stakes`", "`blast radius`",
    "confidence is below 0.6, retain the returned tier", "retry once at a stronger tier",
    "standalone Pi session in a new Orca worktree",
):
    if text not in append:
        fail(f"APPEND_SYSTEM.md missing routing policy: {text!r}")
if "scout-<tier>" in append or "reviewer-openai-<tier>" in append:
    fail("APPEND_SYSTEM.md retains retired tier routing")
for model in expected_models:
    if model not in append:
        fail(f"APPEND_SYSTEM.md omits routed model {model}")

patch = (repo / "harness/pi/patches/pi-subagents-strict-dispatch-0.22.1.patch").read_text()
match = re.search(r"MANAGED_DELEGATION_MODELS = new Set\(\[([\s\S]*?)\]\);", patch)
if not match:
    fail("strict dispatch patch omits managed model allowlist")
actual_models = set(re.findall(r'"([^"\n]+)"', match.group(1)))
if actual_models != expected_models:
    fail(f"strict dispatch model allowlist drift: {sorted(actual_models)}")
selection_matches = re.findall(r'"(delegation-[^"]+)": new Set\(\[([\s\S]*?)\]\),', patch)
actual_selections = {
    role: set(re.findall(r'"([^"\n]+\|(?:low|medium|high))"', body))
    for role, body in selection_matches
}
if actual_selections != expected_selections:
    fail(f"strict dispatch table selection allowlist drift: expected {expected_selections}, found {actual_selections}")
actual_thinking = {selection.rsplit("|", 1)[1] for selections in actual_selections.values() for selection in selections}
if actual_thinking != expected_thinking:
    fail(f"strict dispatch thinking allowlist drift: {sorted(actual_thinking)}")
for text in (
    "params.model == null || params.thinking == null",
    "registry.getAvailable",
    "Cannot verify model availability; refusing delegation dispatch.",
    "final/effective-at-start",
    "Only managed delegation-* profiles may spawn agents",
    "must originate from the global managed agents directory",
    "Project subagents.json conflicts with the global managed setting",
):
    if text not in patch:
        fail(f"strict dispatch patch omits {text!r}")
if "registry.getAvailable?.() ?? registry.getAll()" in patch:
    fail("strict dispatch patch must not fall back to getAll")

print("ok: five role-only delegation profiles, scoped extension tools, strict settings, routing policy, and README catalog match")
PY
