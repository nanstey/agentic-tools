// Offline tests for the managed-subagent readiness extension. No Pi process or model is started.
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import readinessExtension, { checkSubagentsReadiness, subagentsReadinessWarning } from "../extensions/subagents-readiness.ts";

const MARKERS = [
	"const MANAGED_AGENT_TYPES",
	"function managedProjectSettingsError(",
	"function resolveExactAvailableModel(",
	"function managedThinkingError(",
	"function matchesManagedSecuritySetting(",
].join("\n");
const PROFILES = ["scout.md", "researcher.md", "planner.md", "worker.md", "reviewer.md"];

function sandbox(t) {
	const dir = mkdtempSync(join(tmpdir(), "subagents-readiness-"));
	t.after(() => rmSync(dir, { recursive: true, force: true }));
	return dir;
}

function seedReadyState(agentDir) {
	const packageDir = join(agentDir, "npm", "node_modules", "@tintinweb", "pi-subagents", "src");
	const agentsDir = join(agentDir, "agents");
	mkdirSync(packageDir, { recursive: true });
	mkdirSync(agentsDir, { recursive: true });
	writeFileSync(join(packageDir, "index.ts"), MARKERS);
	writeFileSync(join(agentsDir, ".agentic-tools-pi-agents"), `${PROFILES.join("\n")}\n`);
	for (const profile of PROFILES) writeFileSync(join(agentsDir, profile), "---\nname: test\n---\n");
}

function extensionHarness() {
	const handlers = new Map();
	return {
		handlers,
		pi: { on: (event, handler) => handlers.set(event, handler) },
	};
}

async function withAgentDir(agentDir, run) {
	const old = process.env.PI_CODING_AGENT_DIR;
	const oldChild = process.env.PI_SELF_IMPROVE_CHILD;
	process.env.PI_CODING_AGENT_DIR = agentDir;
	delete process.env.PI_SELF_IMPROVE_CHILD;
	try {
		return await run();
	} finally {
		if (old === undefined) delete process.env.PI_CODING_AGENT_DIR;
		else process.env.PI_CODING_AGENT_DIR = old;
		if (oldChild === undefined) delete process.env.PI_SELF_IMPROVE_CHILD;
		else process.env.PI_SELF_IMPROVE_CHILD = oldChild;
	}
}

test("unpatched package and absent manifest warn with the installer remedy", async (t) => {
	const agentDir = sandbox(t);
	mkdirSync(join(agentDir, "npm", "node_modules", "@tintinweb", "pi-subagents", "src"), { recursive: true });
	writeFileSync(join(agentDir, "npm", "node_modules", "@tintinweb", "pi-subagents", "src", "index.ts"), "upstream source\n");

	const readiness = checkSubagentsReadiness(agentDir);
	assert.deepEqual(readiness, { ready: false, reason: "the strict-dispatch patch is missing" });
	assert.match(subagentsReadinessWarning(agentDir, readiness), /Run `bash install\.sh` from the agentic-tools checkout, then restart Pi\./);

	await withAgentDir(agentDir, async () => {
		const { handlers, pi } = extensionHarness();
		const notifications = [];
		const ctx = { hasUI: true, getSystemPrompt: () => "coordinator prompt", ui: { notify: (...args) => notifications.push(args) } };
		readinessExtension(pi);
		await handlers.get("session_start")({}, ctx);
		const first = await handlers.get("before_agent_start")({ systemPrompt: "coordinator prompt" }, ctx);
		const second = await handlers.get("before_agent_start")({ systemPrompt: "coordinator prompt" }, ctx);
		assert.equal(notifications.length, 1);
		assert.match(notifications[0][0], /Run `bash install\.sh`/);
		assert.equal(notifications[0][1], "warning");
		assert.match(first.message.content, /Do not copy profiles by hand/);
		assert.match(second.message.content, /Unknown or disabled agent type/);
	});
});

test("a partially patched package is not ready", (t) => {
	const agentDir = sandbox(t);
	const packageDir = join(agentDir, "npm", "node_modules", "@tintinweb", "pi-subagents", "src");
	mkdirSync(packageDir, { recursive: true });
	writeFileSync(join(packageDir, "index.ts"), "const MANAGED_AGENT_TYPES\nfunction matchesManagedSecuritySetting(\n");
	assert.deepEqual(checkSubagentsReadiness(agentDir), { ready: false, reason: "the strict-dispatch patch is missing" });
});

test("patched markers and every managed profile are ready and remain silent", async (t) => {
	const agentDir = sandbox(t);
	seedReadyState(agentDir);
	assert.deepEqual(checkSubagentsReadiness(agentDir), { ready: true });

	await withAgentDir(agentDir, async () => {
		const { handlers, pi } = extensionHarness();
		const notifications = [];
		readinessExtension(pi);
		await handlers.get("session_start")({}, {});
		const result = await handlers.get("before_agent_start")(
			{ systemPrompt: "coordinator prompt" },
			{ hasUI: true, ui: { notify: (...args) => notifications.push(args) } },
		);
		assert.equal(result, undefined);
		assert.deepEqual(notifications, []);
	});
});

test("a manifest entry without its profile is not ready", (t) => {
	const agentDir = sandbox(t);
	seedReadyState(agentDir);
	rmSync(join(agentDir, "agents", "worker.md"));
	assert.deepEqual(checkSubagentsReadiness(agentDir), { ready: false, reason: "managed profile worker.md is missing" });
});

test("missing directories do not throw or write", (t) => {
	const agentDir = sandbox(t);
	assert.doesNotThrow(() => checkSubagentsReadiness(agentDir));
	assert.deepEqual(checkSubagentsReadiness(agentDir), { ready: false, reason: "the strict-dispatch patch is missing" });
	assert.equal(existsSync(join(agentDir, "agents")), false);
});

test("children and leaf subagents receive neither warning nor guidance", async (t) => {
	const agentDir = sandbox(t);
	const oldChild = process.env.PI_SELF_IMPROVE_CHILD;
	process.env.PI_SELF_IMPROVE_CHILD = "worker";
	try {
		const child = extensionHarness();
		readinessExtension(child.pi);
		assert.equal(child.handlers.size, 0);
	} finally {
		if (oldChild === undefined) delete process.env.PI_SELF_IMPROVE_CHILD;
		else process.env.PI_SELF_IMPROVE_CHILD = oldChild;
	}

	await withAgentDir(agentDir, async () => {
		const { handlers, pi } = extensionHarness();
		const notifications = [];
		const ctx = {
			hasUI: true,
			getSystemPrompt: () => '<active_agent name="worker"/>\nchild prompt',
			ui: { notify: (...args) => notifications.push(args) },
		};
		readinessExtension(pi);
		await handlers.get("session_start")({}, ctx);
		const result = await handlers.get("before_agent_start")({ systemPrompt: '<active_agent name="worker"/>\nchild prompt' }, ctx);
		assert.equal(result, undefined);
		assert.deepEqual(notifications, []);
	});
});
