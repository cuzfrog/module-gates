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

function runSessionStart(stdinObj: unknown, cwd?: string) {
  return spawnSync("node", [RUN, "session-start"], {
    input: JSON.stringify(stdinObj),
    encoding: "utf-8",
    timeout: 30_000,
    cwd,
  });
}

describe("session-start hook", () => {
  it("outputs additionalContext for a session start", () => {
    const r = runSessionStart({ hook_event_name: "SessionStart" }, FIXTURES);
    expect(r.status).toBe(0);
    const parsed = JSON.parse(r.stdout);
    expect(parsed.hookSpecificOutput.hookEventName).toBe("SessionStart");
    expect(typeof parsed.hookSpecificOutput.additionalContext).toBe("string");
  });

  it("exits 0 for non-SessionStart events", () => {
    const r = runSessionStart({ hook_event_name: "PreToolUse" }, FIXTURES);
    expect(r.status).toBe(0);
    expect(r.stdout).toBe("");
  });

  it("fails open on malformed JSON", () => {
    const r = spawnSync("node", [RUN, "session-start"], {
      input: "not json",
      encoding: "utf-8",
      timeout: 30_000,
    });
    expect(r.status).toBe(0);
  });
});
