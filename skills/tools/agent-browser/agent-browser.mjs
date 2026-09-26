#!/usr/bin/env node
// agent-browser: persistent authenticated Chromium profiles driven by Jev,
// separate from your interactive Chrome.
//
//   agent-browser login <profile> [url]   headed browser for manual auth; close it to save
//   agent-browser run <profile> <task> [url] [--headed] [--max-steps N] [--format F]
//   agent-browser list                    list profiles

import { readFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { chromium } from "playwright";
import { navigate } from "@jkudish/jev-browser";

const BASE = process.env.AGENT_BROWSER_HOME ?? path.join(homedir(), ".browser-agent");
const PROFILES = path.join(BASE, "profiles");

function die(msg) {
  console.error(`agent-browser: ${msg}`);
  process.exit(1);
}

function profileDir(name) {
  if (!/^[a-z0-9][a-z0-9_-]{0,63}$/i.test(name)) die(`invalid profile name "${name}"`);
  return path.join(PROFILES, name);
}

function ensureKey() {
  if (!process.env.TYPESAFE_API_KEY) {
    const secret = path.join(homedir(), ".pi/agent/secrets/typesafe_api_key");
    if (existsSync(secret)) {
      process.env.TYPESAFE_API_KEY = readFileSync(secret, "utf8").trim();
    }
  }
  if (!process.env.TYPESAFE_API_KEY) {
    die("TYPESAFE_API_KEY not set and ~/.pi/agent/secrets/typesafe_api_key not found");
  }
}

async function login(name, url) {
  const dir = profileDir(name);
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const ctx = await chromium.launchPersistentContext(dir, {
    headless: false,
    viewport: null,
  });
  const page = ctx.pages()[0] ?? (await ctx.newPage());
  if (url) await page.goto(url);
  console.error(`Log in as needed, then close the browser window to save profile "${name}".`);
  await new Promise((resolve) => ctx.once("close", resolve));
  console.error(`Profile saved: ${dir}`);
}

async function run(name, task, url, opts) {
  ensureKey();
  const dir = profileDir(name);
  if (!existsSync(dir)) {
    die(`profile "${name}" not found — create it first: agent-browser login ${name} <login-url>`);
  }
  const ctx = await chromium.launchPersistentContext(dir, { headless: !opts.headed });
  try {
    const page = ctx.pages()[0] ?? (await ctx.newPage());
    const result = await navigate({
      task,
      page,
      ...(url ? { startUrl: url } : {}),
      maxSteps: opts.maxSteps,
      format: opts.format,
    });
    console.log(JSON.stringify(result, null, 2));
    if ("error" in result) process.exit(1);
    if (result.status !== "done" && result.status !== "goal_achieved") process.exit(2);
  } finally {
    await ctx.close();
  }
}

function list() {
  if (!existsSync(PROFILES)) return console.log("(no profiles)");
  const names = readdirSync(PROFILES, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
  console.log(names.length ? names.join("\n") : "(no profiles)");
}

// Import decrypted cookies from a running Chrome with DevTools enabled
// (opt in once via chrome://inspect/#remote-debugging on that Chrome).
async function importCookies(name, opts) {
  const dir = profileDir(name);
  mkdirSync(dir, { recursive: true, mode: 0o700 });

  let source;
  try {
    source = await chromium.connectOverCDP(`http://127.0.0.1:${opts.port}`);
  } catch {
    die(
      `no DevTools endpoint on port ${opts.port}. On your Chrome, open ` +
        `chrome://inspect/#remote-debugging and tick "Allow remote debugging ` +
        `for this browser instance", or launch it with --remote-debugging-port ` +
        `on a non-default profile.`,
    );
  }

  let cookies;
  try {
    const srcCtx = source.contexts()[0];
    if (!srcCtx) die("connected, but Chrome exposed no browser context");
    cookies = await srcCtx.cookies();
  } finally {
    await source.close(); // detaches; never closes the user's Chrome
  }

  if (opts.domains.length) {
    cookies = cookies.filter((c) =>
      opts.domains.some((d) => c.domain === d || c.domain === `.${d}` || c.domain.endsWith(`.${d}`)),
    );
  }
  if (!cookies.length) die("no cookies matched — check --domains or log in on the source Chrome first");

  const ctx = await chromium.launchPersistentContext(dir, { headless: true });
  try {
    await ctx.addCookies(cookies);
  } finally {
    await ctx.close();
  }
  const domains = [...new Set(cookies.map((c) => c.domain))].sort();
  console.error(`Imported ${cookies.length} cookies into profile "${name}" for: ${domains.join(", ")}`);
  console.error("Note: localStorage/SPA tokens do not transfer; if the site rejects the session, use: agent-browser login " + name);
}

const [cmd, ...rest] = process.argv.slice(2);

switch (cmd) {
  case "login": {
    const [name, url] = rest;
    if (!name) die("usage: agent-browser login <profile> [url]");
    await login(name, url);
    break;
  }
  case "run": {
    const positional = [];
    const opts = { headed: false, maxSteps: 24, format: "text" };
    for (let i = 0; i < rest.length; i++) {
      const a = rest[i];
      if (a === "--headed") opts.headed = true;
      else if (a === "--max-steps") opts.maxSteps = Number(rest[++i]);
      else if (a === "--format") opts.format = rest[++i];
      else positional.push(a);
    }
    const [name, task, url] = positional;
    if (!name || !task) die('usage: agent-browser run <profile> "<task>" [url] [--headed] [--max-steps N] [--format text|markdown|html|aria]');
    await run(name, task, url, opts);
    break;
  }
  case "import": {
    const positional = [];
    const opts = { port: 9222, domains: [] };
    for (let i = 0; i < rest.length; i++) {
      const a = rest[i];
      if (a === "--port") opts.port = Number(rest[++i]);
      else if (a === "--domains") opts.domains = rest[++i].split(",").map((d) => d.trim()).filter(Boolean);
      else positional.push(a);
    }
    const [name] = positional;
    if (!name) die("usage: agent-browser import <profile> [--port 9222] [--domains github.com,google.com]");
    await importCookies(name, opts);
    break;
  }
  case "list":
    list();
    break;
  default:
    die("usage: agent-browser <login|run|import|list> ...");
}
