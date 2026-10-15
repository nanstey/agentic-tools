/**
 * jev-router-openrouter-fallback — let Jev plugins use OpenRouter auth.
 *
 * Jev plugins read TYPESAFE_API_KEY (and optional TYPESAFE_API_URL / TYPESAFE_BASE_URL) from
 * the environment on every Jev call. When no TypeSafe key is set but the active
 * auth profile has OpenRouter credentials, point the key and URL
 * variables at OpenRouter's System One endpoint, so `models.classify()` and other Jev
 * plugins bill to OpenRouter. A real TYPESAFE_API_KEY always wins. Values this extension set are
 * removed again if the OpenRouter credential disappears (e.g. profile switch).
 */
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

// Plugins disagree on what "URL" means: some want the full endpoint, the TypeSafe SDK wants the base.
const OPENROUTER_URLS = {
	TYPESAFE_API_URL: "https://openrouter.ai/api/v1/systemone", // full endpoint (legacy plugins)
	TYPESAFE_BASE_URL: "https://openrouter.ai/api", // TypeSafe SDK, pi-jev, pi-jev-context-curator (base)
} as const;
type Owned = { key: string; urls: string[] };
// Kept on globalThis so ownership survives an extension reload (module state would be lost).
const OWNED = Symbol.for("pi.jev-openrouter-fallback.owned");
const store = globalThis as unknown as Record<symbol, Owned | undefined>;

// Remove only the URL values this extension set; leave external overrides alone.
function release(env: NodeJS.ProcessEnv, owned: Owned, removeKey: boolean): void {
	for (const name of owned.urls) {
		if (env[name] === OPENROUTER_URLS[name as keyof typeof OPENROUTER_URLS]) delete env[name];
	}
	if (removeKey && env.TYPESAFE_API_KEY === owned.key) delete env.TYPESAFE_API_KEY;
	store[OWNED] = undefined;
}

async function sync(ctx: ExtensionContext): Promise<void> {
	const env = process.env;
	let ours = store[OWNED];
	if (ours && env.TYPESAFE_API_KEY !== ours.key) {
		release(env, ours, false); // someone else owns the key now; drop our URLs
		ours = undefined;
	}
	if (!ours && env.TYPESAFE_API_KEY?.trim()) return; // real TypeSafe key
	let key: string | undefined;
	try {
		key = (await ctx.modelRegistry.getApiKeyForProvider("openrouter"))?.trim();
	} catch {
		key = undefined;
	}
	if (key) {
		const urls = (Object.keys(OPENROUTER_URLS) as (keyof typeof OPENROUTER_URLS)[]).filter(
			(name) => ours?.urls.includes(name) || !env[name]?.trim(),
		);
		env.TYPESAFE_API_KEY = key;
		for (const name of urls) env[name] = OPENROUTER_URLS[name as keyof typeof OPENROUTER_URLS];
		store[OWNED] = { key, urls };
	} else if (ours) {
		release(env, ours, true);
	}
}

export default function (pi: ExtensionAPI) {
	pi.on("session_start", async (_event, ctx) => sync(ctx));
	pi.on("input", async (_event, ctx) => sync(ctx));
}
