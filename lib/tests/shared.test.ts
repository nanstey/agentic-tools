import assert from "node:assert/strict";
import test from "node:test";
import { accountFor, isUnscoped, type Account } from "../accounts.ts";
import { configPaths, parseSharedConfig, REPO_ROOT } from "../config.ts";
import { defaultConfigDir, defaultStateDir, pidAlive, readOrNull, withoutTokens } from "../runtime.ts";

const account = (login: string, owners: string[] = [], repos: string[] = []): Account => ({ login, owners, repos });

test("account selection prioritizes exact repo, owner, then first unscoped", () => {
  const entries = [account("default"), account("owner", ["acme"]), account("repo", [], ["acme/project"]), account("other-default")];
  assert.equal(accountFor(entries, "ACME/PROJECT")?.login, "repo");
  assert.equal(accountFor(entries, "acme/other")?.login, "owner");
  assert.equal(accountFor(entries, "other/repo")?.login, "default");
  assert.equal(accountFor(entries, null)?.login, "default");
  assert.equal(isUnscoped(entries[0]!), true);
});

test("shared config paths use repo-local then agentic-tools XDG config", () => {
  assert.equal(defaultStateDir("unit", {}, "/home/test"), "/home/test/.local/state/unit");
  assert.equal(defaultConfigDir({}, "/home/test"), "/home/test/.config");
  assert.deepEqual(configPaths({}, "/home/test"), [`${REPO_ROOT}/config.json`, "/home/test/.config/agentic-tools/config.json"]);
  assert.deepEqual(configPaths({ XDG_CONFIG_HOME: "/x" }, "/home/test"), [`${REPO_ROOT}/config.json`, "/x/agentic-tools/config.json"]);
});

test("shared config accepts only shared sections and parses accounts", () => {
  assert.deepEqual(parseSharedConfig('{"accounts":[{"login":"a"}],"prflow":{},"repoSync":{}}', "c").accounts, [{ login: "a", owners: [], repos: [] }]);
  assert.throws(() => parseSharedConfig('{"extra":true}', "c"), /unknown key/);
});

test("shared runtime helpers preserve token removal and ENOENT behavior", () => {
  process.env.GH_TOKEN = "test-gh";
  process.env.GITHUB_TOKEN = "test-github";
  const env = withoutTokens();
  assert.equal(env.GH_TOKEN, undefined);
  assert.equal(env.GITHUB_TOKEN, undefined);
  delete process.env.GH_TOKEN;
  delete process.env.GITHUB_TOKEN;
  assert.equal(readOrNull("/definitely/missing/shared-runtime-file"), null);
  assert.equal(pidAlive(process.pid), true);
});
