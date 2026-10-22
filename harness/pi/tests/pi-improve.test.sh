#!/usr/bin/env bash
# Offline tests for the self-improvement loop plumbing. No models, worktrees or
# PRs: pi-improve runs with PI_BIN=/bin/true in a temp PI_CODING_AGENT_DIR.
# Usage: harness/pi/tests/pi-improve.test.sh
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$HERE/../../.." && pwd)"
P="$REPO/harness/pi/bin/pi-improve"
FIX="$HERE/fixtures/seeded-defect.jsonl"
BRIEF="brief text that is long enough to pass the minimum length requirement of eighty characters total"
pass=0; fail=0
ok() { pass=$((pass+1)); echo "ok   $1"; }
bad() { fail=$((fail+1)); echo "FAIL $1"; }
check() { local name=$1; shift; if "$@" >/dev/null 2>&1; then ok "$name"; else bad "$name"; fi; }
fails() { local name=$1; shift; if "$@" >/dev/null 2>&1; then bad "$name"; else ok "$name"; fi; }

new_env() {
  SB=$(mktemp -d)
  export PI_CODING_AGENT_DIR=$SB/agent AGENTIC_TOOLS_REPO=$REPO PI_BIN=/bin/true PI_IMPROVE_NO_ORCA=1
  unset PI_SELF_IMPROVE_CHILD PI_SELF_IMPROVE_RUN PI_SELF_IMPROVE_ROOT PI_SELF_IMPROVE_HEADLESS PI_IMPROVE_DRY_RUN PI_SELF_IMPROVE PI_IMPROVE_REVIEWER_MODEL
  mkdir -p "$PI_CODING_AGENT_DIR/self-improve"
}

# static
check "node --check pi-improve" node --check "$P"
check "bash -n install.sh" bash -n "$REPO/install.sh"
check "fixture is valid jsonl" bash -c "jq -e . '$FIX' >/dev/null"

# digest
new_env
out=$("$P" digest "$FIX" 2>&1)
echo "$out" | grep -q "changelog-fmt" && ok "digest shows the failing command" || bad "digest shows the failing command"
echo "$out" | grep -q "1 errors\|1 error" && ok "digest counts errors" || bad "digest counts errors"
fails "digest rejects unknown option" "$P" digest "$FIX" --bogus
fails "digest rejects option missing value" "$P" digest "$FIX" --max-chars

# start: dry run, slug, reviewer family
new_env
dry=$(echo "$BRIEF" | "$P" start My-Slug --dry-run 2>&1)
echo "$dry" | jq -e '.slug=="my-slug" and .branch=="self-improve-my-slug"' >/dev/null && ok "start --dry-run normalizes slug" || bad "start --dry-run normalizes slug"
echo "$dry" | jq -e '.reviewer|startswith("anthropic/")' >/dev/null && ok "default reviewer is opposite family" || bad "default reviewer is opposite family"
[ -z "$(ls "$PI_CODING_AGENT_DIR/self-improve/runs" 2>/dev/null)" ] && ok "dry-run writes no run record" || bad "dry-run writes no run record"
fails "same-family reviewer rejected" bash -c "echo '$BRIEF' | PI_IMPROVE_REVIEWER_MODEL=anthropic/x '$P' start a --model anthropic/y --dry-run"
fails "routed same-family reviewer rejected" bash -c "echo '$BRIEF' | PI_IMPROVE_REVIEWER_MODEL=openrouter/anthropic/claude-opus-5-5 '$P' start a --model anthropic/y --dry-run"
fails "unqualified model rejected" bash -c "echo '$BRIEF' | '$P' start a --model gpt --dry-run"
fails "empty brief rejected" bash -c "echo '' | '$P' start a --dry-run"
fails "worker cannot start work without a user request" bash -c "echo '$BRIEF' | PI_SELF_IMPROVE_CHILD=worker '$P' start a --dry-run"
requested=$(echo "$BRIEF" | PI_SELF_IMPROVE_CHILD=worker "$P" start user-requested --user-requested "Start an improvement for the reported issue" --dry-run 2>&1)
echo "$requested" | jq -e '.slug=="user-requested" and .userRequested=="Start an improvement for the reported issue"' >/dev/null && ok "worker starts a user-requested job" || bad "worker starts a user-requested job"
git clone -q "$REPO" "$SB/repo"
git -C "$SB/repo" branch -f main HEAD
git -C "$SB/repo" update-ref refs/remotes/origin/main HEAD
git -C "$SB/repo" symbolic-ref refs/remotes/origin/HEAD refs/remotes/origin/main
export AGENTIC_TOOLS_REPO="$SB/repo"
mkdir -p "$PI_CODING_AGENT_DIR/self-improve/runs"
printf '%s\n' '{"kind":"worker","parent":"another-worker","root":"worker-run","slug":"existing","state":"started"}' > "$PI_CODING_AGENT_DIR/self-improve/runs/existing.json"
cap=$(echo "$BRIEF" | PI_SELF_IMPROVE_CHILD=worker PI_SELF_IMPROVE_RUN=worker-run PI_IMPROVE_MAX_WORKERS=1 "$P" start a --user-requested "Start an improvement for the reported issue" 2>&1)
echo "$cap" | grep -Fq "worker cap reached" && ok "worker user request still obeys the root cap" || bad "worker user request still obeys the root cap"
rm -rf "$PI_CODING_AGENT_DIR/self-improve/runs"
mkdir -p "$PI_CODING_AGENT_DIR/self-improve/runs"
printf '%s\n' '{"id":"worker-run","kind":"worker","parent":"manual","root":"manual","userRequested":"Earlier request","slug":"first","state":"started"}' > "$PI_CODING_AGENT_DIR/self-improve/runs/parent.json"
recursion=$(echo "$BRIEF" | PI_SELF_IMPROVE_CHILD=worker PI_SELF_IMPROVE_RUN=worker-run "$P" start child --user-requested "Start another improvement" 2>&1)
echo "$recursion" | grep -Fq "cannot start another follow-up" && ok "user-requested follow-up cannot recurse" || bad "user-requested follow-up cannot recurse"
rm -rf "$PI_CODING_AGENT_DIR/self-improve/runs"
mkdir -p "$PI_CODING_AGENT_DIR/self-improve/runs"
printf '%s\n' '{"id":"worker-run","kind":"worker","parent":"manual","root":"manual","slug":"first","state":"started"}' > "$PI_CODING_AGENT_DIR/self-improve/runs/parent.json"
printf '%s\n' '{"id":"child-run","kind":"worker","parent":"worker-run","root":"worker-run","userRequested":"First request","slug":"child","state":"started"}' > "$PI_CODING_AGENT_DIR/self-improve/runs/child.json"
direct=$(echo "$BRIEF" | PI_SELF_IMPROVE_CHILD=worker PI_SELF_IMPROVE_RUN=worker-run "$P" start second --user-requested "Start another improvement" 2>&1)
echo "$direct" | grep -Fq "only one direct user-requested follow-up" && ok "manual worker has one direct follow-up" || bad "manual worker has one direct follow-up"
fails "worker cannot force a user request" bash -c "echo '$BRIEF' | PI_SELF_IMPROVE_CHILD=worker '$P' start a --user-requested 'Start an improvement for the reported issue' --force --dry-run"
fails "headless worker cannot use a user request" bash -c "echo '$BRIEF' | PI_SELF_IMPROVE_CHILD=worker PI_SELF_IMPROVE_HEADLESS=1 '$P' start a --user-requested 'Start an improvement for the reported issue' --dry-run"
fails "user-requested needs an instruction" bash -c "echo '$BRIEF' | PI_SELF_IMPROVE_CHILD=worker '$P' start a --user-requested --dry-run"
fails "user-requested rejects multiple lines" bash -c "echo '$BRIEF' | PI_SELF_IMPROVE_CHILD=worker '$P' start a --user-requested $'one\\ntwo' --dry-run"
fails "user-requested rejects overlong instructions" bash -c "echo '$BRIEF' | PI_SELF_IMPROVE_CHILD=worker '$P' start a --user-requested \"\$(printf 'x%.0s' {1..281})\" --dry-run"
new_env
git clone -q "$REPO" "$SB/repo"
git -C "$SB/repo" branch -f main HEAD
git -C "$SB/repo" update-ref refs/remotes/origin/main HEAD
git -C "$SB/repo" symbolic-ref refs/remotes/origin/HEAD refs/remotes/origin/main
export AGENTIC_TOOLS_REPO="$SB/repo"
record=$(echo "$BRIEF" | PI_SELF_IMPROVE_CHILD=worker "$P" start recorded-request --user-requested "Start an improvement for the reported issue" 2>&1)
brief=$(echo "$record" | jq -r '.brief')
echo "$record" | jq -e '.userRequested=="Start an improvement for the reported issue"' >/dev/null && ok "run record stores a user request" || bad "run record stores a user request"
grep -Fq -- '- user-requested instruction: "Start an improvement for the reported issue"' "$brief" && ok "generated brief stores a user request" || bad "generated brief stores a user request"

# explicit repo override is authoritative
new_env
fails "AGENTIC_TOOLS_REPO that is not a repo is an error, not a fallback" env AGENTIC_TOOLS_REPO=/nonexistent bash -c "echo '$BRIEF' | '$P' start a"
SCR=$(mktemp -d); git -C "$SCR" init -q -b main
echo "$BRIEF" | env AGENTIC_TOOLS_REPO=$SCR "$P" start a --dry-run 2>&1 | grep -q "cannot locate\|not a git" && bad "override to a bare git repo is accepted" || ok "override to any git repo is accepted"

# kill switch
new_env
touch "$PI_CODING_AGENT_DIR/self-improve/disabled"
fails "disabled file blocks start" bash -c "echo '$BRIEF' | '$P' start a --dry-run"
fails "disabled file blocks reflect" "$P" reflect "$FIX"
rm "$PI_CODING_AGENT_DIR/self-improve/disabled"
fails "PI_SELF_IMPROVE=0 blocks reflect" env PI_SELF_IMPROVE=0 "$P" reflect "$FIX"

# reflect: dedupe and concurrent cap (PI_BIN=/bin/true so the launch is a no-op)
new_env
export PI_IMPROVE_MAX_REFLECTIONS_PER_DAY=3
for i in 1 2 3 4 5 6 7 8; do echo "{\"n\":$i}" > "$SB/s$i.json"; done
for i in 1 2 3 4 5 6 7 8; do ( "$P" reflect "$SB/s$i.json" >/dev/null 2>&1; echo $? > "$SB/x$i" ) & done
wait
started=$(cat "$SB"/x* | grep -c '^0$')
records=$(ls "$PI_CODING_AGENT_DIR/self-improve/runs"/*.json 2>/dev/null | wc -l)
[ "$started" = 3 ] && [ "$records" = 3 ] && ok "8 concurrent reflects stop at the cap of 3" || bad "8 concurrent reflects stop at the cap of 3 (started=$started records=$records)"
[ ! -d "$PI_CODING_AGENT_DIR/self-improve/lock" ] && ok "lock released" || bad "lock released"
unset PI_IMPROVE_MAX_REFLECTIONS_PER_DAY
new_env
"$P" reflect "$SB/none.json" >/dev/null 2>&1; echo '{}' > "$SB/d.json"
"$P" reflect "$SB/d.json" >/dev/null 2>&1
fails "same session reflected twice is refused" "$P" reflect "$SB/d.json"
check "--force repeats a reflection" "$P" reflect "$SB/d.json" --force

# sandboxed install is idempotent
SBH=$(mktemp -d)
# The installer targets Pi only when its agent dir exists or `pi` is on PATH.
mkdir -p "$SBH/.pi/agent"
first=$(HOME=$SBH PI_CODING_AGENT_DIR=$SBH/.pi/agent bash "$REPO/install.sh" 2>&1)
second=$(HOME=$SBH PI_CODING_AGENT_DIR=$SBH/.pi/agent bash "$REPO/install.sh" 2>&1)
for f in self-improve.json extensions/self-improve.ts bin/pi-improve prompts/reflect.md prompts/improve.md self-improve/repo; do
  [ -e "$SBH/.pi/agent/$f" ] && ok "install provides $f" || bad "install provides $f"
done
[ -x "$SBH/.local/bin/pi-improve" ] && ok "install links pi-improve into ~/.local/bin" || bad "install links pi-improve into ~/.local/bin"
main=$(dirname "$(cd "$REPO" && git rev-parse --path-format=absolute --git-common-dir)")
[ "$(cat "$SBH/.pi/agent/self-improve/repo" 2>/dev/null)" = "$main" ] && ok "install records the main checkout path" || bad "install records the main checkout path"
diff <(echo "$first" | grep -c "self-improve") <(echo "$second" | grep -c "self-improve") >/dev/null && ok "second install reports same self-improve lines" || bad "second install reports same self-improve lines"

echo; echo "$pass passed, $fail failed"
[ "$fail" = 0 ]
