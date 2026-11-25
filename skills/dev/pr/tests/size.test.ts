import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

const skillDir = resolve(process.cwd());
function markdownFiles(path = skillDir): string[] {
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
    const full = join(path, entry.name);
    return entry.isDirectory() ? markdownFiles(full) : entry.isFile() && entry.name.endsWith(".md") ? [full] : [];
  });
}
const docs = markdownFiles();
const contents = docs.map((path) => readFileSync(path, "utf8"));

test("A2 skill documentation stays within the line and word budgets", () => {
  const lines = contents.reduce((total, content) => total + content.split("\n").length - (content.endsWith("\n") ? 1 : 0), 0);
  const words = contents.reduce((total, content) => total + (content.match(/\S+/g)?.length ?? 0), 0);
  assert.ok(lines <= 1290, `skill docs have ${lines} lines (maximum 1290)`);
  assert.ok(words <= 23673 * 0.7, `skill docs have ${words} words (maximum ${23673 * 0.7})`);
});

test("A16 legacy stack docs are absent and remaining stack docs total at most 120 lines", () => {
  assert.equal(existsSync(join(skillDir, "references/stack-cli.md")), false);
  assert.equal(existsSync(join(skillDir, "references/stack-rest-api.md")), false);
  const stackDocs = docs.filter((path) => /[/\\]references[/\\]stack[^/\\]*\.md$/.test(path));
  const lines = stackDocs.reduce((total, path) => total + readFileSync(path, "utf8").split("\n").length, 0);
  assert.ok(lines <= 120, `stack reference docs have ${lines} lines (maximum 120)`);
});

test("A4 PR skill docs do not mention the separate workflow", () => {
  const workflowName = ["pr", "flow"].join("");
  assert.doesNotMatch(contents.join("\n"), new RegExp(workflowName, "i"));
});

test("A13 PR skill docs route body edits through pr body or pr attach", () => {
  assert.doesNotMatch(contents.join("\n"), /gh pr edit|pulls\/(?:<[^>]+>|\d+)\s+-F\s+body(?:=|\b)|-F\s+body=/i);
});
