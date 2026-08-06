import { describe, it, expect, beforeAll } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { spawnSync } from "node:child_process";
import { FIXTURES } from "../../../test/behavior/helpers.ts";

const RUN = path.resolve("src/bridges/devin/run.mjs");

beforeAll(() => {
  if (!fs.existsSync(RUN)) {
    throw new Error(`${RUN} not found.`);
  }
});

function runHook(stdinObj: unknown, cwd?: string) {
  return spawnSync("node", [RUN, "pre-tool-use"], {
    input: JSON.stringify(stdinObj),
    encoding: "utf-8",
    timeout: 30_000,
    cwd,
  });
}

describe("pre-tool-use hook", () => {
  it("exits 0 for unrelated tools", () => {
    const r = runHook({ hook_event_name: "PreToolUse", tool_name: "read", tool_input: { file_path: "x" } });
    expect(r.status).toBe(0);
  });

  it("exits 2 and writes denial for write to readonly file", () => {
    const r = runHook(
      {
        hook_event_name: "PreToolUse",
        tool_name: "write",
        tool_input: { file_path: "src/config.ts", content: "// new" },
      },
      FIXTURES,
    );
    expect(r.status).toBe(2);
    expect(r.stdout).toContain("Readonly rule");
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
    expect(r.status).toBe(2);
    expect(r.stdout).toContain("Readonly rule");
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

  it("blocks apply_patch that writes a readonly file", () => {
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
    expect(r.status).toBe(2);
    expect(r.stdout).toContain("Readonly rule");
  });
});
