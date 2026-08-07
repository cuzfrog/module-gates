import { describe, it, expect } from "vitest";
import {
  buildPreToolUseEntry,
  buildSessionStartEntry,
  upsertHooks,
  removeHooks,
  HOOK_MARKER,
  PRE_TOOL_USE_MATCHER,
} from "./settings-writer.ts";

describe("buildPreToolUseEntry", () => {
  it("matches write, edit, and apply_patch", () => {
    const entry = buildPreToolUseEntry();
    expect(entry.matcher).toBe("^(write|edit|apply_patch)$");
    expect(entry.hooks[0].command).toContain(HOOK_MARKER);
    expect(entry.hooks[0].command).toContain("pre-tool-use");
    expect(entry.hooks[0].command).toContain("DEVIN_PROJECT_DIR");
  });
});

describe("buildSessionStartEntry", () => {
  it("has no matcher and targets session-start", () => {
    const entry = buildSessionStartEntry();
    expect(entry.matcher).toBeUndefined();
    expect(entry.hooks[0].command).toContain("session-start");
    expect(entry.hooks[0].command).toContain("DEVIN_PROJECT_DIR");
  });
});

describe("upsertHooks", () => {
  it("inserts PreToolUse and SessionStart entries", () => {
    const next = upsertHooks({});
    expect(next.PreToolUse).toHaveLength(1);
    expect(next.SessionStart).toHaveLength(1);
    expect(next.PreToolUse?.[0].hooks[0].command).toContain(HOOK_MARKER);
  });

  it("replaces an existing module-gates entry", () => {
    const existing = {
      PreToolUse: [
        {
          matcher: ".*",
          hooks: [
            {
              type: "command",
              command: `node old.js ${HOOK_MARKER}`,
            },
          ],
        },
      ],
    };
    const next = upsertHooks(existing);
    expect(next.PreToolUse).toHaveLength(1);
    expect(next.PreToolUse?.[0].hooks[0].command).toContain("run.mjs");
  });

  it("preserves unrelated events", () => {
    const existing = {
      PostToolUse: [
        {
          matcher: ".*",
          hooks: [{ type: "command", command: "node other.js" }],
        },
      ],
    };
    const next = upsertHooks(existing);
    expect(next.PostToolUse).toHaveLength(1);
    expect(next.PreToolUse).toHaveLength(1);
  });
});

describe("removeHooks", () => {
  it("removes module-gates entries", () => {
    const before = {
      PreToolUse: [
        {
          matcher: ".*",
          hooks: [{ type: "command", command: `node old.js ${HOOK_MARKER}` }],
        },
      ],
    };
    const after = removeHooks(before);
    expect(after.PreToolUse).toBeUndefined();
  });

  it("preserves unrelated hooks", () => {
    const before = {
      PreToolUse: [
        {
          matcher: ".*",
          hooks: [{ type: "command", command: "node other.js" }],
        },
      ],
    };
    const after = removeHooks(before);
    expect(after.PreToolUse).toHaveLength(1);
  });
});
