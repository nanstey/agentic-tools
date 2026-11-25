import { lstatSync, realpathSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { invoke, blocked, GITHUB_WRITE_ALLOWLIST, type CommandRunner } from "./runner.ts";
import { repositoryRoot, type Snapshot } from "./resolve.ts";

export async function updateBody(pr: Snapshot, file: string, preserveEvidence: boolean, runner: CommandRunner): Promise<{ updated: true; body: string }> {
  let body = await readFile(resolve(file), "utf8");
  if (preserveEvidence) body = await retainEvidence(pr, body, runner);
  await writeFile(resolve(file), body);
  try {
    await invoke(runner, "gh", ["pr", "edit", String(pr.number), "--repo", pr.repo, "--body-file", resolve(file)], { write: "edit-body" });
  } catch (error) {
    if (!String(error).includes("projectCards")) throw error;
    await invoke(runner, "gh", ["api", `repos/${pr.repo}/pulls/${pr.number}`, "-X", "PATCH", "-F", `body=@${resolve(file)}`], { write: "edit-body" });
  }
  const result = JSON.parse(await invoke(runner, "gh", ["pr", "view", String(pr.number), "--repo", pr.repo, "--json", "body"])) as { body?: unknown };
  if (result.body !== body) blocked("PR body verification", "re-read body differs from requested body", "body update confirmed");
  return { updated: true, body };
}
async function retainEvidence(pr: Snapshot, body: string, runner: CommandRunner): Promise<string> {
  const old = JSON.parse(await invoke(runner, "gh", ["pr", "view", String(pr.number), "--repo", pr.repo, "--json", "body"])) as { body?: string };
  const section = old.body?.split(/(?=^## )/m).find((part) => /^## Evidence\b/m.test(part));
  if (section && !/^## Evidence\b/m.test(body)) return `${body}${body.endsWith("\n") ? "\n" : "\n\n"}${section}`;
  return body;
}

export async function attach(pr: Snapshot, runId: string, args: string[], runner: CommandRunner): Promise<unknown> {
  if (!runId || valueAfter(args, "--run") !== runId) return blocked("run id", "attach requires --run <id>", "an active PR run id");
  const { bodyPath, capturePath, safeAssets } = await readAttachInputs(args);
  const pending = await attachmentPreflight(pr, safeAssets, runner);
  if (pending) return handoff(safeAssets, pending);
  const expectedCap = await currentCaptureDir(args, runner);
  if (expectedCap === null) return handoff(safeAssets, "visual-capture helper location is unavailable");
  if (expectedCap !== capturePath) return blocked("unsafe attachment path", `CAP changed to ${expectedCap}`, "the exact current capture directory");
  validateAssets(safeAssets, capturePath);
  const revalidated = await attachmentPreflight(pr, safeAssets, runner);
  if (revalidated) return handoff(safeAssets, revalidated);
  if (!GITHUB_WRITE_ALLOWLIST.has("attach")) return blocked("write allowlist", "attach is not allowlisted", "authorized attachment mutation");
  const editArgs = ["pr", "edit", String(pr.number), "--repo", pr.repo, "--body-file", bodyPath, ...safeAssets.flatMap((asset) => ["--attach", asset])];
  const result = await runner("gh", editArgs, process.env, repositoryRoot);
  if (!result.ok && /projectCards/i.test(`${result.stderr}\n${result.stdout}`)) return recoverProjectCards(pr, bodyPath, safeAssets, runner);
  return verifyAttachmentAttempt(pr, safeAssets, result, runner);
}
async function recoverProjectCards(pr: Snapshot, bodyPath: string, assets: string[], runner: CommandRunner): Promise<unknown> {
  try { await editBodyThroughRest(pr, bodyPath, runner); }
  catch (error) { return verifyRestFailure(pr, assets, error, runner); }
  const reread = await readCurrentBody(pr, runner);
  const missing = assets.filter((asset) => !reread.includes(asset));
  if (missing.length) return blocked("attachment reference verification", `missing references: ${missing.join(", ")}`, "every attachment reference present after REST fallback");
  return { pending: true, reason: "gh pr edit projectCards failure; REST updated body but cannot upload attachments", paths: assets, markdown: assets.map((asset) => `![Screenshot](${asset})`).join("\n") };
}
async function verifyRestFailure(pr: Snapshot, assets: string[], error: unknown, runner: CommandRunner): Promise<never> {
  const reread = await readCurrentBody(pr, runner);
  const remaining = assets.filter((asset) => reread.includes(asset));
  return blocked("body REST fallback", `${String(error)}; remaining attachment references: ${remaining.join(", ") || "none"}`, "successful REST body update and verified re-read");
}
async function readAttachInputs(args: string[]): Promise<{ bodyPath: string; capturePath: string; safeAssets: string[] }> {
  const file = valueAfter(args, "--file"); const cap = valueAfter(args, "--cap");
  if (!file || !cap) return blocked("attach arguments", "--file and --cap are required", "validated screenshot body and capture directory");
  const bodyPath = resolve(file); const capturePath = resolve(cap); const body = await readFile(bodyPath, "utf8");
  const assets = localAssetReferences(body);
  if (new Set(assets).size !== assets.length || assets.length > 50) return blocked("attachment count", "duplicate or more than 50 local references", "unique inventory of at most 50 assets");
  return { bodyPath, capturePath, safeAssets: validateAssets(assets, capturePath) };
}
function localAssetReferences(body: string): string[] {
  return [...body.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)].map((match) => match[1]!).filter((path) => path.startsWith("/") && /\.(?:png|jpe?g|gif|webp|svg|mp4|mov|webm)$/i.test(path));
}
function handoff(paths: string[], reason: string): unknown {
  return { pending: true, reason, paths, markdown: paths.map((asset) => `![Screenshot](${asset})`).join("\n") };
}
async function currentCaptureDir(args: string[], runner: CommandRunner): Promise<string | null> {
  const skillDir = valueAfter(args, "--capture-skill-dir") ?? process.env.VISUAL_CAPTURE_SKILL_DIR;
  if (!skillDir) return null;
  return invoke(runner, "bash", [resolve(skillDir, "scripts/capture-dir.sh")], { cwd: repositoryRoot });
}
async function editBodyThroughRest(pr: Snapshot, bodyPath: string, runner: CommandRunner): Promise<void> {
  await invoke(runner, "gh", ["api", `repos/${pr.repo}/pulls/${pr.number}`, "-X", "PATCH", "-F", `body=@${bodyPath}`], { write: "edit-body" });
}
async function readCurrentBody(pr: Snapshot, runner: CommandRunner): Promise<string> {
  const reread = JSON.parse(await invoke(runner, "gh", ["pr", "view", String(pr.number), "--repo", pr.repo, "--json", "body"])) as { body?: unknown };
  if (typeof reread.body !== "string") return blocked("body verification", "re-read returned no body", "a readable PR body");
  return reread.body;
}
async function verifyAttachmentAttempt(pr: Snapshot, assets: string[], result: { ok: boolean; stdout: string; stderr: string }, runner: CommandRunner): Promise<unknown> {
  const reread = await readCurrentBody(pr, runner);
  const remaining = assets.filter((asset) => reread.includes(asset));
  if (!result.ok) return blocked("native attachment partial result", `exit failure; remaining local paths: ${remaining.join(", ") || "none"}; ${result.stderr || result.stdout}`, "inspect uploaded attachment state; do not retry blindly");
  if (remaining.length) return blocked("attachment verification", `local paths remain: ${remaining.join(", ")}`, "every asset rewritten to a hosted URL");
  return { attached: assets, body: reread };
}
function valueAfter(args: string[], flag: string): string | undefined { const index = args.indexOf(flag); return index < 0 ? undefined : args[index + 1]; }
function validateAssets(assets: string[], cap: string): string[] {
  const root = realpathSync(repositoryRoot); const canonicalCap = realpathSync(cap);
  validateCaptureDirectories(cap);
  for (const asset of assets) validateOneAsset(asset, cap, canonicalCap, root);
  return assets;
}
function validateCaptureDirectories(cap: string): void {
  for (const directory of [resolve(cap, "../.."), resolve(cap, ".."), cap]) {
    const stat = lstatSync(directory);
    if (!stat.isDirectory() || stat.isSymbolicLink() || stat.uid !== process.getuid?.() || (stat.mode & 0o777) !== 0o700) blocked("unsafe attachment path", `${directory} is not private`, "capture directory owned by the current user with mode 0700");
  }
}
function validateOneAsset(asset: string, cap: string, canonicalCap: string, root: string): void {
  const parts = asset.slice(cap.length + 1).split("/");
  if (!/^[A-Za-z0-9_./-]+$/.test(asset) || !asset.startsWith(`${cap}/`) || parts.some((part) => !part || part === "." || part === "..")) blocked("unsafe attachment path", asset, "literal safe path below CAP");
  let path = cap;
  for (const part of parts) { path = resolve(path, part); if (lstatSync(path).isSymbolicLink()) blocked("unsafe attachment path", asset, "non-symlink capture paths"); }
  const stat = lstatSync(asset); const real = realpathSync(asset);
  if (!stat.isFile() || !real.startsWith(`${canonicalCap}/`) || real.startsWith(`${root}/`)) blocked("unsafe attachment path", asset, "regular off-tree file below CAP");
}
async function attachmentPreflight(pr: Snapshot, assets: string[], runner: CommandRunner): Promise<string | null> {
  const accessFailure = await checkRepositoryAccess(pr, runner);
  if (accessFailure) return accessFailure;
  for (const asset of assets) {
    const failure = await checkAssetUploadability(asset, runner);
    if (failure) return failure;
  }
  return null;
}
async function checkRepositoryAccess(pr: Snapshot, runner: CommandRunner): Promise<string | null> {
  const version = await runner("gh", ["--version"], process.env);
  if (!version.ok || !isGhVersionSupported(version.stdout)) return "gh >= 2.99.0 required";
  const auth = await runner("gh", ["auth", "status"], process.env);
  if (!auth.ok) return "GitHub authentication unavailable";
  const repo = await runner("gh", ["repo", "view", "--repo", pr.repo, "--json", "viewerPermission,url"], process.env);
  if (!repo.ok) return "repository access check failed";
  return repositoryAccessFailure(repo.stdout);
}
function repositoryAccessFailure(output: string): string | null {
  let metadata: { viewerPermission?: string; url?: string };
  try { metadata = JSON.parse(output) as { viewerPermission?: string; url?: string }; }
  catch { return "repository access response is invalid"; }
  if (!["ADMIN", "MAINTAIN", "WRITE"].includes(metadata.viewerPermission ?? "")) return "repository write access required";
  if (!metadata.url?.startsWith("https://github.com/")) return "only github.com is supported";
  return null;
}
async function checkAssetUploadability(asset: string, runner: CommandRunner): Promise<string | null> {
  const file = await runner("file", ["--brief", "--mime-type", asset], process.env);
  const size = await runner("wc", ["-c", asset], process.env);
  const bytes = Number(size.stdout.trim().split(/\s+/)[0]);
  if (!file.ok || !size.ok || !supportedMime(file.stdout.trim()) || !Number.isFinite(bytes) || bytes > 10 * 1024 * 1024) return `${asset} is unsupported or exceeds 10 MiB`;
  return await checkUntracked(asset, runner);
}
function supportedMime(mime: string): boolean {
  return ["image/png", "image/jpeg", "image/gif", "image/webp", "image/svg+xml", "video/mp4", "video/quicktime", "video/webm"].includes(mime);
}
async function checkUntracked(asset: string, runner: CommandRunner): Promise<string | null> {
  const tracked = await runner("git", ["ls-files", "--error-unmatch", "--", asset], process.env, repositoryRoot);
  if (tracked.ok) return blocked("unsafe attachment path", `${asset} is tracked`, "untracked capture artifact");
  return /pathspec|did not match/i.test(tracked.stderr) ? null : "git tracking state is unavailable";
}
function isGhVersionSupported(output: string): boolean {
  const match = /gh version (\d+)\.(\d+)/.exec(output); if (!match) return false;
  return Number(match[1]) > 2 || (Number(match[1]) === 2 && Number(match[2]) >= 99);
}
