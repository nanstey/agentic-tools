#!/usr/bin/env node
import { main } from "./cli.ts";
import { realDeps } from "./deps.ts";

process.exitCode = await main(process.argv.slice(2), {
  deps: realDeps(),
  env: process.env,
  now: () => Date.now(),
  out: (s) => process.stdout.write(s),
  err: (s) => process.stderr.write(s),
});
