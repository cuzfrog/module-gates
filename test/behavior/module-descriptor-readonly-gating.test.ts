import { describe, it, expect, beforeEach, vi } from "vitest";
import * as path from "node:path";
import {
  MockExtensionAPI,
  FIXTURES,
  startSession,
  doWrite,
  doEdit,
} from "./helpers.ts";
import type { ModuleGateConfig } from "../../src/config.ts";

const { mockedLoadConfig } = vi.hoisted(() => ({
  mockedLoadConfig: vi.fn(),
}));

vi.mock("../../src/config.ts", () => ({
  loadConfig: mockedLoadConfig,
}));

import mod from "../../src/index.ts";

function setReadonlyMode(mode: ModuleGateConfig["moduleDescriptorReadonly"]): void {
  mockedLoadConfig.mockReturnValue({
    moduleDescriptorFileName: "module.md",
    moduleDescriptorReadonly: mode,
    sourceRoot: "",
    disableModuleInterfaceImportGate: false,
    disableSystemPrompt: false,
    outputModuleProseOnBlock: false,
  });
}

const FRONTMATTER_BODY_WRITE = "---\nreadonly: [locked.ts, extra.ts]\n---\nThis is the body.";
const FRONTMATTER_ONLY_BODY_WRITE = "---\nreadonly: [locked.ts]\n---\nUpdated body text only.";
const BODY_OLD = "This is the body text. It can be edited in frontmatter mode.";
const BODY_NEW = "New body text.";
const FRONTMATTER_OLD = "readonly: [locked.ts]";
const FRONTMATTER_NEW = "readonly: [locked.ts, extra.ts]";

describe("module descriptor readonly gating (e2e across 3 modes)", () => {
  let mock: MockExtensionAPI;

  beforeEach(() => {
    mock = new MockExtensionAPI();
    mod(mock);
  });

  describe('mode: "file" (whole descriptor is locked)', () => {
    beforeEach(() => {
      setReadonlyMode("file");
    });

    it("blocks write that changes frontmatter of module.md", async () => {
      const cwd = path.join(FIXTURES, "frontmatter-test");
      await startSession(mock, cwd);
      const result = await doWrite(mock, "module.md", FRONTMATTER_BODY_WRITE, cwd);
      expect(result).toBeDefined();
      expect(result!.block).toBe(true);
      expect((result as any).reason).toContain("Readonly rule");
    });

    it("blocks write that changes only the body of module.md", async () => {
      const cwd = path.join(FIXTURES, "frontmatter-test");
      await startSession(mock, cwd);
      const result = await doWrite(mock, "module.md", FRONTMATTER_ONLY_BODY_WRITE, cwd);
      expect(result).toBeDefined();
      expect(result!.block).toBe(true);
      expect((result as any).reason).toContain("Readonly rule");
    });

    it("blocks edit that changes only the body of module.md", async () => {
      const cwd = path.join(FIXTURES, "frontmatter-test");
      await startSession(mock, cwd);
      const result = await doEdit(mock, "module.md", [
        { oldText: BODY_OLD, newText: BODY_NEW },
      ], cwd);
      expect(result).toBeDefined();
      expect(result!.block).toBe(true);
    });

    it("blocks edit that changes frontmatter of module.md", async () => {
      const cwd = path.join(FIXTURES, "frontmatter-test");
      await startSession(mock, cwd);
      const result = await doEdit(mock, "module.md", [
        { oldText: FRONTMATTER_OLD, newText: FRONTMATTER_NEW },
      ], cwd);
      expect(result).toBeDefined();
      expect(result!.block).toBe(true);
    });
  });

  describe('mode: "frontmatter" (default — only frontmatter is locked)', () => {
    beforeEach(() => {
      setReadonlyMode("frontmatter");
    });

    it("blocks write that changes frontmatter of module.md", async () => {
      const cwd = path.join(FIXTURES, "frontmatter-test");
      await startSession(mock, cwd);
      const result = await doWrite(mock, "module.md", FRONTMATTER_BODY_WRITE, cwd);
      expect(result).toBeDefined();
      expect(result!.block).toBe(true);
      expect((result as any).reason).toContain("frontmatter");
    });

    it("allows write that changes only the body of module.md", async () => {
      const cwd = path.join(FIXTURES, "frontmatter-test");
      await startSession(mock, cwd);
      const result = await doWrite(mock, "module.md", FRONTMATTER_ONLY_BODY_WRITE, cwd);
      expect(result?.block).toBeFalsy();
    });

    it("allows edit that changes only the body of module.md", async () => {
      const cwd = path.join(FIXTURES, "frontmatter-test");
      await startSession(mock, cwd);
      const result = await doEdit(mock, "module.md", [
        { oldText: BODY_OLD, newText: BODY_NEW },
      ], cwd);
      expect(result?.block).toBeFalsy();
    });

    it("blocks edit that changes frontmatter of module.md", async () => {
      const cwd = path.join(FIXTURES, "frontmatter-test");
      await startSession(mock, cwd);
      const result = await doEdit(mock, "module.md", [
        { oldText: FRONTMATTER_OLD, newText: FRONTMATTER_NEW },
      ], cwd);
      expect(result).toBeDefined();
      expect(result!.block).toBe(true);
      expect((result as any).reason).toContain("frontmatter");
    });
  });

  describe('mode: "off" (descriptor is freely editable)', () => {
    beforeEach(() => {
      setReadonlyMode("off");
    });

    it("allows write that changes frontmatter of module.md", async () => {
      const cwd = path.join(FIXTURES, "frontmatter-test");
      await startSession(mock, cwd);
      const result = await doWrite(mock, "module.md", FRONTMATTER_BODY_WRITE, cwd);
      expect(result?.block).toBeFalsy();
    });

    it("allows write that changes only the body of module.md", async () => {
      const cwd = path.join(FIXTURES, "frontmatter-test");
      await startSession(mock, cwd);
      const result = await doWrite(mock, "module.md", FRONTMATTER_ONLY_BODY_WRITE, cwd);
      expect(result?.block).toBeFalsy();
    });

    it("allows edit that changes only the body of module.md", async () => {
      const cwd = path.join(FIXTURES, "frontmatter-test");
      await startSession(mock, cwd);
      const result = await doEdit(mock, "module.md", [
        { oldText: BODY_OLD, newText: BODY_NEW },
      ], cwd);
      expect(result?.block).toBeFalsy();
    });

    it("allows edit that changes frontmatter of module.md", async () => {
      const cwd = path.join(FIXTURES, "frontmatter-test");
      await startSession(mock, cwd);
      const result = await doEdit(mock, "module.md", [
        { oldText: FRONTMATTER_OLD, newText: FRONTMATTER_NEW },
      ], cwd);
      expect(result?.block).toBeFalsy();
    });
  });
});
