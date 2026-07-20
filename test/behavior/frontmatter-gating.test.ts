import { describe, it, expect, beforeEach, vi } from "vitest";
import * as path from "node:path";
import {
  MockExtensionAPI,
  FIXTURES,
  startSession,
  doWrite,
  doEdit,
} from "./helpers.ts";

vi.mock("../../src/core/config.ts", () => ({
  loadConfig: () => ({ moduleDescriptorFileName: "module.md", moduleDescriptorReadonly: "frontmatter", sourceRoots: [""] }),
}));

import mod from "../../src/bridges/pi/index.ts";

describe("frontmatter readonly mode", () => {
  let mock: MockExtensionAPI;

  beforeEach(() => {
    mock = new MockExtensionAPI();
    mod(mock);
  });

  it("blocks write that changes frontmatter of module.md", async () => {
    const cwd = path.join(FIXTURES, "frontmatter-test");
    await startSession(mock, cwd);

    const result = await doWrite(
      mock,
      "module.md",
      "---\nreadonly: [locked.ts, extra.ts]\n---\nThis is the body.",
      cwd,
    );
    expect(result).toBeDefined();
    expect(result!.block).toBe(true);
    expect(result!.reason).toContain("frontmatter");
  });

  it("allows write that changes only body of module.md", async () => {
    const cwd = path.join(FIXTURES, "frontmatter-test");
    await startSession(mock, cwd);

    const result = await doWrite(
      mock,
      "module.md",
      "---\nreadonly: [locked.ts]\n---\nUpdated body text only.",
      cwd,
    );
    expect(result?.block).toBeFalsy();
  });

  it("allows edit that changes only body of module.md", async () => {
    const cwd = path.join(FIXTURES, "frontmatter-test");
    await startSession(mock, cwd);

    const result = await doEdit(mock, "module.md", [
      { oldText: "This is the body text. It can be edited in frontmatter mode.", newText: "New body." },
    ], cwd);
    expect(result?.block).toBeFalsy();
  });

  it("blocks edit that changes frontmatter of module.md", async () => {
    const cwd = path.join(FIXTURES, "frontmatter-test");
    await startSession(mock, cwd);

    const result = await doEdit(mock, "module.md", [
      { oldText: "readonly: [locked.ts]", newText: "readonly: [locked.ts, extra.ts]" },
    ], cwd);
    expect(result).toBeDefined();
    expect(result!.block).toBe(true);
    expect(result!.reason).toContain("frontmatter");
  });

  it("still blocks readonly files (non-descriptor) normally in frontmatter mode", async () => {
    const cwd = path.join(FIXTURES, "readonly-test");
    await startSession(mock, cwd);

    const result = await doWrite(mock, "sub/locked.ts", "// modified", cwd);
    expect(result).toBeDefined();
    expect(result!.block).toBe(true);
  });
});
