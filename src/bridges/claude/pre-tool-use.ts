import * as fs from "node:fs";
import * as path from "node:path";
import {
  applyEdits,
  createGateEngine,
  readFileSafe,
  type GateEdit,
} from "../../core/index.ts";
import { CLAUDE_CONFIG_SOURCES } from "./config-sources.ts";

type HookEvent = {
  hook_event_name?: string;
  tool_name?: string;
  tool_input?: {
    file_path?: string;
    old_string?: string;
    new_string?: string;
    edits?: { old_string?: string; new_string?: string }[];
    content?: string;
  };
  cwd?: string;
};

async function main(): Promise<void> {
  let raw: string;
  try {
    raw = fs.readFileSync(0, "utf-8");
  } catch {
    process.exit(0);
  }

  let event: HookEvent;
  try {
    event = JSON.parse(raw);
  } catch {
    process.stderr.write("[Module Gate] hook: invalid JSON input; allowing tool call.\n");
    process.exit(0);
  }

  if (event.hook_event_name !== "PreToolUse") process.exit(0);
  if (
    event.tool_name !== "Edit" &&
    event.tool_name !== "MultiEdit" &&
    event.tool_name !== "Write"
  ) {
    process.exit(0);
  }

  const cwd: string = event.cwd ?? process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
  const toolInput = event.tool_input ?? {};
  const filePath: string | undefined = toolInput.file_path;
  if (!filePath) process.exit(0);

  const absPath = path.resolve(cwd, filePath);
  const before = readFileSafe(absPath);
  let after: string;

  if (event.tool_name === "Edit") {
    after = applyEdits(before, [
      { oldText: toolInput.old_string ?? "", newText: toolInput.new_string ?? "" },
    ]);
  } else if (event.tool_name === "MultiEdit") {
    const edits: GateEdit[] = Array.isArray(toolInput.edits)
      ? toolInput.edits.map((e) => ({
          oldText: e.old_string ?? "",
          newText: e.new_string ?? "",
        }))
      : [];
    after = applyEdits(before, edits);
  } else {
    after = toolInput.content ?? "";
  }

  let engine;
  try {
    engine = await createGateEngine(cwd, { configSources: CLAUDE_CONFIG_SOURCES });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`[Module Gate] index build failed: ${message}\n`);
    process.exit(0);
  }

  for (const d of engine.diagnostics) {
    process.stderr.write(`[Module Gate] ${d.message}\n`);
  }

  if (engine.index.contracts.length === 0) {
    process.stderr.write("[Module Gate] No module descriptor files found. Gates are not active.\n");
    process.exit(0);
  }

  const result = engine.checkEdit(filePath, [{ oldText: before, newText: after }], {
    beforeOverride: before,
  });

  if (result?.block) {
    process.stderr.write(`${result.reason}\n`);
    process.exit(2);
  }

  process.exit(0);
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`[Module Gate] hook internal error: ${message}\n`);
  process.exit(0);
});
