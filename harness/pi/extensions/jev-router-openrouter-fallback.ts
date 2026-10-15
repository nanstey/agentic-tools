/**
 * jev-router-openrouter-fallback — let pi-jev use OpenRouter auth.
 *
 * When no real TYPESAFE_API_KEY is set but the active auth profile has OpenRouter
 * credentials, set PI_JEV_API_KEY and PI_JEV_BASE_URL so pi-jev's tools bill to
 * OpenRouter's System One endpoint. Pi's native TypeSafe classifier (codemode
 * `models.classify`) reads TYPESAFE_API_KEY only, so it never receives the
 * OpenRouter credential. PI_JEV_API_KEY is read by harness/pi/patches/pi-jev.patch.
 * A real TYPESAFE_API_KEY, or a PI_JEV_* value set by someone else, always wins.
 * Values this extension set are removed again if the OpenRouter credential
 * disappears (e.g. profile switch).
 */
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

const KEY_VAR = "PI_JEV_API_KEY";
const URL_VAR = "PI_JEV_BASE_URL";
const OPENROUTER_BASE = "https://openrouter.ai/api";

// Kept on globalThis so ownership survives an extension reload (module state would be lost).
const OWNED = Symbol.for("pi.jev-openrouter-fallback.owned");
const store = globalThis as unknown as Record<symbol, { key: string } | undefined>;

// Remove only the values this extension set; leave external overrides alone.
function release(env: NodeJS.ProcessEnv, owned: { key: string }): void {
	if (env[KEY_VAR] === owned.key) delete env[KEY_VAR];
	if (env[URL_VAR] === OPENROUTER_BASE) delete env[URL_VAR];
	store[OWNED] = undefined;
}

async function sync(ctx: ExtensionContext): Promise<void> {
	const env = process.env;
	let owned = store[OWNED];
	if (owned && env[KEY_VAR] !== owned.key) {
		release(env, owned); // someone else owns PI_JEV_API_KEY now
		owned = undefined;
	}
	if (!owned && env[KEY_VAR]?.trim()) return; // externally configured
	let key: string | undefined;
	if (!env.TYPESAFE_API_KEY?.trim()) {
		try {
			key = (await ctx.modelRegistry.getApiKeyForProvider("openrouter"))?.trim();
		} catch {
			key = undefined;
		}
	}
	if (key) {
		env[KEY_VAR] = key;
		if (!env[URL_VAR]?.trim() || env[URL_VAR] === OPENROUTER_BASE) env[URL_VAR] = OPENROUTER_BASE;
		store[OWNED] = { key };
	} else if (owned) {
		release(env, owned);
	}
}

export default function (pi: ExtensionAPI) {
	pi.on("session_start", async (_event, ctx) => sync(ctx));
	pi.on("input", async (_event, ctx) => sync(ctx));
}
