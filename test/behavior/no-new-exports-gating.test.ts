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
  loadConfig: () => ({ moduleDescriptorFileName: "module.md", moduleDescriptorReadonly: "file", sourceRoots: [""] }),
}));

import mod from "../../src/bridges/pi/index.ts";

describe("no-new-exports gating", () => {
  let mock: MockExtensionAPI;

  beforeEach(() => {
    mock = new MockExtensionAPI();
    mod(mock);
  });

  it("blocks write that adds new export to no-new-exports file", async () => {
    const cwd = path.join(FIXTURES, "no-new-exports-test");
    await startSession(mock, cwd);

    const result = await doWrite(
      mock,
      "no-new-exports.ts",
      "export function existingFn() { return 1; }\nexport function newFn() { return 2; }",
      cwd,
    );
    expect(result).toBeDefined();
    expect((result as any).block).toBe(true);

    const reason = (result as any).reason!;
    expect(reason).toContain("No-new-exports rule");
    expect(reason).toContain("newFn");
    expect(reason).toContain("module.md");
  });

  it("allows write that modifies existing exports without adding new ones on no-new-exports file", async () => {
    const cwd = path.join(FIXTURES, "no-new-exports-test");
    await startSession(mock, cwd);

    const result = await doWrite(
      mock,
      "no-new-exports.ts",
      "export function existingFn() { return 2; }",
      cwd,
    );
    expect(result?.block).toBeFalsy();
  });

  it("allows write to non-no-new-exports file in same module", async () => {
    const cwd = path.join(FIXTURES, "no-new-exports-test");
    await startSession(mock, cwd);

    const result = await doWrite(
      mock,
      "editable.ts",
      "export const ROOT_SECRET = 'parent-only';\nexport function newFn() {}",
      cwd,
    );
    expect(result?.block).toBeFalsy();
  });

  it("blocks edit that adds new export to no-new-exports file", async () => {
    const cwd = path.join(FIXTURES, "no-new-exports-test");
    await startSession(mock, cwd);

    const result = await doEdit(
      mock,
      "no-new-exports.ts",
      [
        {
          oldText: "export function existingFn() { return 1; }",
          newText:
            "export function existingFn() { return 1; }\nexport function newFn() { return 2; }",
        },
      ],
      cwd,
    );
    expect(result).toBeDefined();
    expect((result as any).block).toBe(true);

    const reason = (result as any).reason!;
    expect(reason).toContain("No-new-exports rule");
    expect(reason).toContain("newFn");
  });

  it("blocks write that adds re-export to no-new-exports file", async () => {
    const cwd = path.join(FIXTURES, "no-new-exports-test");
    await startSession(mock, cwd);

    const result = await doWrite(
      mock,
      "no-new-exports.ts",
      'export function existingFn() { return 1; }\nexport { buildSystemPromptHint } from "./system-prompt.ts";',
      cwd,
    );
    expect(result).toBeDefined();
    expect((result as any).block).toBe(true);

    const reason = (result as any).reason!;
    expect(reason).toContain("No-new-exports rule");
    expect(reason).toContain("buildSystemPromptHint");
  });

  it("allows edit that modifies body without adding exports on no-new-exports file", async () => {
    const cwd = path.join(FIXTURES, "no-new-exports-test");
    await startSession(mock, cwd);

    const result = await doEdit(
      mock,
      "no-new-exports.ts",
      [
        {
          oldText: "return 1;",
          newText: "return 2;",
        },
      ],
      cwd,
    );
    expect(result?.block).toBeFalsy();
  });

  it("blocks write that adds type-only re-export to no-new-exports file", async () => {
    const cwd = path.join(FIXTURES, "no-new-exports-test");
    await startSession(mock, cwd);

    const result = await doWrite(
      mock,
      "no-new-exports.ts",
      'export function existingFn() { return 1; }\nexport type { SomeType } from "./system-prompt.ts";',
      cwd,
    );
    expect(result).toBeDefined();
    expect((result as any).block).toBe(true);

    const reason = (result as any).reason!;
    expect(reason).toContain("No-new-exports rule");
    expect(reason).toContain("SomeType");
  });

  it("blocks write that adds star re-export to no-new-exports file", async () => {
    const cwd = path.join(FIXTURES, "no-new-exports-test");
    await startSession(mock, cwd);

    const result = await doWrite(
      mock,
      "no-new-exports.ts",
      'export function existingFn() { return 1; }\nexport * from "./system-prompt.ts";',
      cwd,
    );
    expect(result).toBeDefined();
    expect((result as any).block).toBe(true);

    const reason = (result as any).reason!;
    expect(reason).toContain("No-new-exports rule");
  });

  it("blocks write that adds default identifier export to no-new-exports file", async () => {
    const cwd = path.join(FIXTURES, "no-new-exports-test");
    await startSession(mock, cwd);

    const result = await doWrite(
      mock,
      "no-new-exports.ts",
      'const SomeName = "hello";\nexport function existingFn() { return 1; }\nexport default SomeName;',
      cwd,
    );
    expect(result).toBeDefined();
    expect((result as any).block).toBe(true);

    const reason = (result as any).reason!;
    expect(reason).toContain("No-new-exports rule");
    expect(reason).toContain("SomeName");
  });
});