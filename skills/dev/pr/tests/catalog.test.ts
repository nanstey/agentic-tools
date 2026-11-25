import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const skillDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(skillDir, "../../..");

test("SKILL.md description matches the README catalog row", () => {
  const skill = readFileSync(resolve(skillDir, "SKILL.md"), "utf8");
  const description = /^description: "?(.+?)"?$/m.exec(skill)?.[1];
  assert.ok(description, "SKILL.md has a description");
  assert.match(description, /Use when /);
  const readme = readFileSync(resolve(repoRoot, "README.md"), "utf8");
  const row = readme.split("\n").find((line) => line.includes("(skills/dev/pr/SKILL.md)"));
  assert.ok(row, "README has a pr row");
  assert.ok(row.includes(`| ${description} |`), "README row uses the frontmatter description");
});
