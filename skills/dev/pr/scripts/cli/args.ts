import { AUTHORIZATION_TABLE, type Action, type Mode, type PrOwner } from "../core/authorize.ts";
import { blocked } from "../core/runner.ts";
export function option(args: string[], name: string): string | undefined { return parseArguments(args).flags.get(name)?.[0]; }
export function firstTarget(args: string[]): string | undefined { return parseArguments(args).positionals[0]; }
const parsedArguments = new WeakMap<string[], { positionals: string[]; flags: Map<string, string[]> }>();
const BOOLEAN_FLAGS = new Set(["--force", "--dry-run", "--preserve-evidence", "--no-required-checks", "--force-with-lease", "--drafted-for-changes"]);
const MULTI_FLAGS = new Set(["--required", "--finding", "--coverage", "--judged"]);
function parseFlag(args: string[], index: number, flags: Map<string, string[]>): number {
  const token = args[index]!; const values = flags.get(token) ?? []; flags.set(token, values);
  if (BOOLEAN_FLAGS.has(token)) { values.push("true"); return index; }
  if (MULTI_FLAGS.has(token)) return parseMultiValues(args, index, values);
  if (args[index + 1] && !args[index + 1]!.startsWith("--")) { values.push(args[index + 1]!); return index + 1; }
  return index;
}
function parseMultiValues(args: string[], index: number, values: string[]): number {
  while (args[index + 1] && !args[index + 1]!.startsWith("--")) values.push(args[++index]!);
  return index;
}
export function parseArguments(args: string[]): { positionals: string[]; flags: Map<string, string[]> } {
  const cached = parsedArguments.get(args); if (cached) return cached;
  const positionals: string[] = []; const flags = new Map<string, string[]>();
  for (let i = 0; i < args.length; i++) {
    if (args[i]!.startsWith("--")) i = parseFlag(args, i, flags);
    else positionals.push(args[i]!);
  }
  const result = { positionals, flags }; parsedArguments.set(args, result); return result;
}
export function positional(args: string[]): string | undefined {
  return parseArguments(args).positionals.find((value) => !["force", "inventory", "rerun-cancelled", "wait"].includes(value));
}
export function boolean(args: string[], name: string): boolean { return parseArguments(args).flags.has(name); }
export function list(args: string[], name: string): string[] { return parseArguments(args).flags.get(name) ?? []; }
export function modeValue(value: string | undefined): Mode { return value === "fix" || value === "comment" || value === "report" || value === "force" ? value : "none"; }
export function actionValue(value: string | undefined): Action { if (value && value in AUTHORIZATION_TABLE) return value as Action; return blocked("authorization action", value ?? "missing action", "a declared /pr action"); }
function localHeadUnavailable(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return /^blocked: git repository root/.test(error.message) || /^blocked: git API — .*(?:not a tree object|not a valid object name|bad object|could not get object info)/i.test(error.message);
}
export function ownerValue(value: string | undefined): PrOwner { return value === "other" || value === "fork" ? value : "own"; }
const JUDGMENT_NAMES = new Set(["description-staleness", "ui-evidence", "required-check-policy", "claims-verification-evidence"]);
export function judgmentInputs(args: string[]): Map<string, boolean> {
  const judged = new Map<string, boolean>();
  for (const value of list(args, "--judged")) {
    const [test, result, extra] = value.split("=");
    if (!test || !JUDGMENT_NAMES.has(test) || extra !== undefined || !["pass", "fail"].includes(result ?? "")) return blocked("judgment input", value, "--judged <description-staleness|ui-evidence|required-check-policy|claims-verification-evidence>=<pass|fail>");
    judged.set(test, result === "pass");
  }
  return judged;
}
