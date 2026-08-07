import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

type DevinPostToolUseEvent = {
  hook_event_name?: string;
  tool_name?: string;
  tool_use_id?: string;
  session_id?: string;
};

type Sidecar = {
  additionalContext: string;
};

async function main(): Promise<void> {
  let raw: string;
  try {
    raw = fs.readFileSync(0, "utf-8");
  } catch {
    process.exit(0);
  }

  let event: DevinPostToolUseEvent;
  try {
    event = JSON.parse(raw);
  } catch {
    process.exit(0);
  }

  if (event.hook_event_name !== "PostToolUse") process.exit(0);

  const sidecarPath = getSidecarPath(event.session_id, event.tool_use_id);
  if (!sidecarPath || !fs.existsSync(sidecarPath)) process.exit(0);

  let sidecar: Partial<Sidecar> = {};
  try {
    sidecar = JSON.parse(fs.readFileSync(sidecarPath, "utf-8"));
  } catch {
    // corrupted sidecar, ignore
  }

  try {
    fs.rmSync(sidecarPath, { force: true });
  } catch {
    // best-effort cleanup
  }

  if (!sidecar.additionalContext) process.exit(0);

  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PostToolUse",
        additionalContext: sidecar.additionalContext,
      },
    }),
  );
  process.exit(0);
}

function getSidecarPath(sessionId: string | undefined, toolUseId: string | undefined): string {
  if (!sessionId || !toolUseId) return "";
  const base = path.join(os.tmpdir(), "module-gates-devin", sessionId);
  const safe = toolUseId.replace(/[^a-zA-Z0-9_-]/g, "_");
  return path.join(base, `${safe}.json`);
}

main().catch(() => {
  process.exit(0);
});
