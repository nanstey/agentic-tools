import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { PR_QUERY } from "../pr/github.ts";

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(path) : entry.name.endsWith(".ts") ? [path] : [];
  });
}

function assertBalanced(query: string, label: string): void {
  const stack: string[] = [];
  const pairs: Record<string, string> = { "}": "{", ")": "(" };
  let quoted = false;
  for (const char of query) {
    if (char === '"') quoted = !quoted;
    if (quoted) continue;
    if (char === "{" || char === "(") stack.push(char);
    if (char === "}" || char === ")") assert.equal(stack.pop(), pairs[char], `${label}: unexpected ${char}`);
  }
  assert.equal(quoted, false, `${label}: unterminated string`);
  assert.deepEqual(stack, [], `${label}: unclosed delimiter`);
}

test("all PR GraphQL queries have balanced braces and parentheses", () => {
  assertBalanced(PR_QUERY, "PR_QUERY");
  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
  for (const file of [
    ...sourceFiles(join(repoRoot, "lib/pr")),
    ...sourceFiles(join(repoRoot, "skills/dev/pr/scripts")),
  ]) {
    const source = readFileSync(file, "utf8");
    const starts = [...source.matchAll(/(?:query=)?query\s*\(/g)];
    for (const match of starts) {
      const start = match.index!;
      const open = source.indexOf("{", start);
      assert.notEqual(open, -1, `${file}: query has no selection set`);
      let depth = 0;
      let end = open;
      for (; end < source.length; end++) {
        if (source[end] === "{") depth++;
        if (source[end] === "}" && --depth === 0) { end++; break; }
      }
      assertBalanced(source.slice(start, end), file);
    }
  }
});
