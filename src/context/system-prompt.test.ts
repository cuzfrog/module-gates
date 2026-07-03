import { describe, it, expect } from "vitest";
import { buildSystemPromptHint } from "./system-prompt.ts";
import type { ModuleIndex } from "../types.ts";
import type { ModuleGateConfig } from "../config.ts";

const baseConfig: ModuleGateConfig = {
  moduleDescriptorFileName: "module.md",
  moduleDescriptorReadonly: "file",
  sourceRoot: "src/",
  disableModuleInterfaceImportGate: false,
  disableSystemPrompt: false,
  outputModuleProseOnBlock: false,
};

describe("buildSystemPromptHint", () => {
  it("returns augmented prompt when contracts exist", () => {
    const index: ModuleIndex = {
      contracts: [
        {
          modulePath: "/project/src",
          descriptorFileName: "module.md",
          visible: [{ name: "greet" }, { name: "Config" }],
          readonly: ["secret.ts", "module.md"],
        sealed: [],
          prose: "Greeting module.",
        },
      ],
      dirToModule: new Map(),
    };

    const result = buildSystemPromptHint(index, "You are a helpful assistant.", "module.md", baseConfig);

    expect(result).toContain("You are a helpful assistant.");
    expect(result).toContain("module.md");
    expect(result).toContain("visible");
    expect(result).toContain("readonly");
  });

  it("returns original prompt when no contracts", () => {
    const index: ModuleIndex = {
      contracts: [],
      dirToModule: new Map(),
    };

    const result = buildSystemPromptHint(index, "You are a helpful assistant.", "module.md", baseConfig);

    expect(result).toBe("You are a helpful assistant.");
  });

  it("appends module descriptor section to prompt", () => {
    const index: ModuleIndex = {
      contracts: [
        {
          modulePath: "/project/src",
          descriptorFileName: "module.md",
          visible: [{ name: "fnA" }],
          readonly: ["module.md"],
        sealed: [],
          prose: "Module A.",
        },
      ],
      dirToModule: new Map(),
    };

    const result = buildSystemPromptHint(index, "Base prompt.", "CONTEXT.md", baseConfig);

    expect(result).toContain("Base prompt.");
    expect(result).toContain("CONTEXT.md");
    expect(result.length).toBeGreaterThan("Base prompt.".length);
  });

  it("mentions frontmatter in note when mode is frontmatter", () => {
    const index: ModuleIndex = {
      contracts: [
        {
          modulePath: "/project/src",
          descriptorFileName: "module.md",
          visible: [{ name: "fnA" }],
          readonly: ["module.md"],
          sealed: [],
          prose: "Module A.",
        },
      ],
      dirToModule: new Map(),
    };

    const result = buildSystemPromptHint(
      index,
      "Base prompt.",
      "module.md",
      { ...baseConfig, moduleDescriptorReadonly: "frontmatter" },
    );

    expect(result).toContain("The frontmatter of");
    expect(result).toContain("is readonly");
  });

  it("omits descriptor note when mode is off", () => {
    const index: ModuleIndex = {
      contracts: [
        {
          modulePath: "/project/src",
          descriptorFileName: "module.md",
          visible: [{ name: "fnA" }],
          readonly: ["config.ts"],
          sealed: [],
          prose: "Module A.",
        },
      ],
      dirToModule: new Map(),
    };

    const result = buildSystemPromptHint(
      index,
      "Base prompt.",
      "module.md",
      { ...baseConfig, moduleDescriptorReadonly: "off" },
    );

    expect(result).not.toContain("The `module.md` file itself is readonly");
    expect(result).not.toContain("The frontmatter of");
  });

  it("includes module interface import rule when gate is enabled", () => {
    const index: ModuleIndex = {
      contracts: [
        {
          modulePath: "/project/src",
          descriptorFileName: "module.md",
          visible: [{ name: "fnA" }],
          readonly: ["module.md"],
          sealed: [],
          prose: "Module A.",
        },
      ],
      dirToModule: new Map(),
    };

    const result = buildSystemPromptHint(index, "Base prompt.", "module.md", baseConfig);

    expect(result).toContain("External files can only import through the module interface");
  });

  it("omits module interface import rule when gate is disabled", () => {
    const index: ModuleIndex = {
      contracts: [
        {
          modulePath: "/project/src",
          descriptorFileName: "module.md",
          visible: [{ name: "fnA" }],
          readonly: ["module.md"],
          sealed: [],
          prose: "Module A.",
        },
      ],
      dirToModule: new Map(),
    };

    const result = buildSystemPromptHint(
      index,
      "Base prompt.",
      "module.md",
      { ...baseConfig, disableModuleInterfaceImportGate: true },
    );

    expect(result).not.toContain("External files can only import through the module interface");
  });

  it("returns original prompt when disableSystemPrompt is true", () => {
    const index: ModuleIndex = {
      contracts: [
        {
          modulePath: "/project/src",
          descriptorFileName: "module.md",
          visible: [{ name: "fnA" }],
          readonly: ["module.md"],
          sealed: [],
          prose: "Module A.",
        },
      ],
      dirToModule: new Map(),
    };

    const result = buildSystemPromptHint(
      index,
      "Base prompt.",
      "module.md",
      { ...baseConfig, disableSystemPrompt: true },
    );

    expect(result).toBe("Base prompt.");
  });
});
