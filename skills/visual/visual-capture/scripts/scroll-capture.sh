#!/usr/bin/env bash
# Record a smooth full-page scroll of a URL to a .webm, sized to the viewport so
# there are no gray letterbox margins and with time-based (not jerky) scrolling.
# Substitutes concrete values into scroll-capture.js (run-code has no env) and
# runs it via `playwright-cli run-code` in its own session, then prints the path.
#
# Usage: scroll-capture.sh <url> <out.webm> [width] [height] [scroll_ms] [settle_ms] [end_ms]
set -euo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

url="${1:?usage: scroll-capture.sh <url> <out.webm> [width] [height] [scroll_ms] [settle_ms] [end_ms]}"
out="${2:?usage: scroll-capture.sh <url> <out.webm> [width] [height] [scroll_ms] [settle_ms] [end_ms]}"
w="${3:-1280}"; h="${4:-800}"; scroll_ms="${5:-9000}"; settle_ms="${6:-1200}"; end_ms="${7:-800}"

PW="$(bash "$here/resolve-tool.sh")" || { echo "scroll-capture: playwright-cli not found" >&2; exit 3; }
read -r -a pw <<<"$PW"   # PW may be "npx playwright cli" (multiple words)

# Render the hero script with concrete values (JSON-encoded strings, numeric ints).
tmpjs="$(mktemp)"
node - "$here/scroll-capture.js" "$url" "$out" "$w" "$h" "$settle_ms" "$scroll_ms" "$end_ms" >"$tmpjs" <<'NODE'
const fs = require('fs');
const [tpl, url, out, w, h, settle, scroll, end] = process.argv.slice(2);
const map = {
  __URL__: JSON.stringify(url),
  __OUT__: JSON.stringify(out),
  __VP_W__: String(Number(w)),
  __VP_H__: String(Number(h)),
  __SETTLE_MS__: String(Number(settle)),
  __SCROLL_MS__: String(Number(scroll)),
  __END_MS__: String(Number(end)),
};
let s = fs.readFileSync(tpl, 'utf8');
for (const k of Object.keys(map)) s = s.split(k).join(map[k]);
process.stdout.write(s);
NODE

"${pw[@]}" -s=vc-scroll open >/dev/null
trap 'rm -f "$tmpjs"; "${pw[@]}" -s=vc-scroll close >/dev/null 2>&1 || true' EXIT
"${pw[@]}" -s=vc-scroll run-code --filename="$tmpjs" >/dev/null

printf '%s\n' "$out"
