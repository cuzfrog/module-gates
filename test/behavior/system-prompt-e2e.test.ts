import { describe, it, expect, beforeEach, vi } from "vitest";
import * as path from "node:path";
import {
  MockExtensionAPI,
  FIXTURES,
  startSession,
  doBeforeAgentStart,
} from "./helpers.ts";

vi.mock("../../src/config.ts", () => ({
  loadConfig: () => ({ moduleDescriptorFileName: "module.md", moduleDescriptorReadonly: "file", sourceRoots: [""] }),
}));

import mod from "../../src/index.ts";

describe("system prompt augmentation", () => {
  let mock: MockExtensionAPI;

  beforeEach(() => {
    mock = new MockExtensionAPI();
    mod(mock);
  });

  it("injects module descriptor hint when contracts exist", async () => {
    const cwd = path.join(FIXTURES, "src");
    await startSession(mock, cwd);

    const result = await doBeforeAgentStart(mock, "Default system prompt.", cwd);
    expect(result).toBeDefined();
    if (result) {
      expect((result as any).systemPrompt).toContain("module.md");
    }
  });

  it("does not inject hint when no module.md exists anywhere", async () => {
    const cwd = "/tmp/no-modules-here";
    await startSession(mock, cwd);

    const result = await doBeforeAgentStart(mock, "Default system prompt.", cwd);
    if (result) {
      expect((result as any).systemPrompt).toBeUndefined();
    }
  });
});
