import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { decideWatch } from "../scripts/core/watch.ts";

/** Run a sequence of (report, errors) through decideWatch, carrying state like the CLI does. */
function runs(steps: [string, string[]?][]) {
  let state: string | null = null;
  return steps.map(([report, errors = []]) => {
    const d = decideWatch(state, report, errors);
    if (d.save !== null) state = d.save;
    return { out: d.stdout, code: d.exitCode, state };
  });
}

describe("decideWatch", () => {
  it("prints a report once, then stays silent until it changes", () => {
    assert.deepEqual(runs([["- a"], ["- a"], ["- b"]]), [
      { out: "- a\n", code: 0, state: "- a" },
      { out: "", code: 0, state: "- a" },
      { out: "- b\n", code: 0, state: "- b" },
    ]);
  });

  it("is silent when nothing is actionable, and re-announces after a clear", () => {
    assert.deepEqual(runs([[""], ["- a"], [""], ["- a"]]).map((r) => r.out), ["", "- a\n", "", "- a\n"]);
  });

  it("saves an empty first run so later runs compare against it", () => {
    assert.equal(decideWatch(null, "", []).save, "");
    assert.equal(decideWatch("", "", []).save, null);
  });

  it("fails on scan errors without printing or saving", () => {
    const d = decideWatch("- a", "", ["acct: gh search prs: rate limited"]);
    assert.deepEqual(d, {
      stdout: "",
      save: null,
      stderr: "prflow scan incomplete:\nwarn: acct: gh search prs: rate limited\n",
      exitCode: 1,
    });
    assert.deepEqual(runs([["- a"], ["", ["boom"]], ["- a"]]).map((r) => r.out), ["- a\n", "", ""]);
  });
});
