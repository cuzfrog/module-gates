import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fs from "node:fs";

vi.mock("node:fs", () => ({
  readFileSync: vi.fn(),
}));

import { loadConfig } from "./config.ts";

const mockedReadFileSync = vi.mocked(fs.readFileSync);

describe("loadConfig", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns defaults when settings.json does not exist", () => {
    mockedReadFileSync.mockImplementation(() => {
      throw new Error("ENOENT");
    });

    const config = loadConfig("/project");
    expect(config.moduleDescriptorFileName).toBe("module.md");
    expect(config.moduleDescriptorReadonly).toBe("frontmatter");
    expect(config.sourceRoot).toBe("src/");
    expect(config.disableSystemPrompt).toBe(false);
    expect(config.outputModuleProseOnBlock).toBe(false);
  });

  it("returns defaults when settings.json has no module-gates key", () => {
    mockedReadFileSync.mockReturnValue(
      JSON.stringify({ theme: "dark" }),
    );

    const config = loadConfig("/project");
    expect(config.moduleDescriptorFileName).toBe("module.md");
    expect(config.moduleDescriptorReadonly).toBe("frontmatter");
    expect(config.sourceRoot).toBe("src/");
  });

  it("returns defaults when settings.json has invalid JSON", () => {
    mockedReadFileSync.mockReturnValue("{ broken");

    const config = loadConfig("/project");
    expect(config.moduleDescriptorFileName).toBe("module.md");
    expect(config.moduleDescriptorReadonly).toBe("frontmatter");
    expect(config.sourceRoot).toBe("src/");
  });

  it("overrides defaults with module-gates values", () => {
    mockedReadFileSync.mockReturnValue(
      JSON.stringify({
        "module-gates": {
          moduleDescriptorFileName: "CONTEXT.md",
          moduleDescriptorReadonly: "off",
          sourceRoot: "lib/",
        },
      }),
    );

    const config = loadConfig("/project");
    expect(config.moduleDescriptorFileName).toBe("CONTEXT.md");
    expect(config.moduleDescriptorReadonly).toBe("off");
    expect(config.sourceRoot).toBe("lib/");
  });

  it("overrides only provided keys in module-gates", () => {
    mockedReadFileSync.mockReturnValue(
      JSON.stringify({
        "module-gates": {
          moduleDescriptorFileName: "CONTEXT.md",
        },
      }),
    );

    const config = loadConfig("/project");
    expect(config.moduleDescriptorFileName).toBe("CONTEXT.md");
    expect(config.moduleDescriptorReadonly).toBe("frontmatter");
    expect(config.sourceRoot).toBe("src/");
  });

  it("accepts frontmatter mode", () => {
    mockedReadFileSync.mockReturnValue(
      JSON.stringify({
        "module-gates": {
          moduleDescriptorReadonly: "frontmatter",
        },
      }),
    );

    const config = loadConfig("/project");
    expect(config.moduleDescriptorReadonly).toBe("frontmatter");
  });

  it("normalizes boolean true to file mode", () => {
    mockedReadFileSync.mockReturnValue(
      JSON.stringify({
        "module-gates": {
          moduleDescriptorReadonly: true,
        },
      }),
    );

    const config = loadConfig("/project");
    expect(config.moduleDescriptorReadonly).toBe("file");
  });

  it("normalizes boolean false to off mode", () => {
    mockedReadFileSync.mockReturnValue(
      JSON.stringify({
        "module-gates": {
          moduleDescriptorReadonly: false,
        },
      }),
    );

    const config = loadConfig("/project");
    expect(config.moduleDescriptorReadonly).toBe("off");
  });

  it("reads from .pi/settings.json relative to cwd", () => {
    mockedReadFileSync.mockReturnValue("{}");

    loadConfig("/my/project");
    expect(mockedReadFileSync).toHaveBeenCalledWith(
      "/my/project/.pi/settings.json",
      "utf-8",
    );
  });

  it("ignores legacy singular module-gate key", () => {
    mockedReadFileSync.mockReturnValue(
      JSON.stringify({
        "module-gate": {
          moduleDescriptorFileName: "MODULE.md",
          moduleDescriptorReadonly: "file",
          sourceRoot: "src/",
        },
      }),
    );

    const config = loadConfig("/project");
    expect(config.moduleDescriptorFileName).toBe("module.md");
    expect(config.moduleDescriptorReadonly).toBe("frontmatter");
    expect(config.sourceRoot).toBe("src/");
  });

  it("overrides disableSystemPrompt from settings", () => {
    mockedReadFileSync.mockReturnValue(
      JSON.stringify({
        "module-gates": {
          disableSystemPrompt: true,
        },
      }),
    );

    const config = loadConfig("/project");
    expect(config.disableSystemPrompt).toBe(true);
  });

  it("overrides outputModuleProseOnBlock from settings", () => {
    mockedReadFileSync.mockReturnValue(
      JSON.stringify({
        "module-gates": {
          outputModuleProseOnBlock: true,
        },
      }),
    );

    const config = loadConfig("/project");
    expect(config.outputModuleProseOnBlock).toBe(true);
  });
});
