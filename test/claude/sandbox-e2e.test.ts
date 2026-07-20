import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { spawnSync } from "node:child_process";

const RUN = path.resolve("src/bridges/claude/run.mjs");
const BIN = path.resolve("bin/module-gates.mjs");
const HOOK_MARKER = "@cuzfrog/module-gates";

beforeAll(() => {
  if (!fs.existsSync(RUN)) {
    throw new Error(`${RUN} not found.`);
  }
  if (!fs.existsSync(BIN)) {
    throw new Error(`${BIN} not found.`);
  }
});

let tmp: string;
beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "pmg-sandbox-"));
});
afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

function write(rel: string, content: string): string {
  const abs = path.join(tmp, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content, "utf-8");
  return abs;
}

function materializeProject(): void {
  write("module.md", "Sandbox root module.\n");
  write(
    ".pi/settings.json",
    JSON.stringify({
      "module-gates": {
        moduleDescriptorFileName: "module.md",
        sourceRoots: ["src/"],
      },
    }) + "\n",
  );
  write(
    "src/module.md",
    [
      "---",
      "readonly: [locked.ts]",
      "no-new-exports: [no-new-exports.ts]",
      "---",
      "",
      "Sandbox inner module exercising both gates.",
      "",
    ].join("\n"),
  );
  write("src/locked.ts", "export const LOCKED = 1;\n");
  write("src/no-new-exports.ts", "export function existingFn() { return 1; }\n");
  write("src/app.ts", "export const app = 1;\n");
}

function runHook(stdinObj: unknown) {
  return spawnSync("node", [RUN, "pre-tool-use"], {
    input: JSON.stringify(stdinObj),
    encoding: "utf-8",
    timeout: 30_000,
    cwd: tmp,
  });
}

describe("sandbox e2e: install + both gates", () => {
  it("installs the hook and exercises readonly and no-new-exports deny+allow", { timeout: 60_000 }, () => {
    materializeProject();

    const install = spawnSync(BIN, ["install-claude", "--project-dir", tmp], {
      encoding: "utf-8",
      timeout: 15_000,
    });
    expect(install.status).toBe(0);

    const settingsPath = path.join(tmp, ".claude", "settings.json");
    expect(fs.existsSync(settingsPath)).toBe(true);
    const settings = JSON.parse(fs.readFileSync(settingsPath, "utf-8"));
    const pre = settings.hooks?.PreToolUse ?? [];
    expect(
      pre.some((m: { hooks: { command: string }[] }) =>
        m.hooks.some((h) => typeof h.command === "string" && h.command.includes(HOOK_MARKER)),
      ),
    ).toBe(true);

    const writeLocked = runHook({
      hook_event_name: "PreToolUse",
      tool_name: "Write",
      tool_input: { file_path: "src/locked.ts", content: "export const X = 2;\n" },
      cwd: tmp,
    });
    expect(writeLocked.status).toBe(2);
    expect(writeLocked.stderr.toLowerCase()).toContain("blocked");

    const writeOpen = runHook({
      hook_event_name: "PreToolUse",
      tool_name: "Write",
      tool_input: { file_path: "src/app.ts", content: "export const app = 2;\n" },
      cwd: tmp,
    });
    expect(writeOpen.status).toBe(0);

    const writeNoNewExportsAddExport = runHook({
      hook_event_name: "PreToolUse",
      tool_name: "Write",
      tool_input: {
        file_path: "src/no-new-exports.ts",
        content: "export function existingFn() { return 1; }\nexport function leaky() { return 2; }\n",
      },
      cwd: tmp,
    });
    expect(writeNoNewExportsAddExport.status).toBe(2);
    expect(writeNoNewExportsAddExport.stderr.toLowerCase()).toContain("no-new-exports");

    const editNoNewExportsInPlace = runHook({
      hook_event_name: "PreToolUse",
      tool_name: "Edit",
      tool_input: {
        file_path: "src/no-new-exports.ts",
        old_string: "return 1;",
        new_string: "return 2;",
      },
      cwd: tmp,
    });
    expect(editNoNewExportsInPlace.status).toBe(0);
  });
});
