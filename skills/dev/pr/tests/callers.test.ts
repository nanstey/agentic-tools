import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

const repoRoot = resolve(process.cwd(), "../../..");
const skillDir = join(repoRoot, "skills/dev/pr");
function sourceFiles(path: string): string[] {
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
    const full = join(path, entry.name);
    return entry.isDirectory() ? sourceFiles(full) : entry.isFile() ? [full] : [];
  });
}
const actionWords = new Set<string>();
const skill = readFileSync(join(skillDir, "SKILL.md"), "utf8");
const argumentHint = skill.match(/^argument-hint:\s*"([^"]+)"/m)?.[1] ?? "";
for (const item of argumentHint.matchAll(/([a-z][a-z-]*)/g)) actionWords.add(item[1]!);
const actionTable = skill.match(/Mapping \(action → reference, purpose\):([\s\S]*?)(?=\n## |\nChoose explicit)/)?.[1] ?? "";
for (const item of actionTable.matchAll(/`([a-z][a-z-]*)`\s*→/g)) actionWords.add(item[1]!);

const scanRoots = ["skills", "agents", "harness"].map((path) => join(repoRoot, path));
const callers = scanRoots.flatMap(sourceFiles).filter((path) => !path.startsWith(skillDir + "/"));

test("A15 external /pr action invocations are declared by the skill", () => {
  const invalid: string[] = [];
  for (const path of callers) {
    const content = readFileSync(path, "utf8");
    for (const match of content.matchAll(/\/pr\s+([a-z][a-z-]*)/g)) {
      const word = match[1]!;
      const remainder = content.slice(match.index! + 3);
      if (word === "https" || /^\s+https?:\/\//i.test(remainder) || ["to", "without", "lifecycle"].includes(word)) continue;
      if (!actionWords.has(word)) invalid.push(`${path.slice(repoRoot.length + 1)}: /pr ${word}`);
    }
  }
  assert.deepEqual(invalid, []);
});

test("external PR-skill reference paths exist", () => {
  const missing: string[] = [];
  const references = /(?:`pr` skill's `references\/|pr\/references\/)([\w.-]+\.md)/g;
  for (const path of callers) {
    const content = readFileSync(path, "utf8");
    for (const match of content.matchAll(references)) {
      const name = match[1]!;
      if (!existsSync(join(skillDir, "references", name))) missing.push(`${path.slice(repoRoot.length + 1)}: ${name}`);
    }
  }
  assert.deepEqual(missing, []);
});
