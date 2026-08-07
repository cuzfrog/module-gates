import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { spawnSync } from "node:child_process";

const RUN = path.resolve("src/bridges/devin/run.mjs");
const TEST_SESSION = "post-tool-use-test";

beforeAll(() => {
  if (!fs.existsSync(RUN)) {
    throw new Error(`${RUN} not found.`);
  }
});

beforeEach(() => {
  fs.rmSync(path.join(os.tmpdir(), "module-gates-devin", TEST_SESSION), {
    recursive: true,
    force: true,
  });
});

afterEach(() => {
  fs.rmSync(path.join(os.tmpdir(), "module-gates-devin", TEST_SESSION), {
    recursive: true,
    force: true,
  });
});

function runHook(stdinObj: unknown) {
  return spawnSync("node", [RUN, "post-tool-use"], {
    input: JSON.stringify(stdinObj),
    encoding: "utf-8",
    timeout: 30_000,
  });
}

function sidecarPath(sessionId: string, toolUseId: string): string {
  const safe = toolUseId.replace(/[^a-zA-Z0-9_-]/g, "_");
  return path.join(os.tmpdir(), "module-gates-devin", sessionId, `${safe}.json`);
}

function writeSidecar(sessionId: string, toolUseId: string, context: string): string {
  const sp = sidecarPath(sessionId, toolUseId);
  fs.mkdirSync(path.dirname(sp), { recursive: true });
  fs.writeFileSync(sp, JSON.stringify({ additionalContext: context }));
  return sp;
}

describe("post-tool-use hook", () => {
  it("emits additionalContext from an existing sidecar and deletes it", () => {
    writeSidecar(TEST_SESSION, "functions.write:0", "Blocked by module-gates.");
    const r = runHook({
      hook_event_name: "PostToolUse",
      tool_name: "write",
      tool_use_id: "functions.write:0",
      session_id: TEST_SESSION,
    });
    expect(r.status).toBe(0);
    const parsed = JSON.parse(r.stdout);
    expect(parsed.hookSpecificOutput.hookEventName).toBe("PostToolUse");
    expect(parsed.hookSpecificOutput.additionalContext).toBe("Blocked by module-gates.");
    expect(fs.existsSync(sidecarPath(TEST_SESSION, "functions.write:0"))).toBe(false);
  });

  it("exits silently when no sidecar exists", () => {
    const r = runHook({
      hook_event_name: "PostToolUse",
      tool_name: "write",
      tool_use_id: "functions.write:0",
      session_id: TEST_SESSION,
    });
    expect(r.status).toBe(0);
    expect(r.stdout).toBe("");
  });

  it("exits 0 for non-PostToolUse events", () => {
    const r = runHook({ hook_event_name: "PreToolUse", tool_name: "write" });
    expect(r.status).toBe(0);
    expect(r.stdout).toBe("");
  });

  it("fails open on malformed JSON", () => {
    const r = spawnSync("node", [RUN, "post-tool-use"], {
      input: "not json",
      encoding: "utf-8",
      timeout: 30_000,
    });
    expect(r.status).toBe(0);
    expect(r.stdout).toBe("");
  });
});
