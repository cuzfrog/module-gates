import * as path from "node:path";
import type {
  BeforeAgentStartEventResult,
  ExtensionAPI,
  ToolCallEventResult,
} from "@earendil-works/pi-coding-agent";
import { isToolCallEventType } from "@earendil-works/pi-coding-agent";
import {
  createGateEngine,
  readFileSafe,
  type ConfigSource,
  type GateEngine,
} from "../../core/index.ts";

const CONFIG_SOURCES: ConfigSource[] = [
  { filePath: ".module-gates/config.json" },
  { filePath: ".pi/settings.json", key: "module-gates" },
  { filePath: ".claude/settings.json", key: "module-gates" },
];

export default function (pi: ExtensionAPI): void {
  let engine: GateEngine | undefined;

  pi.on("session_start", async (_event, ctx) => {
    engine = await createGateEngine(ctx.cwd, { configSources: CONFIG_SOURCES });
    for (const d of engine.diagnostics) {
      ctx.ui.notify(`[Module Gate] ${d.message}`, d.level);
    }
    if (engine.index.contracts.length === 0) {
      ctx.ui.notify(
        "[Module Gate] No module descriptor files found. Gates are not active.",
        "info",
      );
    }
  });

  pi.on("before_agent_start", async (event): Promise<BeforeAgentStartEventResult | void> => {
    if (!engine || engine.index.contracts.length === 0) return;
    return { systemPrompt: engine.systemPromptHint(event.systemPrompt) };
  });

  pi.on("tool_call", async (event, ctx): Promise<ToolCallEventResult | void> => {
    if (!engine) return;
    if (isToolCallEventType("edit", event)) {
      return engine.checkEdit(event.input.path, event.input.edits);
    }
    if (isToolCallEventType("write", event)) {
      const absPath = path.resolve(ctx.cwd, event.input.path);
      const before = readFileSafe(absPath);
      return engine.checkEdit(event.input.path, [
        { oldText: before, newText: event.input.content },
      ]);
    }
  });
}
