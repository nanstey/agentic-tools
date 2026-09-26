#!/bin/bash
# Idempotent setup for agent-browser: installs runtime deps into
# $AGENT_BROWSER_HOME (default ~/.browser-agent) and links the CLI.
set -euo pipefail

BASE="${AGENT_BROWSER_HOME:-$HOME/.browser-agent}"
SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

mkdir -p "$BASE/profiles"
chmod 700 "$BASE" "$BASE/profiles"

cp "$SKILL_DIR/agent-browser.mjs" "$BASE/agent-browser.mjs"

cd "$BASE"
if [ ! -f package.json ]; then
  printf '{ "name": "agent-browser-runtime", "private": true, "type": "module" }\n' > package.json
fi
npm install --no-fund --no-audit --save playwright @jkudish/jev-browser
npx playwright install chromium

mkdir -p "$HOME/.local/bin"
cat > "$HOME/.local/bin/agent-browser" <<EOF
#!/bin/bash
exec node "$BASE/agent-browser.mjs" "\$@"
EOF
chmod +x "$HOME/.local/bin/agent-browser"

echo "agent-browser installed. Try: agent-browser login personal https://github.com/login"
