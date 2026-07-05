import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  MockExtensionAPI,
  MODIFIER_LOCK,
  startSession,
  doWrite,
} from "./helpers.ts";

vi.mock("../../src/config.ts", () => ({
  loadConfig: () => ({ moduleDescriptorFileName: "module.md", moduleDescriptorReadonly: "file", sourceRoots: [""] }),
}));

import mod from "../../src/index.ts";

describe("modifier lock", () => {
  let mock: MockExtensionAPI;

  beforeEach(() => {
    mock = new MockExtensionAPI();
    mod(mock);
  });

  it("blocks new export with mismatched modifier", async () => {
    const cwd = MODIFIER_LOCK;
    await startSession(mock, cwd);

    // Add pub fn Foo — visible requires pub(super)
    const result = await doWrite(
      mock,
      "new_file.rs",
      "pub fn Foo() {}",
      cwd,
    );
    expect(result?.block).toBe(true);
  });

  it("allows new export with matching modifier", async () => {
    const cwd = MODIFIER_LOCK;
    await startSession(mock, cwd);

    const result = await doWrite(
      mock,
      "new_file.rs",
      "pub(super) fn Foo() {}",
      cwd,
    );
    expect(result?.block).toBeFalsy();
  });

  it("allows new export when no modifier constraint", async () => {
    const cwd = MODIFIER_LOCK;
    await startSession(mock, cwd);

    const result = await doWrite(
      mock,
      "new_file.rs",
      "pub fn Baz() {}",
      cwd,
    );
    expect(result?.block).toBeFalsy();
  });

  it("blocks new export with mismatched crate modifier", async () => {
    const cwd = MODIFIER_LOCK;
    await startSession(mock, cwd);

    // Add pub fn Bar — visible requires pub(crate)
    const result = await doWrite(
      mock,
      "new_file.rs",
      "pub fn Bar() {}",
      cwd,
    );
    expect(result?.block).toBe(true);
  });

  it("allows new export with matching crate modifier", async () => {
    const cwd = MODIFIER_LOCK;
    await startSession(mock, cwd);

    const result = await doWrite(
      mock,
      "new_file.rs",
      "pub(crate) fn Bar() {}",
      cwd,
    );
    expect(result?.block).toBeFalsy();
  });
});
