/**
 * Differential parity with the legacy precheck. `tests/legacy/precheck.sh` is the
 * legacy script with its login and state directory replaced by `__USER__` and
 * `__STATE__`; the test fills them in. It runs with HOME set to a temp dir and a
 * fake `gh` on PATH that serves the shared fixtures, and its output must equal
 * prflow's legacy-format lines.
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { legacyLine, legacyTriggers } from "../scripts/core/classify.ts";
import { parsePr } from "../scripts/adapters/gh.ts";
import { alice, AFTER, CASES, comment, ME, me, prResponse, review, run } from "./fixtures.ts";

const STATE = "precheck";
const LEGACY_SOURCE = readFileSync(join(import.meta.dirname, "legacy", "precheck.sh"), "utf8")
  .replaceAll("__USER__", ME)
  .replaceAll("__STATE__", STATE);
const hasTools = ["bash", "python3"].every((t) => spawnSync(t, ["--version"]).status === 0);

const FAKE_GH = `#!/usr/bin/env bash
# Serves fixtures for the legacy precheck. Any write command fails the test.
case "$1 $2" in
  "auth token") echo fake-token ;;
  "search prs") cat "$FIX/search.json" ;;
  "api graphql")
    for a in "$@"; do case "$a" in o=*) o=\${a#o=} ;; r=*) r=\${a#r=} ;; n=*) n=\${a#n=} ;; esac; done
    f="$FIX/\${o}__\${r}__\${n}.json"; [ -f "$f" ] && cat "$f" || { echo "not found" >&2; exit 1; } ;;
  *) echo "fake gh: unexpected $*" >&2; exit 99 ;;
esac
`;

interface Pr {
  repo: string;
  number: number;
  /** Raw response, or `null` to make the fake gh fail. */
  body: unknown | null;
}

function runLegacy(prs: Pr[], dispatched = ""): { code: number | null; out: string; err: string } {
  const root = mkdtempSync(join(tmpdir(), "prflow-parity-"));
  const fix = join(root, "fix");
  const bin = join(root, "bin");
  const state = join(root, ".local", "state", STATE);
  for (const d of [fix, bin, state]) mkdirSync(d, { recursive: true });
  writeFileSync(join(state, "dispatched.txt"), dispatched);
  writeFileSync(join(bin, "gh"), FAKE_GH);
  chmodSync(join(bin, "gh"), 0o755);
  writeFileSync(
    join(fix, "search.json"),
    JSON.stringify(prs.map((p) => ({ number: p.number, repository: { nameWithOwner: p.repo } }))),
  );
  for (const p of prs) {
    if (p.body === null) continue;
    const [o, r] = p.repo.split("/");
    writeFileSync(join(fix, `${o}__${r}__${p.number}.json`), JSON.stringify(p.body));
  }
  const script = join(root, "precheck.sh");
  writeFileSync(script, LEGACY_SOURCE);
  const r = spawnSync("bash", [script], {
    env: { PATH: `${bin}:${process.env.PATH}`, HOME: root, FIX: fix },
    encoding: "utf8",
  });
  return { code: r.status, out: r.stdout, err: r.stderr };
}

function prflowLines(prs: Pr[]): string[] {
  return prs.flatMap((p) => {
    if (p.body === null) return [];
    const s = parsePr(JSON.stringify(p.body), p.repo, p.number, "author", ME);
    return s ? legacyTriggers(s, ME).map((t) => legacyLine(s, t)) : [];
  });
}

const split = (out: string) => out.split("\n").filter(Boolean);

describe("legacy precheck parity", { skip: !hasTools && "bash/python3 missing" }, () => {
  it("matches every fixture case in one legacy run", () => {
    const prs: Pr[] = CASES.map((c, i) => ({ repo: "Acme/widgets", number: i + 1, body: prResponse(c.pr) }));
    const legacy = runLegacy(prs);
    assert.equal(legacy.err, "");
    const want = prflowLines(prs);
    assert.ok(want.length > 20);
    assert.deepEqual(split(legacy.out), want);
    assert.equal(legacy.code, 0);
  });

  it("matches per case, including exit status", () => {
    for (const [i, c] of CASES.entries()) {
      const prs = [{ repo: "Acme/widgets", number: i + 1, body: prResponse(c.pr) }];
      const legacy = runLegacy(prs);
      const want = prflowLines(prs);
      assert.deepEqual(split(legacy.out), want, c.name);
      assert.equal(legacy.code, want.length ? 0 : 1, c.name);
    }
  });

  it("skips PRs whose GraphQL call fails, like legacy", () => {
    const prs: Pr[] = [
      { repo: "Acme/a", number: 1, body: null },
      { repo: "Acme/b", number: 2, body: prResponse({}) },
    ];
    assert.deepEqual(split(runLegacy(prs).out), prflowLines(prs));
    assert.deepEqual(prflowLines(prs), ["Acme/b#2@c0ffee11:merge"]);
  });

  it("legacy suppresses dispatched lines; prflow phase 1 has no ledger and reports them", () => {
    const prs: Pr[] = [{ repo: "Acme/widgets", number: 1, body: prResponse({}) }];
    const legacy = runLegacy(prs, "Acme/widgets#1@c0ffee11:merge\n");
    assert.equal(legacy.out.trim(), "");
    assert.equal(legacy.code, 1);
    assert.deepEqual(prflowLines(prs), ["Acme/widgets#1@c0ffee11:merge"]);
  });

  it("known divergence: legacy reruns a failed check by name; prflow has no repo-specific check names", () => {
    // The legacy script hardcodes one repo's checker job as rerun-only. prflow treats
    // every failed check the same and leaves such caveats to each repo's docs.
    const prs: Pr[] = [{ repo: "Acme/widgets", number: 1, body: prResponse({ checks: [run("required-action-checker", "COMPLETED", "FAILURE")] }) }];
    assert.deepEqual(split(runLegacy(prs).out), ["Acme/widgets#1@c0ffee11:rerun:required-action-checker-id"]);
    assert.deepEqual(prflowLines(prs), ["Acme/widgets#1@c0ffee11:ci:required-action-checker-id"]);
  });

  it("known divergence: an own pending review crashes legacy, prflow ignores it", () => {
    const prs: Pr[] = [
      {
        repo: "Acme/widgets",
        number: 1,
        body: prResponse({ decision: null, comments: [comment(alice, AFTER)], reviews: [review(me, "PENDING", null)] }),
      },
    ];
    const legacy = runLegacy(prs);
    assert.notEqual(legacy.code, 0);
    assert.match(legacy.err, /TypeError/);
    assert.deepEqual(prflowLines(prs), [`Acme/widgets#1@c0ffee11:comments:${AFTER}`]);
  });
});
