import { describe, it, expect, beforeAll, afterEach } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { spawnSync } from "node:child_process";
import { FIXTURES } from "../../../test/behavior/helpers.ts";

const RUN = path.resolve("src/bridges/devin/run.mjs");

beforeAll(() => {
  if (!fs.existsSync(RUN)) {
    throw new Error(`${RUN} not found.`);
  }
});

afterEach(() => {
  fs.rmSync(path.join(FIXTURES, ".devin", "module-gates", "blocked"), {
    recursive: true,
    force: true,
  });
  fs.rmSync(path.join(os.tmpdir(), "module-gates-devin", "test-session"), {
    recursive: true,
    force: true,
  });
});

function runHook(stdinObj: unknown, cwd?: string) {
  const withIds = {
    session_id: "test-session",
    tool_use_id: "functions.write:0",
    ...(stdinObj as Record<string, unknown>),
  };
  return spawnSync("node", [RUN, "pre-tool-use"], {
    input: JSON.stringify(withIds),
    encoding: "utf-8",
    timeout: 30_000,
    cwd,
  });
}

function sidecarPath(sessionId: string, toolUseId: string): string {
  const safe = toolUseId.replace(/[^a-zA-Z0-9_-]/g, "_");
  return path.join(os.tmpdir(), "module-gates-devin", sessionId, `${safe}.json`);
}

describe("pre-tool-use hook", () => {
  it("exits 0 for unrelated tools", () => {
    const r = runHook({ hook_event_name: "PreToolUse", tool_name: "read", tool_input: { file_path: "x" } });
    expect(r.status).toBe(0);
  });

  it("rewrites blocked write to a no-op sentinel and writes a sidecar", () => {
    const r = runHook(
      {
        hook_event_name: "PreToolUse",
        tool_name: "write",
        tool_input: { file_path: "src/config.ts", content: "// new" },
      },
      FIXTURES,
    );
    expect(r.status).toBe(0);
    const parsed = JSON.parse(r.stdout);
    expect(parsed.decision).toBe("approve");
    expect(parsed.hookSpecificOutput.hookEventName).toBe("PreToolUse");
    expect(parsed.hookSpecificOutput.updatedInput.file_path).toBe(
      path.resolve(FIXTURES, ".devin/module-gates/blocked"),
    );
    expect(r.stderr).toContain("Readonly rule");

    const sidecar = sidecarPath("test-session", "functions.write:0");
    expect(fs.existsSync(sidecar)).toBe(true);
    const context = JSON.parse(fs.readFileSync(sidecar, "utf-8")).additionalContext;
    expect(context).toContain("Readonly rule");
    expect(context).toContain("No files were modified");
  });

  it("exits 0 for write to an editable file", () => {
    const r = runHook(
      {
        hook_event_name: "PreToolUse",
        tool_name: "write",
        tool_input: { file_path: "src/app.ts", content: "export function greet() { return 1; }" },
      },
      FIXTURES,
    );
    expect(r.status).toBe(0);
    expect(r.stdout).toBe("");
  });

  it("handles edit", () => {
    const r = runHook(
      {
        hook_event_name: "PreToolUse",
        tool_name: "edit",
        tool_input: { file_path: "src/config.ts", old_string: "API_URL", new_string: "DIFFERENT_URL" },
      },
      FIXTURES,
    );
    expect(r.status).toBe(0);
    const parsed = JSON.parse(r.stdout);
    expect(parsed.decision).toBe("approve");
    expect(parsed.hookSpecificOutput.updatedInput.file_path).toBe(
      path.resolve(FIXTURES, ".devin/module-gates/blocked"),
    );
    expect(r.stderr).toContain("Readonly rule");
  });

  it("replaces all occurrences when replace_all is true", () => {
    const r = runHook(
      {
        hook_event_name: "PreToolUse",
        tool_name: "edit",
        tool_input: {
          file_path: "src/app.ts",
          old_string: "foo",
          new_string: "bar",
          replace_all: true,
        },
      },
      FIXTURES,
    );
    expect(r.status).toBe(0);
    expect(r.stdout).toBe("");
  });

  it("exits 0 for non-PreToolUse events", () => {
    const r = runHook({ hook_event_name: "SessionStart", tool_name: "write", tool_input: {} });
    expect(r.status).toBe(0);
  });

  it("fails open on malformed JSON", () => {
    const r = spawnSync("node", [RUN, "pre-tool-use"], {
      input: "not json",
      encoding: "utf-8",
      timeout: 30_000,
    });
    expect(r.status).toBe(0);
    expect(r.stderr).toContain("[Module Gate]");
  });

  it("rewrites blocked apply_patch to an invalid patch", () => {
    const patch = [
      "*** Update File: src/config.ts",
      "+// new content",
      "*** End of File",
    ].join("\n");
    const r = runHook(
      {
        hook_event_name: "PreToolUse",
        tool_name: "apply_patch",
        tool_input: { raw_patch: patch },
      },
      FIXTURES,
    );
    expect(r.status).toBe(0);
    const parsed = JSON.parse(r.stdout);
    expect(parsed.decision).toBe("approve");
    expect(parsed.hookSpecificOutput.updatedInput.raw_patch).toContain("module-gates blocked");
    expect(r.stderr).toContain("Readonly rule");
  });
});
