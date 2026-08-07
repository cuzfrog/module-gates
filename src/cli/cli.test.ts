import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { spawnSync } from "node:child_process";
import { FIXTURES } from "../../test/behavior/helpers.ts";

const BIN = path.resolve("bin/module-gates.mjs");
const RUN = path.resolve("src/bridges/claude/run.mjs");
const DEVIN_RUN = path.resolve("src/bridges/devin/run.mjs");

let tmp: string;
beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "pmg-cli-"));
});
afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

function cli(...args: string[]) {
  return spawnSync(BIN, args, { encoding: "utf-8", timeout: 30_000 });
}

describe("module-gates CLI", () => {
  it("install-claude writes settings.json with the marker", () => {
    const r = cli("install-claude", "--project-dir", tmp);
    expect(r.status).toBe(0);
    const settingsPath = path.join(tmp, ".claude", "settings.json");
    expect(fs.existsSync(settingsPath)).toBe(true);
    const json = JSON.parse(fs.readFileSync(settingsPath, "utf-8"));
    const pre = json.hooks?.PreToolUse ?? [];
    expect(pre.some((m: { hooks: { command: string }[] }) => m.hooks.some((h) => h.command.includes("@cuzfrog/module-gates")))).toBe(true);
  });

  it("install-claude is idempotent", () => {
    cli("install-claude", "--project-dir", tmp);
    cli("install-claude", "--project-dir", tmp);
    const json = JSON.parse(fs.readFileSync(path.join(tmp, ".claude", "settings.json"), "utf-8"));
    const pre = json.hooks?.PreToolUse ?? [];
    expect(pre.filter((m: { hooks: { command: string }[] }) => m.hooks.some((h) => h.command.includes("@cuzfrog/module-gates")))).toHaveLength(1);
  });

  it("install-claude preserves unrelated settings keys", () => {
    fs.mkdirSync(path.join(tmp, ".claude"), { recursive: true });
    fs.writeFileSync(path.join(tmp, ".claude", "settings.json"), JSON.stringify({ permissions: { allow: ["Bash"] } }, null, 2));
    cli("install-claude", "--project-dir", tmp);
    const json = JSON.parse(fs.readFileSync(path.join(tmp, ".claude", "settings.json"), "utf-8"));
    expect(json.permissions).toEqual({ allow: ["Bash"] });
  });

  it("uninstall-claude removes the marker entry", () => {
    cli("install-claude", "--project-dir", tmp);
    cli("uninstall-claude", "--project-dir", tmp);
    const json = JSON.parse(fs.readFileSync(path.join(tmp, ".claude", "settings.json"), "utf-8"));
    const pre = json.hooks?.PreToolUse ?? [];
    expect(pre.filter((m: { hooks: { command: string }[] }) => m.hooks.some((h) => h.command.includes("@cuzfrog/module-gates")))).toHaveLength(0);
  });

  it("end-to-end: install, invoke hook, deny on readonly, uninstall", () => {
    cli("install-claude", "--project-dir", FIXTURES);
    const payload = {
      hook_event_name: "PreToolUse",
      tool_name: "Write",
      tool_input: { file_path: "src/config.ts", content: "// modified" },
      cwd: FIXTURES,
    };
    const hook = spawnSync("node", [RUN, "pre-tool-use"], {
      input: JSON.stringify(payload),
      encoding: "utf-8",
      timeout: 30_000,
      cwd: FIXTURES,
    });
    expect(hook.status).toBe(2);
    expect(hook.stderr).toContain("Readonly rule");
    cli("uninstall-claude", "--project-dir", FIXTURES);
    const after = JSON.parse(fs.readFileSync(path.join(FIXTURES, ".claude", "settings.json"), "utf-8"));
    const pre = after.hooks?.PreToolUse ?? [];
    expect(pre.filter((m: { hooks: { command: string }[] }) => m.hooks.some((h) => h.command.includes("@cuzfrog/module-gates")))).toHaveLength(0);
    fs.rmSync(path.join(FIXTURES, ".claude"), { recursive: true, force: true });
  });

  it("install-devin writes hooks.v1.json with PreToolUse and PostToolUse", () => {
    const r = cli("install-devin", "--project-dir", tmp);
    expect(r.status).toBe(0);
    const hooksPath = path.join(tmp, ".devin", "hooks.v1.json");
    expect(fs.existsSync(hooksPath)).toBe(true);
    const json = JSON.parse(fs.readFileSync(hooksPath, "utf-8"));
    const pre = json.PreToolUse ?? [];
    const post = json.PostToolUse ?? [];
    expect(pre.some((m: { hooks: { command: string }[] }) => m.hooks.some((h) => h.command.includes("@cuzfrog/module-gates")))).toBe(true);
    expect(post.some((m: { hooks: { command: string }[] }) => m.hooks.some((h) => h.command.includes("@cuzfrog/module-gates")))).toBe(true);
  });

  it("uninstall-devin removes the marker entries", () => {
    cli("install-devin", "--project-dir", tmp);
    cli("uninstall-devin", "--project-dir", tmp);
    const json = JSON.parse(fs.readFileSync(path.join(tmp, ".devin", "hooks.v1.json"), "utf-8"));
    const pre = json.PreToolUse ?? [];
    const post = json.PostToolUse ?? [];
    expect(pre.filter((m: { hooks: { command: string }[] }) => m.hooks.some((h) => h.command.includes("@cuzfrog/module-gates")))).toHaveLength(0);
    expect(post.filter((m: { hooks: { command: string }[] }) => m.hooks.some((h) => h.command.includes("@cuzfrog/module-gates")))).toHaveLength(0);
  });

  it("end-to-end: install devin, invoke write hook, rewrite to no-op and produce sidecar, uninstall", () => {
    cli("install-devin", "--project-dir", FIXTURES);
    const payload = {
      hook_event_name: "PreToolUse",
      tool_name: "write",
      tool_input: { file_path: "src/config.ts", content: "// modified" },
      session_id: "cli-test-session",
      tool_use_id: "functions.write:0",
    };
    const hook = spawnSync("node", [DEVIN_RUN, "pre-tool-use"], {
      input: JSON.stringify(payload),
      encoding: "utf-8",
      timeout: 30_000,
      cwd: FIXTURES,
    });
    expect(hook.status).toBe(0);
    const parsed = JSON.parse(hook.stdout);
    expect(parsed.decision).toBe("approve");
    expect(parsed.hookSpecificOutput.updatedInput.file_path).toBe(
      path.resolve(FIXTURES, ".devin/module-gates/blocked"),
    );
    expect(hook.stderr).toContain("Readonly rule");

    const sidecarPath = path.join(
      os.tmpdir(),
      "module-gates-devin",
      "cli-test-session",
      "functions_write_0.json",
    );
    expect(fs.existsSync(sidecarPath)).toBe(true);

    const post = spawnSync("node", [DEVIN_RUN, "post-tool-use"], {
      input: JSON.stringify({
        hook_event_name: "PostToolUse",
        tool_name: "write",
        tool_use_id: "functions.write:0",
        session_id: "cli-test-session",
      }),
      encoding: "utf-8",
      timeout: 30_000,
    });
    expect(post.status).toBe(0);
    const postParsed = JSON.parse(post.stdout);
    expect(postParsed.hookSpecificOutput.hookEventName).toBe("PostToolUse");
    expect(postParsed.hookSpecificOutput.additionalContext).toContain("Readonly rule");

    cli("uninstall-devin", "--project-dir", FIXTURES);
    const after = JSON.parse(fs.readFileSync(path.join(FIXTURES, ".devin", "hooks.v1.json"), "utf-8"));
    const pre = after.PreToolUse ?? [];
    const postHooks = after.PostToolUse ?? [];
    expect(pre.filter((m: { hooks: { command: string }[] }) => m.hooks.some((h) => h.command.includes("@cuzfrog/module-gates")))).toHaveLength(0);
    expect(postHooks.filter((m: { hooks: { command: string }[] }) => m.hooks.some((h) => h.command.includes("@cuzfrog/module-gates")))).toHaveLength(0);
    fs.rmSync(path.join(FIXTURES, ".devin"), { recursive: true, force: true });
    fs.rmSync(path.join(os.tmpdir(), "module-gates-devin", "cli-test-session"), {
      recursive: true,
      force: true,
    });
  });
});
