import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { spawnSync } from "node:child_process";

const HOOK = path.resolve("src/claude/pre-tool-use.ts");
const BIN = path.resolve("bin/pi-module-gates.mjs");
const HOOK_MARKER = "@cuzfrog/pi-module-gates";

beforeAll(() => {
  if (!fs.existsSync(HOOK)) {
    throw new Error(`${HOOK} not found.`);
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
      "sealed: [sealed.ts]",
      "visible: [greet]",
      "---",
      "",
      "Sandbox inner module exercising all three gates.",
      "",
    ].join("\n"),
  );
  write("src/locked.ts", "export const LOCKED = 1;\n");
  write("src/sealed.ts", "export function existingFn() { return 1; }\n");
  write("src/greet.ts", "export function greet(name: string) { return name; }\n");
  write("src/app.ts", "export const app = 1;\n");
}

function runHook(stdinObj: unknown) {
  return spawnSync("bun", [HOOK], {
    input: JSON.stringify(stdinObj),
    encoding: "utf-8",
    timeout: 30_000,
    cwd: tmp,
  });
}

describe("sandbox e2e: install + all three gates", () => {
  it("installs the hook and exercises readonly, sealed, visible deny+allow", { timeout: 60_000 }, () => {
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

    const writeSealedAddExport = runHook({
      hook_event_name: "PreToolUse",
      tool_name: "Write",
      tool_input: {
        file_path: "src/sealed.ts",
        content: "export function existingFn() { return 1; }\nexport function leaky() { return 2; }\n",
      },
      cwd: tmp,
    });
    expect(writeSealedAddExport.status).toBe(2);
    expect(writeSealedAddExport.stderr.toLowerCase()).toContain("sealed");

    const editSealedInPlace = runHook({
      hook_event_name: "PreToolUse",
      tool_name: "Edit",
      tool_input: {
        file_path: "src/sealed.ts",
        old_string: "return 1;",
        new_string: "return 2;",
      },
      cwd: tmp,
    });
    expect(editSealedInPlace.status).toBe(0);

    const writeVisibleAddExport = runHook({
      hook_event_name: "PreToolUse",
      tool_name: "Write",
      tool_input: {
        file_path: "src/greet.ts",
        content: "export function greet(name: string) { return name; }\nexport function leaky() { return 1; }\n",
      },
      cwd: tmp,
    });
    expect(writeVisibleAddExport.status).toBe(2);
    const stderr = writeVisibleAddExport.stderr.toLowerCase();
    expect(stderr.includes("visible") || stderr.includes("export")).toBe(true);

    const writeVisibleOnlyGreet = runHook({
      hook_event_name: "PreToolUse",
      tool_name: "Write",
      tool_input: {
        file_path: "src/greet.ts",
        content: "export function greet(name: string) { return name; }\n",
      },
      cwd: tmp,
    });
    expect(writeVisibleOnlyGreet.status).toBe(0);
  });
});
