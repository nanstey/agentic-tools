import test, { after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { docsOnly } from "../scripts/docs-only.ts";
import type { CommandRunner } from "../scripts/runner.ts";

const stateHome = mkdtempSync(join(tmpdir(), "pr-docs-only-state-"));
const oldStateHome = process.env.XDG_STATE_HOME;
process.env.XDG_STATE_HOME = stateHome;
after(() => { if (oldStateHome === undefined) delete process.env.XDG_STATE_HOME; else process.env.XDG_STATE_HOME = oldStateHome; rmSync(stateHome, { recursive: true, force: true }); });
const md = "notes.md";
function fixture(before: string, after: string, opts: { path?: string; status?: string; oldMode?: string; newMode?: string; fail?: boolean } = {}): CommandRunner {
  const path = opts.path ?? md;
  return async (_command, args) => {
    if (args[0] === "diff" && args.includes("--raw")) {
      if (opts.fail) return { ok: false, stdout: "", stderr: "git API unavailable" };
      const status = opts.status ?? "M";
      return { ok: true, stdout: `:${opts.oldMode ?? "100644"} ${opts.newMode ?? "100644"} abc def ${status}\0${path}\0`, stderr: "" };
    }
    if (args[0] === "cat-file") return { ok: true, stdout: args.at(-1) === "abc" ? before : after, stderr: "" };
    throw new Error(`unexpected command: ${args.join(" ")}`);
  };
}
async function check(runner: CommandRunner) { return docsOnly("base", "head", runner); }

test("docs-only accepts regular same-path Markdown with punctuation and formatting-only prose changes", async () => {
  const result = await check(fixture("A short note.\n", "A short note!\n"));
  assert.equal(result.clean, true);
  assert.deepEqual(result.files[0], { path: md, class: "prose", ok: true, reason: "only permitted documentation changes" });
});
test("docs-only treats added paths as uncertain", async () => assert.equal((await check(fixture("", "Note", { status: "A" }))).files[0]?.class, "uncertain"));
test("docs-only treats deleted paths as uncertain", async () => assert.equal((await check(fixture("Note", "", { status: "D" }))).clean, false));
test("docs-only treats renames as uncertain", async () => assert.equal((await check(fixture("Note", "Note", { status: "R100" }))).clean, false));
test("docs-only treats mode changes as uncertain", async () => assert.equal((await check(fixture("Note", "Note", { newMode: "100755" }))).clean, false));
test("docs-only treats symlinks as uncertain", async () => assert.equal((await check(fixture("Note", "Note", { oldMode: "120000", newMode: "120000" }))).clean, false));
test("docs-only treats non-Markdown changes as uncertain", async () => assert.equal((await check(fixture("Note", "Note", { path: "notes.txt" }))).clean, false));
test("docs-only instruction surfaces allow unchanged prose only", async () => assert.equal((await check(fixture("Run safely.\n", "Run this safely.\n", { path: "skills/example/SKILL.md" }))).clean, false));
test("docs-only treats the invoking skill directory as a policy surface", async () => {
  const result = await docsOnly("base", "head", fixture("Run safely.\n", "Run this safely.\n", { path: "custom/skill/SKILL.md" }), "custom/skill");
  assert.equal(result.clean, false);
  assert.equal(result.files[0]?.class, "instruction");
});
test("docs-only allows instruction-surface link destination changes only when target is unchanged", async () => assert.equal((await check(fixture("See [guide](../guide.md#start).\n", "See [guide](.././guide.md#start).\n", { path: "agents/reviewer.md" }))).clean, true));
test("docs-only rejects instruction-surface prose changes even if punctuation-only", async () => assert.equal((await check(fixture("Run now.\n", "Run now!\n", { path: "AGENTS.md" }))).clean, false));
test("docs-only rejects raw HTML and comments", async () => {
  assert.equal((await check(fixture("A note.\n", "A <b>note</b>.\n"))).clean, false);
  assert.equal((await check(fixture("A note.\n", "A note. <!-- hidden -->\n"))).clean, false);
});
test("docs-only permits one spelling correction and rejects prose edits", async () => {
  assert.equal((await check(fixture("A separate note.\n", "A seperate note.\n"))).clean, true);
  assert.equal((await check(fixture("A separate note.\n", "A different note.\n"))).clean, false);
});
test("docs-only rejects changed frontmatter and fenced code", async () => {
  assert.equal((await check(fixture("---\ntitle: Note\n---\nBody\n", "---\ntitle: Other\n---\nBody\n"))).clean, false);
  assert.equal((await check(fixture("```sh\necho hi\n```\n", "```sh\necho bye\n```\n"))).clean, false);
});
test("docs-only rejects images, reference links, and external-link changes", async () => {
  assert.equal((await check(fixture("![image](pic.png)\n", "![image](other.png)\n"))).clean, false);
  assert.equal((await check(fixture("[guide]: guide.md\n", "[guide]: other.md\n"))).clean, false);
  assert.equal((await check(fixture("See [site](https://a.example).\n", "See [site](https://b.example).\n"))).clean, false);
});
test("docs-only refuses prohibited policy and instruction-loaded surfaces", async () => {
  for (const path of ["skills/dev/pr/references/gates.md", ".github/workflows/check.md", "install/README.md"]) assert.equal((await check(fixture("A note.\n", "A note!\n", { path }))).clean, false);
});
test("docs-only reports empty diff as uncertain", async () => {
  const runner: CommandRunner = async () => ({ ok: true, stdout: "", stderr: "" });
  assert.deepEqual(await check(runner), { clean: false, files: [{ path: "", class: "uncertain", ok: false, reason: "diff is empty" }] });
});
test("docs-only blocks when git diff API fails", async () => {
  await assert.rejects(() => check(fixture("", "", { fail: true })), /blocked: git API/);
});
