/**
 * self-improve — start Pi's harness self-improvement loop from a live session.
 *
 * The agent calls `report_harness_issue` when it hits a procedural problem
 * caused by the harness itself (skills, agent profiles, system prompt, tool or
 * extension config, installer). The report is queued and, once the current run
 * settles (or the session ends), `pi-improve reflect` starts a detached headless
 * Pi session that runs `/reflect` against this session's log. That session
 * opens one worktree of the agentic-tools repo per worthwhile improvement and
 * launches a Pi session in each (`/improve`) to ship a PR for human review.
 *
 * Plumbing, limits, and state live in `bin/pi-improve`. Sessions started by the
 * loop have PI_SELF_IMPROVE_CHILD set and never register the tool, so the loop
 * cannot recurse. Disable with `/self-improve off`, PI_SELF_IMPROVE=0, or by
 * creating $PI_AGENT_DIR/self-improve/disabled.
 */
import { execFile } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { Type } from "@earendil-works/pi-ai";
import { type ExtensionAPI, type ExtensionContext } from "@earendil-works/pi-coding-agent";

const agentDir = process.env.PI_CODING_AGENT_DIR || join(homedir(), ".pi", "agent");
const stateDir = join(agentDir, "self-improve");
const disabledFile = join(stateDir, "disabled");
const helper = join(agentDir, "bin", "pi-improve");

const CATEGORIES = ["skill", "agent-profile", "system-prompt", "tool-or-extension", "install-or-config", "other"] as const;

interface Entry {
	category: string;
	summary: string;
	at: string;
}

const isDisabled = () => process.env.PI_SELF_IMPROVE === "0" || existsSync(disabledFile);

function runHelper(args: string[]): Promise<{ ok: boolean; out: string }> {
	return new Promise((resolve) => {
		execFile(helper, args, { timeout: 60_000, env: process.env }, (err, stdout, stderr) => {
			resolve({ ok: !err, out: `${stdout}${stderr}`.trim() });
		});
	});
}

export default function (pi: ExtensionAPI) {
	// Sessions the loop itself started must not report back into it.
	if (process.env.PI_SELF_IMPROVE_CHILD) return;

	let pending: Entry[] = [];
	let spawned = false; // one reflection per session unless the user forces it

	async function flush(ctx: ExtensionContext, force = false): Promise<void> {
		if (pending.length === 0) return;
		const entries = pending;
		pending = [];
		const sessionFile = ctx.sessionManager.getSessionFile();
		const notify = (msg: string, level: "info" | "warning" = "info") => {
			try {
				if (ctx.hasUI) ctx.ui.notify(msg, level);
			} catch {}
		};
		if (!sessionFile) {
			notify("self-improve: this session is not persisted, so there is no log to reflect on.", "warning");
			return;
		}
		const id = `${new Date().toISOString().replace(/[:.]/g, "-")}-${ctx.sessionManager.getSessionId().slice(0, 8)}`;
		const reportFile = join(stateDir, "reports", `${id}.json`);
		mkdirSync(join(stateDir, "reports"), { recursive: true });
		writeFileSync(
			reportFile,
			`${JSON.stringify({ id, sessionFile, sessionId: ctx.sessionManager.getSessionId(), cwd: ctx.cwd, entries, summary: entries.map((e) => `[${e.category}] ${e.summary}`).join("\n") }, null, 2)}\n`,
		);
		const res = await runHelper(["reflect", reportFile, ...(force ? ["--force"] : [])]);
		if (res.ok) {
			spawned = true;
			notify("self-improve: reflection started in the background (`/self-improve status`).");
		} else {
			notify(`self-improve: reflection not started: ${res.out.split("\n").pop()}`, "warning");
		}
	}

	pi.registerTool({
		name: "report_harness_issue",
		label: "Report harness issue",
		description:
			"Report a procedural problem caused by the agent harness itself so a background reflection can propose a fix to the shared skills/harness repo. " +
			"Returns immediately; the reflection runs after this run ends. Not a way to ask for help with the user's task.",
		promptSnippet: "Report a harness-caused procedural problem (wrong skill/agent/prompt/config) for background self-improvement",
		promptGuidelines: [
			"Call report_harness_issue when a procedural problem was caused by the harness itself and cost you real turns: a skill, agent profile, or system-prompt rule that is wrong, contradictory, stale, or missing; a tool, extension, or config that misbehaves repeatably; an installer or setup gap. Work around the problem first, report once per distinct issue, then continue the user's task. Never stop the task to fix the harness.",
			"Do not call report_harness_issue for bugs in the user's project, your own mistakes, one-off typos, provider outages or quota errors, or user preferences. Never put secrets, tokens, or private names in the summary.",
		],
		parameters: Type.Object({
			summary: Type.String({
				description:
					"What went wrong, the suspected harness file or component, and what would have prevented it. 2-6 sentences, no secrets.",
			}),
			category: Type.Union(
				CATEGORIES.map((c) => Type.Literal(c)),
				{ description: "Which part of the harness is suspected" },
			),
		}),
		async execute(_id, params, _signal, _onUpdate, _ctx) {
			const text = (msg: string) => ({ content: [{ type: "text" as const, text: msg }], details: undefined });
			if (isDisabled()) return text("Self-improvement is disabled. Carry on with the user's task.");
			if (spawned) return text("A reflection was already started for this session. Carry on with the user's task.");
			if (pending.length >= 3) return text("Enough reports are queued for this session. Carry on.");
			pending.push({ category: String(params.category), summary: String(params.summary).slice(0, 2000), at: new Date().toISOString() });
			return text("Harness issue queued; a background reflection will start when this run ends. Carry on with the user's task and do not fix the harness yourself.");
		},
	});

	// Wait until Pi will not continue on its own so the log holds the whole incident.
	pi.on("agent_settled", async (_event, ctx) => {
		if (!isDisabled()) await flush(ctx);
	});
	pi.on("session_shutdown", async (_event, ctx) => {
		if (!isDisabled()) await flush(ctx);
	});

	pi.registerCommand("self-improve", {
		description: "Harness self-improvement loop: status | now [note] | on | off",
		getArgumentCompletions: (prefix) => {
			const subs = ["status", "now", "on", "off"].filter((s) => s.startsWith(prefix));
			return subs.length ? subs.map((s) => ({ value: s, label: s })) : null;
		},
		handler: async (args, ctx) => {
			const [sub = "status", ...rest] = args.trim().split(/\s+/);
			if (sub === "off") {
				mkdirSync(stateDir, { recursive: true });
				writeFileSync(disabledFile, "");
				return ctx.ui.notify("self-improve: disabled", "info");
			}
			if (sub === "on") {
				rmSync(disabledFile, { force: true });
				return ctx.ui.notify("self-improve: enabled", "info");
			}
			if (sub === "now") {
				if (isDisabled()) return ctx.ui.notify("self-improve is disabled (`/self-improve on`)", "warning");
				pending.push({ category: "other", summary: rest.join(" ") || "Manual request: reflect on this session for harness problems.", at: new Date().toISOString() });
				return flush(ctx, true);
			}
			const res = await runHelper(["status"]);
			ctx.ui.notify(`${isDisabled() ? "(disabled) " : ""}${res.out}`, res.ok ? "info" : "warning");
		},
	});
}
