import * as fs from "node:fs";
import * as path from "node:path";
import {
  readSettings,
  upsertHooks,
  writeSettings,
  HOOK_MARKER,
  PRE_TOOL_USE_MATCHER,
} from "../bridges/claude/settings-writer.ts";

export type InstallClaudeOptions = {
  projectDir: string;
};

export type InstallClaudeResult =
  | { ok: true; written: string }
  | { ok: false; reason: string };

export function installClaude(opts: InstallClaudeOptions): InstallClaudeResult {
  const projectDir = path.resolve(opts.projectDir);
  if (!fs.existsSync(projectDir) || !fs.statSync(projectDir).isDirectory()) {
    return { ok: false, reason: `Project directory does not exist: ${projectDir}` };
  }

  const settings = readSettings(projectDir);
  const updated = upsertHooks(settings);
  const written = writeSettings(projectDir, updated);

  const relPath = path.relative(projectDir, written) || written;
  process.stdout.write(`Wrote ${relPath}\n\n`);
  process.stdout.write("Hook entries inserted under hooks.PreToolUse and hooks.SessionStart:\n");
  for (const event of ["PreToolUse", "SessionStart"]) {
    const matcher = updated.hooks?.[event]?.find((m) =>
      m.hooks.some((h) => typeof h.command === "string" && h.command.includes(HOOK_MARKER)),
    );
    if (!matcher) continue;
    process.stdout.write(`  ${event} matcher: "${matcher.matcher}"\n`);
    for (const h of matcher.hooks) {
      if (typeof h.command === "string") {
        process.stdout.write(`    command: ${h.command}\n`);
      }
      if (h.statusMessage) process.stdout.write(`    status:  ${h.statusMessage}\n`);
    }
  }
  process.stdout.write(`\nPreToolUse matcher targets: ${PRE_TOOL_USE_MATCHER}\n`);

  return { ok: true, written };
}
