/**
 * profile-secrets — per-auth-profile environment secrets for pi.
 *
 * Mirrors the profile resolution of @nanstey/pi-auth-profiles and exports the
 * NAME=value pairs in ~/.pi/agent/secrets/<profile>.env (managed with the
 * `pi-secret` CLI) into process.env while that profile is active. Variables a
 * profile does not set revert to the value pi inherited at startup, so
 * switching profiles never leaks a secret across profiles. Child processes
 * (subagents, tools) inherit the result. Used for e.g. OPENROUTER_API_KEY or TYPESAFE_API_KEY (codemode Jev).
 * Profile or secret file changes are picked up by a file watch plus per-input hooks.
 */
import { type FSWatcher, existsSync, readFileSync, watch } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

const agentDir = process.env.PI_CODING_AGENT_DIR || join(homedir(), ".pi", "agent");
const NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;
// name -> value inherited before we overrode it. Kept on globalThis so it survives
// an extension reload (module state would be lost, baking old secrets into the baseline).
const KEY = Symbol.for("pi.profile-secrets.inherited");
const applied: Map<string, string | undefined> = ((globalThis as any)[KEY] ??= new Map());

function readJson(path: string): Record<string, unknown> | undefined {
	try {
		return JSON.parse(readFileSync(path, "utf8"));
	} catch {
		return undefined;
	}
}

function activeProfile(ctx: Pick<ExtensionContext, "cwd" | "isProjectTrusted">): string {
	const valid = (v: unknown): v is string => typeof v === "string" && /^[A-Za-z0-9._-]+$/.test(v.trim());
	if (ctx.isProjectTrusted()) {
		const p = readJson(join(ctx.cwd, ".pi", "settings.json"))?.authProfile;
		if (valid(p)) return p.trim();
	}
	const g = readJson(join(agentDir, "auth-profiles.json"))?.defaultProfile;
	return valid(g) ? g.trim() : "default";
}

function readSecrets(profile: string): Record<string, string> {
	const out: Record<string, string> = {};
	let text = "";
	try {
		text = readFileSync(join(agentDir, "secrets", `${profile}.env`), "utf8");
	} catch {
		return out;
	}
	for (const line of text.split("\n")) {
		const i = line.indexOf("=");
		if (i < 1) continue;
		const name = line.slice(0, i);
		if (NAME.test(name)) out[name] = line.slice(i + 1);
	}
	return out;
}

function apply(ctx: Pick<ExtensionContext, "cwd" | "isProjectTrusted">): void {
	const secrets = readSecrets(activeProfile(ctx));
	for (const [name, inherited] of applied) {
		if (name in secrets) continue;
		if (inherited === undefined) delete process.env[name];
		else process.env[name] = inherited;
		applied.delete(name);
	}
	for (const [name, value] of Object.entries(secrets)) {
		if (!applied.has(name)) applied.set(name, process.env[name]);
		process.env[name] = value;
	}
}

// `/profile use|default|clear` and `pi-secret` change files, not events, and extension
// commands run before input hooks. Watch those files so the change lands immediately.
// Parent directories are watched too, so a `.pi` or `secrets` dir created later is noticed
// (every change re-attaches the watchers).
const WATCH_KEY = Symbol.for("pi.profile-secrets.watch");
const WATCHED = new Set(["settings.json", "auth-profiles.json", ".pi", "secrets"]);
type WatchState = { watchers: FSWatcher[]; timer?: ReturnType<typeof setTimeout> };
const state: WatchState = ((globalThis as any)[WATCH_KEY] ??= { watchers: [] });

function stopWatching(): void {
	clearTimeout(state.timer);
	for (const w of state.watchers.splice(0)) w.close();
}

function startWatching(ctx: ExtensionContext): void {
	stopWatching();
	const onChange = (_event: string, file: string | Buffer | null) => {
		const name = String(file ?? "");
		if (!WATCHED.has(name) && !name.endsWith(".env")) return;
		clearTimeout(state.timer);
		state.timer = setTimeout(() => {
			try {
				apply(ctx);
				startWatching(ctx);
			} catch {
				// ctx may be stale after a session switch; the next event re-applies.
			}
		}, 50);
	};
	for (const dir of [ctx.cwd, join(ctx.cwd, ".pi"), agentDir, join(agentDir, "secrets")]) {
		if (!existsSync(dir)) continue;
		try {
			const w = watch(dir, onChange);
			w.on("error", () => w.close());
			w.unref();
			state.watchers.push(w);
		} catch {
			// Unwatchable directory: the per-input hooks still apply changes.
		}
	}
}

export default function (pi: ExtensionAPI) {
	pi.on("session_start", async (_event, ctx) => {
		apply(ctx);
		startWatching(ctx);
	});
	pi.on("session_shutdown", async () => stopWatching());
	// Fallback re-resolve on each input/turn.
	pi.on("input", async (_event, ctx) => apply(ctx));
	pi.on("before_agent_start", async (_event, ctx) => apply(ctx));
}
