/**
 * jev-router-openrouter-fallback — let Jev plugins use OpenRouter auth.
 *
 * Jev plugins read TYPESAFE_API_KEY (and optional TYPESAFE_API_URL / TYPESAFE_BASE_URL) from
 * the environment on every Jev call. When no TypeSafe key is set but the active
 * auth profile has OpenRouter credentials, point the key and URL
 * variables at OpenRouter's System One endpoint, so `jev_route` and other Jev
 * plugins bill to OpenRouter. A real TYPESAFE_API_KEY always wins. Values this extension set are
 * removed again if the OpenRouter credential disappears (e.g. profile switch).
 */
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

// Plugins disagree on what "URL" means: some want the full endpoint, the TypeSafe SDK wants the base.
const OPENROUTER_URLS = {
	TYPESAFE_API_URL: "https://openrouter.ai/api/v1/systemone", // full endpoint (legacy plugins)
	TYPESAFE_BASE_URL: "https://openrouter.ai/api", // TypeSafe SDK, pi-jev, pi-jev-context-curator (base)
} as const;
let ours: { key: string; urls: string[] } | undefined;

async function sync(ctx: ExtensionContext): Promise<void> {
	const env = process.env;
	if (ours && env.TYPESAFE_API_KEY !== ours.key) ours = undefined; // someone else owns it now
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
		ours = { key, urls };
	} else if (ours) {
		delete env.TYPESAFE_API_KEY;
		for (const name of ours.urls) delete env[name];
		ours = undefined;
	}
}

export default function (pi: ExtensionAPI) {
	pi.on("session_start", async (_event, ctx) => sync(ctx));
	pi.on("input", async (_event, ctx) => sync(ctx));
}
