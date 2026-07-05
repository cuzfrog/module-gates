import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  MockExtensionAPI,
  FIXTURES,
  startSession,
} from "./helpers.ts";

vi.mock("../../src/config.ts", () => ({
  loadConfig: () => ({ moduleDescriptorFileName: "module.md", moduleDescriptorReadonly: "file", sourceRoots: [""] }),
}));

import mod from "../../src/index.ts";

describe("dangling visible entries", () => {
  let mock: MockExtensionAPI;

  beforeEach(() => {
    mock = new MockExtensionAPI();
    mod(mock);
  });

  it("reports all three root-module dangling entries with correct format", async () => {
    const cwd = FIXTURES;
    await startSession(mock, cwd);

    const rootDangling = mock.notifications.filter(
      (n) =>
        n.type === "info" &&
        n.message.includes("Dangling visible entry") &&
        /\sin module\.md$/.test(n.message),
    );

    expect(rootDangling).toHaveLength(3);

    const names = rootDangling.map((w) => {
      const match = w.message.match(/"(\w+)"/);
      return match ? match[1] : "";
    });

    expect(names).toEqual(
      expect.arrayContaining(["GhostType", "AnotherGhost", "ThirdGhost"]),
    );

    const ghostWarn = rootDangling.find((n) => n.message.includes("GhostType"))!;
    expect(ghostWarn.message).toContain("module.md");
    expect(ghostWarn.type).toBe("info");
  });
});
