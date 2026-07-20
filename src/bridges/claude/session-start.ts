import * as fs from "node:fs";
import { createGateEngine } from "../../core/index.ts";
import { CLAUDE_CONFIG_SOURCES } from "./config-sources.ts";

type SessionStartEvent = {
  hook_event_name?: string;
  cwd?: string;
};

async function main(): Promise<void> {
  let raw: string;
  try {
    raw = fs.readFileSync(0, "utf-8");
  } catch {
    process.exit(0);
  }

  let event: SessionStartEvent;
  try {
    event = JSON.parse(raw);
  } catch {
    process.exit(0);
  }

  const cwd = event.cwd ?? process.env.CLAUDE_PROJECT_DIR ?? process.cwd();

  let engine;
  try {
    engine = await createGateEngine(cwd, { configSources: CLAUDE_CONFIG_SOURCES });
  } catch {
    process.exit(0);
  }

  for (const d of engine.diagnostics) {
    process.stderr.write(`[Module Gate] ${d.message}\n`);
  }

  if (engine.config.disableSystemPrompt) process.exit(0);
  if (engine.index.contracts.length === 0) process.exit(0);

  const additionalContext = engine.systemPromptHint("").trim();
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "SessionStart",
        additionalContext,
      },
    }),
  );
  process.exit(0);
}

main().catch(() => {
  process.exit(0);
});
