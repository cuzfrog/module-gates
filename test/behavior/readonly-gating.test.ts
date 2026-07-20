import { describe, it, expect, beforeEach, vi } from "vitest";
import * as path from "node:path";
import {
  MockExtensionAPI,
  FIXTURES,
  startSession,
  doWrite,
} from "./helpers.ts";

vi.mock("../../src/core/config.ts", () => ({
  loadConfig: () => ({ moduleDescriptorFileName: "module.md", moduleDescriptorReadonly: "file", sourceRoots: [""] }),
}));

import mod from "../../src/bridges/pi/index.ts";

describe("readonly gating", () => {
  let mock: MockExtensionAPI;

  beforeEach(() => {
    mock = new MockExtensionAPI();
    mod(mock);
  });

  it("blocks write to file covered by parent and child readonly and cites module.md in reason", async () => {
    const cwd = path.join(FIXTURES, "readonly-test");
    await startSession(mock, cwd);

    const result = await doWrite(mock, "sub/locked.ts", "// modified", cwd);
    expect(result).toBeDefined();
    expect((result as any).block).toBe(true);

    const reason = (result as any).reason!;
    expect(reason).toContain("Readonly rule");
    expect(reason).toContain("module.md");
  });

  it("allows write to editable.ts (not listed as readonly anywhere)", async () => {
    const cwd = path.join(FIXTURES, "readonly-test");
    await startSession(mock, cwd);

    const result = await doWrite(mock, "editable.ts", "// modified", cwd);
    expect(result?.block).toBeFalsy();
  });
});
