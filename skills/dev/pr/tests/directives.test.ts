import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const skillDir = resolve(process.cwd());
const repoRoot = resolve(skillDir, "../../..");
type Rule = { name: string; owner: string; pattern: RegExp };
const rules: Rule[] = [
  { name: "follow repository instructions", owner: "SKILL.md", pattern: /Follow `CLAUDE\.md`\/`AGENTS\.md` on conflict/ },
  { name: "default tool is gh", owner: "SKILL.md", pattern: /default tool is `gh`/ },
  { name: "decision ladder", owner: "SKILL.md", pattern: /Choose explicit input, repository policy, documented default, then judgment/ },
  { name: "mutation guard", owner: "references/policy.md", pattern: /Before any mutation, run `pr guard` and require ownership, branch, current `HEAD`, and clean-tree checks to pass/ },
  { name: "draft before changes", owner: "references/policy.md", pattern: /Before the first edit, rebase, or push that changes an open non-draft PR, run `pr draft`/ },
  { name: "force definition", owner: "references/policy.md", pattern: /Try each soft gate once, then override it and record the gate and evidence/ },
  { name: "round limit", owner: "references/policy.md", pattern: /Each top-level invocation owns five rounds/ },
  { name: "blocked form", owner: "references/policy.md", pattern: /report `blocked: <gate> — <evidence>; unblock requires: <state>`/ },
  { name: "force-push policy", owner: "references/policy.md", pattern: /Use `--force-with-lease` only after verifying the expected remote head/ },
  { name: "required-check discovery", owner: "references/policy.md", pattern: /The agent discovers expected required jobs from trusted repository policy, branch protection\/rulesets, and workflows/ },
  { name: "disclosure scope", owner: "references/policy.md", pattern: /For comments, review bodies, inline comments, and thread replies posted as the user, begin exactly/ },
  { name: "squash subject", owner: "references/policy.md", pattern: /`pr merge` uses the PR title with ` \(#<number>\)` appended exactly once/ },
  { name: "thread snapshot query", owner: "scripts/threads.ts", pattern: /reviewThreads\(first:100,after:\$c\)\{nodes\{id isResolved isOutdated/ },
  { name: "run-state schema", owner: "references/state.md", pattern: /Runs are keyed by run id and contain `id`, `action`, nullable `mode`, `force`, `startedAt`, `round`, `limit`/ },
];

function filesUnder(path: string, extension: string): string[] {
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = join(path, entry.name);
    return entry.isDirectory() ? filesUnder(fullPath, extension) : entry.isFile() && entry.name.endsWith(extension) ? [fullPath] : [];
  });
}
function violations(root: string): string[] {
  const markdown = filesUnder(root, ".md");
  const scriptsDir = join(root, "scripts");
  const scripts = existsSync(scriptsDir) ? filesUnder(scriptsDir, ".ts") : [];
  return rules.flatMap((rule) => {
    const owner = join(root, rule.owner);
    const ownerText = (() => { try { return readFileSync(owner, "utf8"); } catch { return ""; } })();
    const ownerMatches = [...ownerText.matchAll(new RegExp(rule.pattern.source, rule.pattern.flags.includes("g") ? rule.pattern.flags : `${rule.pattern.flags}g`))].length;
    const wrongOwners = markdown.filter((path) => path !== owner && rule.pattern.test(readFileSync(path, "utf8")));
    if (rule.owner.startsWith("scripts/")) {
      const otherScripts = scripts.filter((path) => path !== owner && rule.pattern.test(readFileSync(path, "utf8")));
      wrongOwners.push(...otherScripts);
    }
    return ownerMatches === 1 && wrongOwners.length === 0 ? [] : [`${rule.name}: owner matches=${ownerMatches}, other files=${wrongOwners.map((path) => path.slice(root.length + 1)).join(",")}`];
  });
}

test("A3 each owned directive is defined once in its designated owner", () => {
  assert.deepEqual(violations(skillDir), []);
});

test("A3 directive ownership check detects violations in baseline acbe758", () => {
  const temp = mkdtempSync(join(tmpdir(), "pr-directives-baseline-"));
  try {
    const archive = execFileSync("git", ["archive", "--format=tar", "acbe758", "skills/dev/pr"], { cwd: repoRoot });
    execFileSync("tar", ["-xf", "-", "-C", temp], { input: archive });
    const baseline = join(temp, "skills/dev/pr");
    const failures = violations(baseline);
    assert.ok(failures.length > 0, "the ownership table unexpectedly passes on baseline acbe758");
    console.log(`A3 baseline acbe758 fails: ${failures.join("; ")}`);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});
