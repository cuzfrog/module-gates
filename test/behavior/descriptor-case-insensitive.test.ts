import { describe, it, expect, beforeEach, vi } from "vitest";
import * as path from "node:path";
import {
  MockExtensionAPI,
  FIXTURES,
  startSession,
  doWrite,
  doEdit,
} from "./helpers.ts";
import type { ModuleGateConfig } from "../../src/core/config.ts";

const { mockedLoadConfig } = vi.hoisted(() => ({
  mockedLoadConfig: vi.fn(),
}));

vi.mock("../../src/core/config.ts", () => ({
  loadConfig: mockedLoadConfig,
}));

import mod from "../../src/bridges/pi/index.ts";

function setConfig(over: Partial<ModuleGateConfig>): void {
  mockedLoadConfig.mockReturnValue({
    moduleDescriptorFileName: "MODULE.md",
    moduleDescriptorReadonly: "file",
    sourceRoots: [""],
    disableModuleInterfaceImportGate: false,
    disableSystemPrompt: false,
    outputModuleProseOnBlock: false,
    ...over,
  });
}

describe("descriptor case-insensitive protection (e2e)", () => {
  let mock: MockExtensionAPI;

  beforeEach(() => {
    mock = new MockExtensionAPI();
    mod(mock);
  });

  it("blocks edit to uppercase MODULE.md when descriptor file name config is uppercase", async () => {
    setConfig({ moduleDescriptorFileName: "MODULE.md", moduleDescriptorReadonly: "file" });
    const cwd = path.join(FIXTURES, "descriptor-only-test", "UPPER_MD");
    await startSession(mock, cwd);
    const result = await doEdit(
      mock,
      "MODULE.md",
      [{ oldText: "Uppercase descriptor fixture.", newText: "Changed." }],
      cwd,
    );
    expect(result).toBeDefined();
    expect(result!.block).toBe(true);
    expect((result as any).reason).toContain("Readonly rule");
  });

  it("blocks write to uppercase MODULE.md in file mode regardless of readonly listing", async () => {
    setConfig({ moduleDescriptorFileName: "MODULE.md", moduleDescriptorReadonly: "file" });
    const cwd = path.join(FIXTURES, "descriptor-only-test", "UPPER_MD");
    await startSession(mock, cwd);
    const result = await doWrite(
      mock,
      "MODULE.md",
      "---\nno-new-exports: [foo.ts]\n---\nNew content.",
      cwd,
    );
    expect(result).toBeDefined();
    expect(result!.block).toBe(true);
  });

  it("blocks edit to lowercase module.md when descriptor file name config is uppercase", async () => {
    setConfig({ moduleDescriptorFileName: "MODULE.md", moduleDescriptorReadonly: "file" });
    const cwd = path.join(FIXTURES, "descriptor-only-test");
    await startSession(mock, cwd);
    const result = await doEdit(
      mock,
      "module.md",
      [{ oldText: "This module has no readonly/no-new-exports entries; the descriptor file itself must be protected solely by moduleDescriptorReadonly config.", newText: "Changed." }],
      cwd,
    );
    expect(result).toBeDefined();
    expect(result!.block).toBe(true);
  });

  it("blocks edit to uppercase MODULE.md when descriptor file name config is lowercase", async () => {
    setConfig({ moduleDescriptorFileName: "module.md", moduleDescriptorReadonly: "file" });
    const cwd = path.join(FIXTURES, "descriptor-only-test", "UPPER_MD");
    await startSession(mock, cwd);
    const result = await doEdit(
      mock,
      "MODULE.md",
      [{ oldText: "Uppercase descriptor fixture.", newText: "Changed." }],
      cwd,
    );
    expect(result).toBeDefined();
    expect(result!.block).toBe(true);
  });

  it("allows body edit to uppercase MODULE.md in frontmatter mode", async () => {
    setConfig({ moduleDescriptorFileName: "MODULE.md", moduleDescriptorReadonly: "frontmatter" });
    const cwd = path.join(FIXTURES, "descriptor-only-test", "UPPER_MD");
    await startSession(mock, cwd);
    const result = await doEdit(
      mock,
      "MODULE.md",
      [{ oldText: "Uppercase descriptor fixture.", newText: "Updated prose." }],
      cwd,
    );
    expect(result?.block).toBeFalsy();
  });

  it("blocks frontmatter edit to uppercase MODULE.md in frontmatter mode", async () => {
    setConfig({ moduleDescriptorFileName: "MODULE.md", moduleDescriptorReadonly: "frontmatter" });
    const cwd = path.join(FIXTURES, "descriptor-only-test", "UPPER_MD");
    await startSession(mock, cwd);
    const result = await doWrite(
      mock,
      "MODULE.md",
      "---\nno-new-exports: [foo.ts]\n---\nUppercase descriptor fixture.",
      cwd,
    );
    expect(result).toBeDefined();
    expect(result!.block).toBe(true);
  });

  it("allows edit to uppercase MODULE.md in off mode", async () => {
    setConfig({ moduleDescriptorFileName: "MODULE.md", moduleDescriptorReadonly: "off" });
    const cwd = path.join(FIXTURES, "descriptor-only-test", "UPPER_MD");
    await startSession(mock, cwd);
    const result = await doEdit(
      mock,
      "MODULE.md",
      [{ oldText: "Uppercase descriptor fixture.", newText: "Changed." }],
      cwd,
    );
    expect(result?.block).toBeFalsy();
  });
});
