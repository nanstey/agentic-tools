import { posix, relative, resolve, sep } from "node:path";
import { invoke, type CommandRunner } from "./runner.ts";
import { targetRoot } from "./resolve.ts";

type RawChange = { oldMode: string; newMode: string; oldOid: string; newOid: string; status: string; paths: string[] };
type FileResult = { path: string; class: "prose" | "instruction" | "uncertain"; ok: boolean; reason: string };
const ZERO = "0000000000000000000000000000000000000000";

function parseRawDiff(raw: string): RawChange[] {
  const fields = raw.split("\0"); const changes: RawChange[] = [];
  for (let i = 0; i < fields.length;) {
    const header = fields[i++]!; if (!header) continue;
    const match = /^:(\d{6}) (\d{6}) ([0-9a-f]+) ([0-9a-f]+) ([A-Z])\d*$/.exec(header);
    if (!match) throw new Error(`invalid raw diff record: ${header}`);
    const paths = [fields[i++] ?? ""];
    if (match[5] === "R" || match[5] === "C") paths.push(fields[i++] ?? "");
    changes.push({ oldMode: match[1]!, newMode: match[2]!, oldOid: match[3]!, newOid: match[4]!, status: match[5]!, paths });
  }
  return changes;
}
function instructionSurface(path: string, skillDir: string | undefined, root: string): boolean {
  const skillPath = skillDir ? `${relative(root, resolve(root, skillDir)).split(sep).join("/").replace(/\/$/, "")}/` : "";
  return /(^|\/)(AGENTS|CLAUDE|SKILL)\.md$/i.test(path) || path.startsWith("skills/") || path.startsWith("agents/") || path.startsWith("harness/") || [".agents/", ".claude/", ".cursor/", ".codex/", ".pi/"].some((surface) => path.startsWith(surface)) || Boolean(skillPath && path.startsWith(skillPath));
}
function prohibitedSurface(path: string): boolean {
  return path.startsWith(".github/") || path.startsWith("install/") || /(^|\/)(GEMINI\.md|CODEOWNERS|OWNERS|\.gitlab-ci\.yml)$/i.test(path);
}
function classify(path: string, skillDir: string | undefined, root: string): FileResult["class"] { return instructionSurface(path, skillDir, root) || prohibitedSurface(path) ? "instruction" : "prose"; }
function pathReason(change: RawChange, path: string): string | undefined {
  if (change.status !== "M" || change.paths.length !== 1) return "added, deleted, renamed, or copied path is uncertain";
  if (!(change.oldMode === "100644" || change.oldMode === "100755") || change.newMode !== change.oldMode) return "mode change or non-regular file is uncertain";
  if (!path.endsWith(".md")) return "non-Markdown change is uncertain";
  if (prohibitedSurface(path)) return "policy surface is never docs-only";
  return undefined;
}
function stripProtectedSections(text: string): { rest: string; protected: string[] } | undefined {
  const frontmatter = extractFrontmatter(text.split("\n"));
  if (!frontmatter) return undefined;
  const fences = extractFences(frontmatter.lines);
  if (!fences) return undefined;
  return { rest: fences.lines.join("\n"), protected: [...frontmatter.protected, ...fences.protected] };
}
function extractFrontmatter(lines: string[]): { lines: string[]; protected: string[] } | undefined {
  if (lines[0] !== "---") return { lines, protected: [] };
  const end = lines.indexOf("---", 1);
  return end < 0 ? undefined : { lines: lines.slice(end + 1), protected: lines.slice(0, end + 1) };
}
function extractFences(lines: string[]): { lines: string[]; protected: string[] } | undefined {
  const rest: string[] = []; const protectedParts: string[] = []; let fence: string | undefined;
  for (const line of lines) {
    const marker = line.match(/^\s*(```+|~~~+)/)?.[1];
    if (fence || marker) { protectedParts.push(line); fence = updateFence(fence, marker); }
    else rest.push(line);
  }
  return fence ? undefined : { lines: rest, protected: protectedParts };
}
function updateFence(current: string | undefined, marker: string | undefined): string | undefined {
  if (!current) return marker;
  return marker && marker[0] === current[0] && marker.length >= current.length ? undefined : current;
}
function relativeTarget(file: string, destination: string): string | undefined {
  if (!destination || /^(?:[a-z][a-z\d+.-]*:|\/|\\|#)/i.test(destination) || destination.startsWith("//")) return undefined;
  const [target, ...fragment] = destination.split("#");
  const resolved = posix.normalize(posix.join(posix.dirname(file), target || posix.basename(file)));
  if (resolved === ".." || resolved.startsWith("../")) return undefined;
  return `${resolved}#${fragment.join("#")}`;
}
function links(text: string, file: string): { normalized: string; keys: string[] } | undefined {
  const keys: string[] = [];
  const normalized = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (whole, label: string, raw: string) => {
    const match = /^(\S+?)(?:\s+["'][^"']*["'])?$/.exec(raw.trim());
    if (!match) return whole;
    const target = relativeTarget(file, match[1]!);
    if (!target) return whole;
    keys.push(`${label}\0${target}`);
    return `[${label}](RELATIVE_LINK_${keys.length})`;
  });
  return { normalized, keys };
}
function wordTokens(text: string): string[] { return text.toLocaleLowerCase().match(/[\p{L}\p{N}_]+(?:['’][\p{L}\p{N}_]+)*/gu) ?? []; }
function oneSpellingCorrection(before: string[], after: string[]): boolean {
  if (before.length !== after.length) return false;
  const changed = before.map((word, i) => word === after[i] ? -1 : i).filter((i) => i >= 0);
  if (changed.length !== 1) return false;
  const [a, b] = [before[changed[0]!]!, after[changed[0]!]!];
  return a !== b && a.length > 2 && b.length > 2 && editDistanceAtMostOne(a, b);
}
function editDistanceAtMostOne(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0; let j = 0; let edits = 0;
  while (i < a.length && j < b.length) { if (a[i] === b[j]) { i++; j++; continue; } if (++edits > 1) return false; if (a.length >= b.length) i++; if (b.length >= a.length) j++; }
  return edits + Number(i < a.length || j < b.length) <= 1;
}
function noHtml(text: string): boolean { return !/<\/?[A-Za-z][^>]*>|<!--|-->/i.test(text); }
function compareContent(before: string, after: string, path: string, kind: FileResult["class"]): string | undefined {
  if (!noHtml(before) || !noHtml(after)) return "raw HTML or comments are forbidden";
  const a = stripProtectedSections(before); const b = stripProtectedSections(after);
  if (!a || !b) return "unclosed frontmatter or fenced code block is uncertain";
  if (JSON.stringify(a.protected) !== JSON.stringify(b.protected)) return "frontmatter or fenced code block changed";
  return compareRemainder(a.rest, b.rest, path, kind);
}
function compareRemainder(before: string, after: string, path: string, kind: FileResult["class"]): string | undefined {
  const linksReason = compareLinks(before, after, path, kind);
  if (linksReason) return linksReason;
  return compareProse(before, after, kind);
}
function compareLinks(before: string, after: string, path: string, kind: FileResult["class"]): string | undefined {
  if (JSON.stringify(unsupportedMarkup(before)) !== JSON.stringify(unsupportedMarkup(after))) return "unsupported, external, image, or reference link changed";
  const oldLinks = links(before, path); const newLinks = links(after, path);
  if (!oldLinks || !newLinks || !sameLinkLabels(oldLinks.keys, newLinks.keys)) return "unsupported or changed link text";
  if (JSON.stringify(oldLinks.keys) !== JSON.stringify(newLinks.keys)) return "changed link does not resolve to the same repository file and anchor";
  if (kind === "instruction" && oldLinks.normalized !== newLinks.normalized) return "instruction prose or structure changed";
  return undefined;
}
function compareProse(before: string, after: string, kind: FileResult["class"]): string | undefined {
  if (kind !== "prose") return undefined;
  if (introducedFormatControls(before, after)) return "format-control or tag characters are forbidden";
  if (JSON.stringify(exactMarkup(before)) !== JSON.stringify(exactMarkup(after))) return "bare URLs or inline code changed";
  if (!sameWordsOrSingleCorrection(normalizeLinksForText(before), normalizeLinksForText(after))) return "word tokens changed beyond one spelling correction";
  return undefined;
}
function introducedFormatControls(before: string, after: string): boolean {
  const counts = (text: string) => {
    const result = new Map<string, number>();
    for (const character of text.match(/\p{Cf}|\p{Co}|\p{Cs}|[\u{E0000}-\u{E007F}\u{FE00}-\u{FE0F}\u{E0100}-\u{E01EF}\u{034F}\u{2800}]/gu) ?? []) result.set(character, (result.get(character) ?? 0) + 1);
    return result;
  };
  const oldCounts = counts(before);
  for (const [character, count] of counts(after)) if (count > (oldCounts.get(character) ?? 0)) return true;
  return false;
}
function unsupportedMarkup(text: string): string[] {
  return text.match(/!\[[^\]]*\]\([^)]*\)|\[[^\]]+\]:[^\n]*|\[[^\]]+\]\((?:[a-z][a-z\d+.-]*:|\/\/)[^)]+\)|<https?:\/\/[^>]+>|<[^>]+>/gi) ?? [];
}
function sameLinkLabels(before: string[], after: string[]): boolean {
  return JSON.stringify(before.map((key) => key.split("\0")[0])) === JSON.stringify(after.map((key) => key.split("\0")[0]));
}
function normalizeLinksForText(text: string): string { return text.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1"); }
function exactMarkup(text: string): string[] { return [...text.matchAll(/`+[^`]*`+|https?:\/\/[^\s)>]+/g)].map(([match]) => match); }
function sameWordsOrSingleCorrection(before: string, after: string): boolean {
  const left = wordTokens(before); const right = wordTokens(after);
  return left.join("\0") === right.join("\0") || oneSpellingCorrection(left, right);
}
async function fileCheck(change: RawChange, base: string, head: string, runner: CommandRunner, root: string, skillDir?: string): Promise<FileResult> {
  const path = change.paths.at(-1)!; const kind = classify(path, skillDir, root); const reason = pathReason(change, path);
  if (reason) return { path, class: "uncertain", ok: false, reason };
  if (change.oldOid === ZERO || change.newOid === ZERO) return { path, class: "uncertain", ok: false, reason: "missing blob is uncertain" };
  const before = await invoke(runner, "git", ["cat-file", "blob", change.oldOid], { cwd: root });
  const after = await invoke(runner, "git", ["cat-file", "blob", change.newOid], { cwd: root });
  const contentReason = compareContent(before, after, path, kind);
  return { path, class: kind, ok: !contentReason, reason: contentReason ?? "only permitted documentation changes" };
}
export async function docsOnly(base: string, head: string, runner: CommandRunner, skillDir?: string): Promise<{ clean: boolean; files: FileResult[] }> {
  const root = await targetRoot(runner);
  const raw = await invoke(runner, "git", ["diff", "--raw", "-z", "--find-renames", "--find-copies", base, head], { cwd: root });
  const changes = parseRawDiff(raw);
  const files = await Promise.all(changes.map((change) => fileCheck(change, base, head, runner, root, skillDir)));
  if (!changes.length) files.push({ path: "", class: "uncertain", ok: false, reason: "diff is empty" });
  return { clean: files.length > 0 && files.every((file) => file.ok), files };
}
