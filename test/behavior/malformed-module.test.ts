import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  MockExtensionAPI,
  MALFORMED,
  startSession,
  doWrite,
} from "./helpers.ts";

vi.mock("../../src/config.ts", () => ({
  loadConfig: () => ({ moduleDescriptorFileName: "module.md", moduleDescriptorReadonly: "file", sourceRoots: [""] }),
}));

import mod from "../../src/index.ts";

describe("malformed frontmatter", () => {
  let mock: MockExtensionAPI;

  beforeEach(() => {
    mock = new MockExtensionAPI();
    mod(mock);
  });

  it("warns on malformed module.md instead of crashing", async () => {
    const cwd = MALFORMED;
    await startSession(mock, cwd);

    const infoMessages = mock.notifications.filter(
      (n) => n.type === "info",
    );
    expect(infoMessages.length).toBeGreaterThan(0);
    expect(infoMessages[0].message).toContain("Failed to parse");
    expect(infoMessages[0].message).toContain("module.md");
    expect(infoMessages[0].message).toContain("unguarded");
  });

  it("treats malformed module as unguarded (writes allowed)", async () => {
    const cwd = MALFORMED;
    await startSession(mock, cwd);

    const result = await doWrite(mock, "any.ts", "// anything", cwd);
    expect(result?.block).toBeFalsy();
  });
});
