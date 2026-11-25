export interface LifecycleFacts {
  resolved?: boolean; exists?: boolean; unpushed?: boolean; dirtyValidated?: boolean;
  placeholder?: boolean; staleDescription?: boolean | null; uiChangedNoScreenshots?: boolean;
  behind?: boolean; conflicting?: boolean; stackOutOfOrder?: boolean; checksObserved?: boolean;
  requiredCheckFailedOrMissing?: boolean | null; packetComplete?: boolean; docsOnlyClean?: boolean;
  unresolvedThreads?: number; addressedReviewers?: boolean; claimsUnverified?: boolean;
  isDraft?: boolean; requiredCheckPolicyKnown?: boolean; judgment?: string;
}
export interface RunState { phase0Complete?: boolean; reviewReportComplete?: boolean; automerge?: boolean; owner?: "own" | "other" | "fork" }
export const PHASE_NAMES = ["Resolve", "Create", "Publish", "Describe", "Sync", "CI", "Review", "Threads", "Verify", "Ready", "Merge"] as const;
export type PhaseResult = { phase: number; name: string; reason: string } | { needs_judgment: string } | { phase: null; status: "complete" };
type PhaseTest = { unmet: boolean; reason: string };
function tests(f: LifecycleFacts, r: RunState): PhaseTest[] {
  return [
    { unmet: f.exists === false, reason: "no PR exists" },
    { unmet: f.unpushed === true || f.dirtyValidated === true, reason: "local changes need publishing" },
    { unmet: f.placeholder === true || f.staleDescription === true || f.uiChangedNoScreenshots === true, reason: "description or visual evidence needs updating" },
    { unmet: f.behind === true || f.conflicting === true || f.stackOutOfOrder === true, reason: "PR is behind, conflicting, or stack order is invalid" },
    { unmet: f.checksObserved === false || f.requiredCheckFailedOrMissing === true, reason: "required check outcome is missing or failed" },
    { unmet: f.packetComplete !== true && f.docsOnlyClean !== true, reason: "matching review packet or docs-only evidence is missing" },
    { unmet: (f.unresolvedThreads ?? 0) > 0 || f.addressedReviewers === true, reason: "feedback remains or reviewers need re-request" },
    { unmet: f.claimsUnverified === true, reason: "description claims need cited evidence" },
    { unmet: f.isDraft === true, reason: "PR remains draft after prior phases pass" },
    { unmet: r.automerge === true, reason: "automerge requested" },
  ];
}
function judgment(f: LifecycleFacts, phase: number): string | null {
  if (phase === 3) return descriptionJudgment(f);
  if (phase === 5) return checkJudgment(f);
  if (phase === 8 && f.claimsUnverified === undefined) return "claims-verification-evidence";
  return null;
}
function descriptionJudgment(f: LifecycleFacts): string | null {
  if (f.staleDescription === null || f.judgment) return f.judgment ?? "description-staleness";
  return f.uiChangedNoScreenshots === undefined ? "ui-evidence" : null;
}
function checkJudgment(f: LifecycleFacts): string | null {
  return f.requiredCheckPolicyKnown === false || f.requiredCheckFailedOrMissing === null ? "required-check-policy" : null;
}
export function nextPhase(facts: LifecycleFacts, runState: RunState = {}): PhaseResult {
  if (facts.resolved !== true && runState.phase0Complete !== true) return { phase: 0, name: PHASE_NAMES[0], reason: "resolve PR facts and prior state" };
  if (runState.owner === "other" || runState.owner === "fork") return runState.reviewReportComplete ? { phase: null, status: "complete" } : { phase: 6, name: "Review", reason: "run a report-only review for another author's PR" };
  const phaseTests = tests(facts, runState);
  for (let phase = 1; phase <= phaseTests.length; phase++) {
    const item = phaseTests[phase - 1]!;
    if (item.unmet) return { phase, name: PHASE_NAMES[phase]!, reason: item.reason };
    const needsJudgment = judgment(facts, phase);
    if (needsJudgment) return { needs_judgment: needsJudgment };
  }
  return { phase: null, status: "complete" };
}
