import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
  readSettings,
  upsertHooks,
  removeHooks,
  writeSettings,
  HOOK_MARKER,
} from "./settings-writer.ts";

let tmp: string;
beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "pmg-settings-"));
});
afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

function markerCount(matchers: { hooks: { command?: string }[] }[] | undefined): number {
  return (matchers ?? []).filter((m) =>
    m.hooks.some((h) => typeof h.command === "string" && h.command.includes(HOOK_MARKER)),
  ).length;
}

describe("settings writer", () => {
  it("upsert on empty produces marker entries for both events", () => {
    const result = upsertHooks({});
    const pre = result.hooks?.PreToolUse ?? [];
    const session = result.hooks?.SessionStart ?? [];
    expect(pre).toHaveLength(1);
    expect(pre[0].matcher).toBe("Edit|MultiEdit|Write");
    expect(pre[0].hooks[0].command).toContain(HOOK_MARKER);
    expect(pre[0].hooks[0].command).toContain("${CLAUDE_PROJECT_DIR}");
    expect(pre[0].hooks[0].command).toContain("pre-tool-use");
    expect(session).toHaveLength(1);
    expect(session[0].matcher).toBe("startup|resume|clear");
    expect(session[0].hooks[0].command).toContain("session-start");
  });

  it("is idempotent", () => {
    const a = upsertHooks({});
    const b = upsertHooks(a);
    expect(markerCount(b.hooks?.PreToolUse)).toBe(1);
    expect(markerCount(b.hooks?.SessionStart)).toBe(1);
  });

  it("preserves unrelated top-level keys", () => {
    const a = upsertHooks({ permissions: { allow: ["Bash"] }, model: "sonnet" });
    expect(a.permissions).toEqual({ allow: ["Bash"] });
    expect(a.model).toBe("sonnet");
  });

  it("preserves other hook events", () => {
    const a = upsertHooks({
      hooks: {
        PostToolUse: [{ matcher: "*", hooks: [{ type: "command", command: "echo done" }] }],
      },
    });
    expect(a.hooks?.PostToolUse).toHaveLength(1);
    expect(a.hooks?.PreToolUse).toHaveLength(1);
    expect(a.hooks?.SessionStart).toHaveLength(1);
  });

  it("remove strips only marker entries", () => {
    const a = upsertHooks({
      hooks: {
        PreToolUse: [
          { matcher: "*", hooks: [{ type: "command", command: "echo other" }] },
        ],
      },
    });
    const b = removeHooks(a);
    const pre = b.hooks?.PreToolUse ?? [];
    expect(pre).toHaveLength(1);
    expect(pre[0].hooks[0].command).toBe("echo other");
    expect(b.hooks?.SessionStart).toBeUndefined();
  });

  it("remove on marker-only yields empty settings", () => {
    const a = upsertHooks({});
    const b = removeHooks(a);
    expect(b.hooks?.PreToolUse).toBeUndefined();
    expect(b.hooks?.SessionStart).toBeUndefined();
    expect(b.hooks).toBeUndefined();
  });

  it("writeSettings creates .claude dir and writes JSON", () => {
    const a = upsertHooks({});
    const written = writeSettings(tmp, a);
    expect(written).toBe(path.join(tmp, ".claude", "settings.json"));
    const content = fs.readFileSync(written, "utf-8");
    expect(content).toContain(HOOK_MARKER);
    expect(content.endsWith("\n")).toBe(true);
  });

  it("readSettings returns {} on missing file", () => {
    expect(readSettings(tmp)).toEqual({});
  });

  it("preserves matcher entries with a non-command hook (e.g. type: prompt)", () => {
    const a = upsertHooks({
      hooks: {
        PreToolUse: [
          { matcher: "*", hooks: [{ type: "prompt" }] },
        ],
      },
    });
    const pre = a.hooks?.PreToolUse ?? [];
    const promptMatcher = pre.find((m) => m.matcher === "*");
    expect(promptMatcher).toBeDefined();
    expect(promptMatcher?.hooks[0].type).toBe("prompt");
    const own = pre.find((m) => m.matcher === "Edit|MultiEdit|Write");
    expect(own).toBeDefined();
    const b = removeHooks(a);
    const after = b.hooks?.PreToolUse ?? [];
    expect(after.find((m) => m.matcher === "*")?.hooks[0].type).toBe("prompt");
    expect(after.find((m) => m.matcher === "Edit|MultiEdit|Write")).toBeUndefined();
  });
});
