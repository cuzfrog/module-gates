import * as fs from "node:fs";
import * as path from "node:path";
import {
  readHooks,
  upsertHooks,
  writeHooks,
  HOOK_MARKER,
  PRE_TOOL_USE_MATCHER,
  POST_TOOL_USE_MATCHER,
} from "../bridges/devin/index.ts";

export type InstallDevinOptions = {
  projectDir: string;
};

export type InstallDevinResult =
  | { ok: true; written: string }
  | { ok: false; reason: string };

export function installDevin(opts: InstallDevinOptions): InstallDevinResult {
  const projectDir = path.resolve(opts.projectDir);
  if (!fs.existsSync(projectDir) || !fs.statSync(projectDir).isDirectory()) {
    return { ok: false, reason: `Project directory does not exist: ${projectDir}` };
  }

  const hooks = readHooks(projectDir);
  const updated = upsertHooks(hooks);
  const written = writeHooks(projectDir, updated);

  const relPath = path.relative(projectDir, written) || written;
  process.stdout.write(`Wrote ${relPath}\n\n`);
  process.stdout.write("Hook entries inserted under PreToolUse, PostToolUse, and SessionStart:\n");
  for (const event of ["PreToolUse", "PostToolUse", "SessionStart"]) {
    const matcher = updated[event]?.find((m) =>
      m.hooks.some((h) => typeof h.command === "string" && h.command.includes(HOOK_MARKER)),
    );
    if (!matcher) continue;
    process.stdout.write(`  ${event} matcher: ${JSON.stringify(matcher.matcher)}\n`);
    for (const h of matcher.hooks) {
      if (typeof h.command === "string") {
        process.stdout.write(`    command: ${h.command}\n`);
      }
    }
  }
  process.stdout.write(`\nPreToolUse matcher targets: ${PRE_TOOL_USE_MATCHER}\n`);
  process.stdout.write(`PostToolUse matcher targets: ${POST_TOOL_USE_MATCHER}\n`);

  return { ok: true, written };
}
