export type Action = "lifecycle" | "info" | "create" | "push" | "description" | "screenshots" | "rebase" | "restack" | "split" | "stack" | "ci" | "review" | "comments" | "verification" | "ready" | "merge" | "automerge";
export type Mode = "none" | "fix" | "comment" | "report" | "force";
export type PrOwner = "own" | "other" | "fork";
type Permissions = Record<PrOwner, readonly string[]>;
type ModePermissions = Record<Mode, Permissions>;
const none: Permissions = { own: [], other: [], fork: [] };
const perms = (own: string[] = [], other: string[] = [], fork: string[] = []): Permissions => ({ own, other, fork });
const modes = (base: Permissions, fix = none, comment = none, report = none, force = none): ModePermissions => ({ none: base, fix, comment, report, force });
const lifecycleOwn = ["create-pr", "convert-draft", "convert-ready", "rerun-check", "rerequest", "attach", "edit-body", "push", "resolve-threads", "react"];
const reviewPublication = perms([], ["post-review", "react"], ["post-review", "react"]);
export const AUTHORIZATION_TABLE: Record<Action, ModePermissions> = {
  lifecycle: modes(perms(lifecycleOwn, ["react"], ["react"]), none, none, none, perms(lifecycleOwn, ["react"], ["react"])),
  info: modes(none),
  create: modes(perms(["create-pr", "edit-body"])),
  push: modes(perms(["push", "edit-body", "convert-draft"])),
  description: modes(perms(["edit-body", "convert-draft"])),
  screenshots: modes(perms(["edit-body", "attach", "convert-draft"])),
  rebase: modes(perms(["push", "convert-draft"])),
  restack: modes(perms(["push", "convert-draft"])),
  split: modes(perms(["push", "create-pr", "convert-draft"])),
  stack: modes(perms(["push", "edit-body", "create-pr", "convert-draft"])),
  ci: modes(perms(["push", "rerun-check", "convert-draft"])),
  review: modes(reviewPublication, perms(["push", "edit-body", "convert-draft"]), reviewPublication),
  comments: modes(perms(["push", "resolve-threads", "rerequest", "convert-draft"])),
  verification: modes(none, perms(["edit-body", "push", "convert-draft"]), perms([], ["post-comment"], ["post-comment"])),
  ready: modes(perms(["convert-ready"]), none, none, none, perms(["convert-ready"])),
  merge: modes(perms(["merge"]), none, none, none, perms(["merge"])),
  automerge: modes(perms([...lifecycleOwn, "merge"]), none, none, none, perms([...lifecycleOwn, "merge"])),
};
export function authorize(action: Action, mode: Mode, owner: PrOwner): string[] { return [...(AUTHORIZATION_TABLE[action]?.[mode]?.[owner] ?? [])]; }
export function renderAuthorizationTable(): string {
  const rows = ["| Action | Mode | Own | Other | Fork |", "| --- | --- | --- | --- | --- |"];
  for (const [action, byMode] of Object.entries(AUTHORIZATION_TABLE)) for (const [mode, owners] of Object.entries(byMode)) rows.push(`| ${action} | ${mode} | ${owners.own.join(", ") || "—"} | ${owners.other.join(", ") || "—"} | ${owners.fork.join(", ") || "—"} |`);
  return rows.join("\n");
}
