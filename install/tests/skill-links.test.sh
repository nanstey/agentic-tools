#!/usr/bin/env bash
# Offline check: relative Markdown links must stay within their own skill directory.
set -euo pipefail
REPO="${REPO:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"

python3 - "$REPO" <<'PY'
from pathlib import Path
import os
import re
import sys
from urllib.parse import unquote

repo = Path(sys.argv[1]).resolve()
skills = repo / "skills"
links = (
    re.compile(r"!?\[(?:!?\[[^]\n]*\]\([^\n)]*\)|[^]\n])*\]\(\s*(?P<destination><[^>\n]*>|[^\s)\n]+)"),
    re.compile(r"^\s{0,3}\[[^]\n]+\]:\s*(?P<destination><[^>\n]*>|[^\s)\n]+)"),
    re.compile(r'''(?:href|src)\s*=\s*["'](?P<destination>[^"']+)["']''', re.I),
    re.compile(r'''(?:href|src)\s*=\s*(?P<destination>[^'"\s>][^\s>]*)''', re.I),
)
problems = []
files = sorted(skills.rglob("*.md"))

for path in files:
    relative = path.relative_to(skills)
    if len(relative.parts) < 3:
        problems.append(f"{path.relative_to(repo)} is not inside a skill directory")
        continue
    skill_root = skills / relative.parts[0] / relative.parts[1]
    for line_number, line in enumerate(path.read_text().splitlines(), 1):
        for link in links:
            for match in link.finditer(line):
                destination = match.group("destination")
                if destination.startswith("<"):
                    destination = destination[1:-1]
                target = unquote(destination).split("#", 1)[0].split("?", 1)[0]
                if not target or target.startswith("/") or re.match(r"^[a-z][a-z0-9+.-]*:", target, re.I):
                    continue
                resolved = Path(os.path.normpath(str(path.parent / target)))
                try:
                    resolved.relative_to(skill_root)
                except ValueError:
                    problems.append(
                        f"{path.relative_to(repo)}:{line_number}: relative Markdown link "
                        f"escapes skill root: {destination}"
                    )

if problems:
    raise SystemExit("FAIL:\n" + "\n".join(problems))

print(f"ok: {len(files)} skill Markdown files keep relative links within their skill roots")
PY
