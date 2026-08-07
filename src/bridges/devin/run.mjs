#!/usr/bin/env node
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadTsModule } from "../../bootstrap-jiti.mjs";

const HOOK_SCRIPTS = {
  "pre-tool-use": "pre-tool-use.ts",
  "post-tool-use": "post-tool-use.ts",
  "session-start": "session-start.ts",
};

const here = dirname(fileURLToPath(import.meta.url));
const subcommand = process.argv[2];
const script = HOOK_SCRIPTS[subcommand];

if (!script) {
  process.stderr.write(`[Module Gate] unknown hook subcommand: ${subcommand ?? ""}\n`);
  process.exit(0);
}

loadTsModule(join(here, script)).catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`[Module Gate] hook bootstrap failed: ${message}\n`);
  process.exit(0);
});
