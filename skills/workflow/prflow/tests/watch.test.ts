import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Classification } from "../scripts/core/types.ts";
import { decideWatch, fingerprint } from "../scripts/core/watch.ts";

/** Run (fingerprint, report, errors) steps through decideWatch, carrying state like the CLI does. */
function runs(steps: [string, string, string[]?][]) {
  let state: string | null = null;
  return steps.map(([fp, report, errors = []]) => {
    const d = decideWatch(state, fp, report, errors);
    if (d.save !== null) state = d.save;
    return { out: d.stdout, code: d.exitCode, state };
  });
}

const item = (over: Partial<Classification> = {}): Classification => ({
  key: "A/x#1",
  version: "c0ffee11-aaaaaaaa",
  repo: "A/x",
  number: 1,
  title: "t",
  url: "u",
  role: "author",
  account: "me",
  kind: "ci",
  triggers: [{ kind: "ci", detail: "lint-id" }],
  status: "merge=CLEAN review=NONE checks=failed(1)",
  nextAction: "n",
  owner: "agent",
  ...over,
});

describe("fingerprint", () => {
  it("ignores status text and order", () => {
    const a = item();
    const b = item({ key: "A/x#2" });
    assert.equal(fingerprint([a, b]), fingerprint([b, item({ status: "merge=UNSTABLE checks=pending" })]));
  });
  it("changes with kind, version, or trigger detail", () => {
    const base = fingerprint([item()]);
    assert.notEqual(fingerprint([item({ kind: "rerun" })]), base);
    assert.notEqual(fingerprint([item({ version: "c0ffee11-bbbbbbbb" })]), base);
    assert.notEqual(fingerprint([item({ triggers: [{ kind: "ci", detail: "e2e-id" }] })]), base);
  });
});

describe("decideWatch", () => {
  it("prints a report once, then stays silent until the fingerprint changes", () => {
    assert.deepEqual(runs([["a", "- a"], ["a", "- a (status moved)"], ["b", "- b"]]), [
      { out: "- a\n", code: 0, state: "a" },
      { out: "", code: 0, state: "a" },
      { out: "- b\n", code: 0, state: "b" },
    ]);
  });

  it("is silent when nothing is actionable, and re-announces after a clear", () => {
    assert.deepEqual(runs([["", ""], ["a", "- a"], ["", ""], ["a", "- a"]]).map((r) => r.out), ["", "- a\n", "", "- a\n"]);
  });

  it("saves an empty first run so later runs compare against it", () => {
    assert.equal(decideWatch(null, "", "", []).save, "");
    assert.equal(decideWatch("", "", "", []).save, null);
  });

  it("fails on scan errors without printing or saving", () => {
    assert.deepEqual(decideWatch("a", "", "", ["acct: gh search prs: rate limited"]), {
      stdout: "",
      save: null,
      stderr: "prflow scan incomplete:\nwarn: acct: gh search prs: rate limited\n",
      exitCode: 1,
    });
    assert.deepEqual(runs([["a", "- a"], ["", "", ["boom"]], ["a", "- a"]]).map((r) => r.out), ["- a\n", "", ""]);
  });
});
