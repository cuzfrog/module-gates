import { describe, it, expect, beforeEach, vi } from "vitest";
import * as path from "node:path";
import {
  MockExtensionAPI,
  FIXTURES,
  startSession,
  doWrite,
  doEdit,
} from "./helpers.ts";

const { mockedLoadConfig } = vi.hoisted(() => ({
  mockedLoadConfig: vi.fn(),
}));

vi.mock("../../src/config.ts", () => ({
  loadConfig: mockedLoadConfig,
}));

import mod from "../../src/index.ts";
import type { ModuleGateConfig } from "../../src/config.ts";

function setConfig(over: Partial<ModuleGateConfig>): void {
  mockedLoadConfig.mockReturnValue({
    moduleDescriptorFileName: "module.md",
    moduleDescriptorReadonly: "file",
    sourceRoot: "",
    disableModuleInterfaceImportGate: false,
    disableSystemPrompt: false,
    outputModuleProseOnBlock: false,
    ...over,
  });
}

describe("export gating", () => {
  let mock: MockExtensionAPI;

  beforeEach(() => {
    setConfig({ outputModuleProseOnBlock: false });
    mock = new MockExtensionAPI();
    mod(mock);
  });

  describe("write gate", () => {
    it("blocks write to readonly file and includes prose", async () => {
      setConfig({ outputModuleProseOnBlock: true });
      const cwd = path.join(FIXTURES, "src");
      await startSession(mock, cwd);

      const result = await doWrite(mock, "config.ts", "// overwrite", cwd);
      expect((result as any).block).toBe(true);
      expect((result as any).reason).toContain("module.md");
      expect((result as any).reason).toContain("Greeting module");
    });

    it("omits prose by default when blocking a readonly file", async () => {
      const cwd = path.join(FIXTURES, "src");
      await startSession(mock, cwd);

      const result = await doWrite(mock, "config.ts", "// overwrite", cwd);
      expect((result as any).block).toBe(true);
      expect((result as any).reason).not.toContain("Greeting module");
    });

    it("blocks write to module.md itself", async () => {
      const cwd = path.join(FIXTURES, "src");
      await startSession(mock, cwd);

      const result = await doWrite(mock, "module.md", "---", cwd);
      expect((result as any).block).toBe(true);
    });

    it("blocks export not in visible list", async () => {
      const cwd = path.join(FIXTURES, "src");
      await startSession(mock, cwd);

      const result = await doWrite(
        mock,
        "app.ts",
        "export function greet() {}\nexport function hidden() {}",
        cwd,
      );
      expect((result as any).block).toBe(true);
      if (result?.block) {
        expect((result as any).reason).toContain("hidden");
      }
    });

    it("allows export listed in visible", async () => {
      const cwd = path.join(FIXTURES, "src");
      await startSession(mock, cwd);

      const result = await doWrite(
        mock,
        "app.ts",
        "export function greet() {}",
        cwd,
      );
      expect(result?.block).toBeFalsy();
    });
  });

  describe("edit gate", () => {
    it("blocks edit on readonly file", async () => {
      const cwd = path.join(FIXTURES, "src");
      await startSession(mock, cwd);

      const result = await doEdit(
        mock,
        "config.ts",
        [{ oldText: "API_URL", newText: "DIFFERENT_URL" }],
        cwd,
      );
      expect((result as any).block).toBe(true);
    });

    it("blocks edit that introduces new unlisted export", async () => {
      const cwd = path.join(FIXTURES, "src");
      await startSession(mock, cwd);

      const result = await doEdit(
        mock,
        "app.ts",
        [
          {
            oldText: "export function greet(",
            newText: "export function secret() {}\nexport function greet(",
          },
        ],
        cwd,
      );
      expect((result as any).block).toBe(true);
    });
  });
});
