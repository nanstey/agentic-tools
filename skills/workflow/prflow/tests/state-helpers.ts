/** Shared fakes for state, dispatch, and tick tests. */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after } from "node:test";
import { assertReadOnly, assertRerun, rerunArgs } from "../scripts/adapters/gh.ts";
import { archiveArgs, assertArchive } from "../scripts/adapters/orca.ts";
import { DEFAULT_ACTIONS, DEFAULT_LIMIT, DEFAULT_RAILS, type Config, type Rails } from "../scripts/core/config.ts";
import type { CmdResult } from "../scripts/scan.ts";
import { Store } from "../scripts/store.ts";
import type { TickDeps } from "../scripts/tick.ts";
import { ME } from "./fixtures.ts";

const dirs: string[] = [];
after(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
});

/** A fresh store in a temp directory, removed after the test file. */
export function tempStore(): Store {
  const dir = mkdtempSync(join(tmpdir(), "prflow-test-"));
  dirs.push(dir);
  return Store.open(dir);
}

export const T0 = Date.parse("2026-01-12T17:00:00Z");
export const MIN = 60_000;

export const cfg = (rails: Partial<Rails> = {}, worktrees = false): Config => ({
  accounts: [{ login: ME, owners: ["Acme"], repos: [] }],
  limit: DEFAULT_LIMIT,
  worktrees,
  rails: { ...DEFAULT_RAILS, ...rails },
  actions: { ...DEFAULT_ACTIONS },
});

export const okJson = (v: unknown): CmdResult => ({ ok: true, stdout: JSON.stringify(v), stderr: "" });
export const fail = (stderr: string): CmdResult => ({ ok: false, stdout: "", stderr });

export interface World {
  clock: number;
  /** Own PRs: `Acme/repo#n` -> PR_QUERY response. */
  prs: Record<string, unknown>;
  /** Search fails with this message when set. */
  searchError?: string;
  /** Search never resolves (to trip the poll budget). */
  hang?: boolean;
  worktrees: unknown[];
  /** `gh pr list/view` responses by `-R repo` and head/number. */
  refs: Record<string, CmdResult>;
  dirty: Record<string, number | null>;
  /** Unpushed commit counts by worktree path (default 0). */
  unpushed: Record<string, number | null>;
  /** `gh run view` status by run id (default "completed"); `null` fails the call. */
  runs: Record<string, string | null>;
  /** Failing rerun or archive results by run id or path. */
  rerunFails: Record<string, string>;
  archiveFails: Record<string, string>;
  /** Side effects performed, e.g. `rerun Acme/x 42`, `archive /w/a`. */
  effects: string[];
  calls: string[][];
}

export function world(over: Partial<World> = {}): World {
  return { clock: T0, prs: {}, worktrees: [], refs: {}, dirty: {}, unpushed: {}, runs: {}, rerunFails: {}, archiveFails: {}, effects: [], calls: [], ...over };
}

export function fakeTickDeps(w: World): TickDeps {
  return {
    now: () => w.clock,
    async gh(_login, args) {
      w.calls.push(["gh", ...args]);
      if (args[0] === "search") {
        if (w.hang) return new Promise<CmdResult>(() => {});
        if (w.searchError) return fail(w.searchError);
        if (args.includes("--review-requested")) return okJson([]);
        return okJson(
          Object.keys(w.prs).map((k) => {
            const [repo, n] = k.split("#");
            return { number: Number(n), repository: { nameWithOwner: repo } };
          }),
        );
      }
      if (args[0] === "api") {
        const v = (k: string) => args.find((a) => a.startsWith(`${k}=`))?.slice(k.length + 1);
        const pr = w.prs[`${v("o")}/${v("r")}#${v("n")}`];
        return pr ? okJson(pr) : fail("Could not resolve");
      }
      if (args[0] === "pr") return w.refs[args.join(" ")] ?? okJson([]);
      if (args[0] === "run" && args[1] === "view") {
        assertReadOnly(args);
        const st = w.runs[args[2] ?? ""];
        return st === null ? fail("run not found") : okJson({ status: st ?? "completed", conclusion: "cancelled" });
      }
      return fail(`unexpected gh ${args.join(" ")}`);
    },
    async orcaWorktrees() {
      return JSON.stringify({ result: { worktrees: w.worktrees } });
    },
    async gitDirty(path) {
      return path in w.dirty ? (w.dirty[path] ?? null) : 0;
    },
    async gitUnpushed(path) {
      return path in w.unpushed ? (w.unpushed[path] ?? null) : 0;
    },
    async rerunFailed(_login, repo, runId) {
      assertRerun(rerunArgs(repo, runId));
      w.effects.push(`rerun ${repo} ${runId}`);
      const err = w.rerunFails[runId];
      return err ? fail(err) : { ok: true, stdout: "", stderr: "" };
    },
    async archiveWorktree(path) {
      assertArchive(archiveArgs(path));
      w.effects.push(`archive ${path}`);
      const err = w.archiveFails[path];
      return err ? fail(err) : okJson({ result: { removed: true } });
    },
  };
}
