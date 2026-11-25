import { randomUUID } from "node:crypto";
import { prStatePath, readPrStore, updatePrStore, type PrIdentity, type PrRun } from "../../../../lib/pr/store.ts";
import type { Clock } from "./runner.ts";
import { blocked } from "./runner.ts";
import type { Snapshot } from "./resolve.ts";
export function identityOf(pr: Snapshot): PrIdentity { const [owner, repo] = pr.repo.split("/"); if (!owner || !repo) throw new Error("invalid PR repository"); return { owner, repo, number: pr.number }; }
export function statePath(pr: Snapshot): string { return prStatePath(identityOf(pr)); }
export function getRun(pr: Snapshot, id: string): PrRun { const run = readPrStore(statePath(pr), identityOf(pr)).runs[id]; if (!run) return blocked("run state", `run ${id} was not found`, `an existing run for PR #${pr.number}`); return run; }
export function changeRun(pr: Snapshot, id: string, change: (run: PrRun) => void): PrRun {
  let updated: PrRun | undefined;
  updatePrStore(statePath(pr), identityOf(pr), (store) => { const run = store.runs[id]; if (!run) blocked("run state", `run ${id} was not found`, `an existing run for PR #${pr.number}`); change(run); updated = run; });
  if (!updated) throw new Error("run update did not persist"); return updated;
}
export function startRun(pr: Snapshot, action: string, mode: string | null, force: boolean, clock: Clock): PrRun {
  const run: PrRun = { id: randomUUID(), action, mode, force, startedAt: new Date(clock.now()).toISOString(), round: 0, limit: 5, drafted_for_changes: false, completion: null };
  updatePrStore(statePath(pr), identityOf(pr), (store) => { store.runs[run.id] = run; }); return run;
}
export function finishRun(pr: Snapshot, id: string, completion: string): PrRun {
  return updatePrStore(statePath(pr), identityOf(pr), (store) => {
    const run = store.runs[id]; if (!run) blocked("run id", id, "an active PR run");
    run.completion = completion; store.lastCompletion = completion;
  }).runs[id]!;
}
