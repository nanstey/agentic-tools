/**
 * subagents-readiness — report incomplete managed-subagent installation early.
 *
 * The strict-dispatch patch and copied managed profiles arrive on different
 * sides of Pi's two-run package bootstrap. Read only the install-state markers
 * so an incomplete bootstrap gives the coordinator a safe recovery path before
 * it tries Agent.
 */
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, join } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const PATCH_MARKERS = ["const MANAGED_AGENT_TYPES", "function matchesManagedSecuritySetting("];
const REQUIRED_PROFILES = ["scout.md", "researcher.md", "planner.md", "worker.md", "reviewer.md"];

type ReadinessFailure = { ready: false; reason: string };
export type SubagentsReadiness = { ready: true } | ReadinessFailure;

function getAgentDir(): string {
	return process.env.PI_CODING_AGENT_DIR || join(homedir(), ".pi", "agent");
}

function readText(path: string): string | undefined {
	try {
		return readFileSync(path, "utf8");
	} catch {
		return undefined;
	}
}

function listedProfiles(manifest: string): string[] {
	return manifest
		.split("\n")
		.map((name) => name.trim())
		.filter((name) => name.endsWith(".md"));
}

function isSafeProfileName(name: string): boolean {
	return !name.startsWith(".") && !name.includes("/") && !name.includes("\\");
}

/** Read-only check shared by the startup hook and its offline test. */
export function checkSubagentsReadiness(agentDir: string): SubagentsReadiness {
	const packageSource = readText(join(agentDir, "npm", "node_modules", "@tintinweb", "pi-subagents", "src", "index.ts"));
	if (!packageSource || !PATCH_MARKERS.every((marker) => packageSource.includes(marker))) {
		return { ready: false, reason: "the strict-dispatch patch is missing" };
	}

	const agentsDir = join(agentDir, "agents");
	const manifest = readText(join(agentsDir, ".agentic-tools-pi-agents"));
	if (manifest === undefined) return { ready: false, reason: "the managed-profile manifest is missing" };

	const profiles = listedProfiles(manifest);
	if (profiles.length === 0) return { ready: false, reason: "the managed-profile manifest is empty" };
	for (const profile of profiles) {
		if (!isSafeProfileName(profile)) return { ready: false, reason: `the managed-profile manifest has an invalid entry: ${profile}` };
		if (!existsSync(join(agentsDir, profile))) return { ready: false, reason: `managed profile ${profile} is missing` };
	}
	for (const profile of REQUIRED_PROFILES) {
		if (!profiles.includes(profile)) return { ready: false, reason: `the managed-profile manifest is missing ${profile}` };
	}

	return { ready: true };
}

function agenticToolsCheckout(agentDir: string): string | undefined {
	const path = readText(join(agentDir, "self-improve", "repo"))?.trim();
	return path && !/[\r\n]/.test(path) && isAbsolute(path) ? path : undefined;
}

/** User-facing warning text, kept separate so tests cover the exact recovery action. */
export function subagentsReadinessWarning(agentDir: string, readiness: ReadinessFailure): string {
	const checkout = agenticToolsCheckout(agentDir);
	const location = checkout ? `the agentic-tools checkout at ${checkout}` : "the agentic-tools checkout";
	return `Managed subagents are unavailable because ${readiness.reason}. Run \`bash install.sh\` from ${location}, then restart Pi.`;
}

function subagentsReadinessGuidance(agentDir: string, readiness: ReadinessFailure): string {
	return `[MANAGED SUBAGENTS UNAVAILABLE]
${subagentsReadinessWarning(agentDir, readiness)}
Agent rejections such as \`Unknown or disabled agent type\` come from this install gap. Do not copy profiles by hand or call installer functions piecemeal, because that can skip the strict-dispatch patch. If the user's task permits changing install state, run the full idempotent installer; otherwise work directly and mention this gap once in the final report.`;
}

function isLeafSubagent(systemPrompt: string): boolean {
	return /<active_agent\s+name=[^>]+\/?\s*>/.test(systemPrompt);
}

export default function (pi: ExtensionAPI) {
	// Loop children and managed leaf agents neither coordinate nor need this note.
	if (process.env.PI_SELF_IMPROVE_CHILD) return;

	let readiness: SubagentsReadiness | undefined;
	let warned = false;
	const notifyOnce = (ctx: { hasUI: boolean; ui: { notify(message: string, level: "warning"): void } }, current: ReadinessFailure) => {
		if (warned || !ctx.hasUI) return;
		warned = true;
		try {
			ctx.ui.notify(subagentsReadinessWarning(getAgentDir(), current), "warning");
		} catch {
			// Readiness guidance must not disrupt a session when the UI is unavailable.
		}
	};

	pi.on("session_start", (_event, ctx) => {
		readiness = checkSubagentsReadiness(getAgentDir());
		if (readiness.ready) return;
		try {
			if (!isLeafSubagent(ctx.getSystemPrompt())) notifyOnce(ctx, readiness);
		} catch {
			// Defer the warning until before_agent_start if the prompt is not ready yet.
		}
	});
	pi.on("before_agent_start", (event, ctx) => {
		const current = readiness ?? checkSubagentsReadiness(getAgentDir());
		if (current.ready || isLeafSubagent(event.systemPrompt)) return;
		notifyOnce(ctx, current);
		return {
			message: {
				customType: "subagents-readiness",
				content: subagentsReadinessGuidance(getAgentDir(), current),
				display: false,
			},
		};
	});
}
