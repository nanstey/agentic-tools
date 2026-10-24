#!/usr/bin/env bash
# Offline consistency checks for the generated Lite tier profiles and catalog.
set -euo pipefail
REPO="$(cd "$(dirname "$0")/../.." && pwd)"
python3 - "$REPO" <<'PY'
from pathlib import Path
import re
import sys

repo = Path(sys.argv[1])
agents_dir = repo / "agents"
append = (repo / "harness/pi/APPEND_SYSTEM.md").read_text()
readme = (repo / "README.md").read_text()
tiers = ("quick", "standard", "high", "premium")
thinking = {"quick": "low", "standard": "medium", "high": "high", "premium": "high"}
roles = {
    "scout": "scout",
    "researcher": "researcher",
    "planner": "planner",
    "worker": "worker",
    "reviewer-openai": "reviewer of OpenAI work",
    "reviewer-anthropic": "reviewer of Anthropic work",
}
prefixes = {
    "haiku": "anthropic/claude-",
    "sonnet": "anthropic/claude-",
    "opus": "anthropic/claude-",
    "fable": "anthropic/claude-",
    "gpt": "openai-codex/",
}

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

# Parse the policy table rather than duplicate its model routing in this test.
table = {}
for line in append.splitlines():
    if not line.startswith("| ") or " -> " not in line:
        continue
    cells = [cell.strip() for cell in line.strip().strip("|").split("|")]
    label, values = cells[0].strip("`"), cells[1:]
    if label in roles.values():
        if len(values) != len(tiers):
            fail(f"model table row {label!r} has {len(values)} tiers")
        table[label] = [value.split(" -> ", 1)[0] for value in values]
if set(table) != set(roles.values()):
    fail("APPEND_SYSTEM.md model table is missing an agent role")

def provider_model(short):
    stem = short.split("-", 1)[0]
    try:
        return prefixes[stem] + short
    except KeyError:
        fail(f"unrecognized table model {short!r}")

expected_names = {f"{role}-{tier}" for role in roles for tier in tiers}
files = sorted(agents_dir.glob("*.md"))
actual_names = {path.stem for path in files}
if actual_names != expected_names:
    fail(f"agent files differ: expected {len(expected_names)}, found {len(actual_names)}")

agents = {}
for path in files:
    fields, body = parse_agent(path)
    name = path.stem
    if fields.get("name") != name:
        fail(f"{path.relative_to(repo)} name does not match filename")
    if not fields.get("description"):
        fail(f"{name} has no description")
    if fields.get("exclude_extensions") != "[pi-jev]":
        fail(f"{name} must exclude pi-jev to preserve fixed thinking")
    agents[name] = (fields, body)

for role, table_label in roles.items():
    bodies = [agents[f"{role}-{tier}"][1] for tier in tiers]
    if any(body != bodies[0] for body in bodies[1:]):
        fail(f"{role} tier bodies drift")
    for index, tier in enumerate(tiers):
        fields, _ = agents[f"{role}-{tier}"]
        expected_model = provider_model(table[table_label][index])
        if fields.get("model") != expected_model:
            fail(f"{role}-{tier} model {fields.get('model')!r} != {expected_model!r}")
        if fields.get("thinking") != thinking[tier]:
            fail(f"{role}-{tier} thinking {fields.get('thinking')!r} != {thinking[tier]!r}")

catalog = {}
for line in readme.splitlines():
    match = re.fullmatch(r"\| \[`([^`]+)`\]\((agents/[^)]+)\) \| `([^`]+)`, ([^|]+) \| (.*) \|", line)
    if match:
        name, path, model, level, description = match.groups()
        catalog[name] = (path, model, level.strip(), description)
if set(catalog) != expected_names:
    fail(f"README agent catalog differs: expected {len(expected_names)}, found {len(catalog)}")
for name, (fields, _) in agents.items():
    path, model, level, description = catalog[name]
    expected = (f"agents/{name}.md", fields["model"], fields["thinking"], fields["description"])
    if (path, model, level, description) != expected:
        fail(f"README catalog row drifts from agents/{name}.md")

print("ok: 24 agent tiers match bodies, model table, and README catalog")
PY
