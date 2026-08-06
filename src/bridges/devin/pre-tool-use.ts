import * as fs from "node:fs";
import * as path from "node:path";
import {
  createGateEngine,
  readFileSafe,
  type GateDenial,
  type GateEdit,
} from "../../core/index.ts";
import { extractPatchOperations, type PatchOperation } from "./apply-patch.ts";
import { DEVIN_CONFIG_SOURCES } from "./config-sources.ts";

type DevinPreToolUseEvent = {
  hook_event_name?: string;
  tool_name?: string;
  tool_input?: unknown;
};

type DevinEditInput = {
  file_path?: string;
  old_string?: string;
  new_string?: string;
  replace_all?: boolean;
};

type DevinWriteInput = {
  file_path?: string;
  content?: string;
};

type FileEdit = {
  filePath: string;
  before: string;
  after: string;
};

async function main(): Promise<void> {
  let raw: string;
  try {
    raw = fs.readFileSync(0, "utf-8");
  } catch {
    process.exit(0);
  }

  let event: DevinPreToolUseEvent;
  try {
    event = JSON.parse(raw);
  } catch {
    process.stderr.write("[Module Gate] hook: invalid JSON input; allowing tool call.\n");
    process.exit(0);
  }

  if (event.hook_event_name !== "PreToolUse") process.exit(0);
  if (
    event.tool_name !== "write" &&
    event.tool_name !== "edit" &&
    event.tool_name !== "apply_patch"
  ) {
    process.exit(0);
  }

  const cwd = process.env.DEVIN_PROJECT_DIR ?? process.cwd();

  let fileEdits: FileEdit[];
  try {
    fileEdits = extractFileEdits(event, cwd);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`[Module Gate] could not parse tool input: ${message}\n`);
    process.exit(0);
  }

  if (fileEdits.length === 0) process.exit(0);

  let engine;
  try {
    engine = await createGateEngine(cwd, { configSources: DEVIN_CONFIG_SOURCES });
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

  const denials: GateDenial[] = [];
  for (const { filePath, before, after } of fileEdits) {
    const result = engine.checkEdit(
      filePath,
      [{ oldText: before, newText: after } as GateEdit],
      { beforeOverride: before },
    );
    if (result) denials.push(result);
  }

  if (denials.length > 0) {
    const reason = denials.map((d) => d.reason).join("\n\n");
    process.stdout.write(JSON.stringify({ decision: "block", reason }));
    process.stderr.write(`[Module Gate] ${reason}\n`);
    process.exit(2);
  }

  process.exit(0);
}

function extractFileEdits(event: DevinPreToolUseEvent, cwd: string): FileEdit[] {
  const toolInput = event.tool_input ?? {};

  if (event.tool_name === "write") {
    const input = toolInput as DevinWriteInput;
    if (!input.file_path) return [];
    const absPath = path.resolve(cwd, input.file_path);
    return [{ filePath: input.file_path, before: readFileSafe(absPath), after: input.content ?? "" }];
  }

  if (event.tool_name === "edit") {
    const input = toolInput as DevinEditInput;
    if (!input.file_path) return [];
    const absPath = path.resolve(cwd, input.file_path);
    const before = readFileSafe(absPath);
    const after = computeEditAfter(before, input);
    return [{ filePath: input.file_path, before, after }];
  }

  const rawPatch = extractRawPatch(toolInput);
  if (!rawPatch) return [];

  const operations = extractPatchOperations(rawPatch, (p) => readFileSafe(p), cwd);
  return operations.map((op) => ({ filePath: op.filePath, before: op.before, after: op.after }));
}

function computeEditAfter(before: string, input: DevinEditInput): string {
  const oldText = input.old_string ?? "";
  const newText = input.new_string ?? "";

  if (oldText === "") return before;

  if (input.replace_all) {
    return before.split(oldText).join(newText);
  }

  return before.replace(oldText, newText);
}

function extractRawPatch(toolInput: unknown): string | undefined {
  if (typeof toolInput === "string") return toolInput;
  if (!toolInput || typeof toolInput !== "object" || Array.isArray(toolInput)) return undefined;

  const candidate = (toolInput as Record<string, unknown>).raw_patch;
  if (typeof candidate === "string") return candidate;

  const patch = (toolInput as Record<string, unknown>).patch;
  if (typeof patch === "string") return patch;

  return undefined;
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`[Module Gate] hook internal error: ${message}\n`);
  process.exit(0);
});
