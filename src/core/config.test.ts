import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fs from "node:fs";

vi.mock("node:fs", () => ({
  readFileSync: vi.fn(),
}));

import { loadConfig, type ConfigSource } from "./config.ts";

const mockedReadFileSync = vi.mocked(fs.readFileSync);

const SOURCES: ConfigSource[] = [
  { filePath: ".module-gates/config.json" },
  { filePath: ".pi/settings.json", key: "module-gates" },
  { filePath: ".claude/settings.json", key: "module-gates" },
];

function mockFiles(files: Record<string, string>): void {
  mockedReadFileSync.mockImplementation((p: unknown) => {
    const content = files[String(p)];
    if (content === undefined) throw new Error(`ENOENT: ${String(p)}`);
    return content;
  });
}

function mockCanonical(config: unknown): void {
  mockFiles({
    "/project/.module-gates/config.json": JSON.stringify(config),
  });
}

describe("loadConfig", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns defaults when no source exists", () => {
    mockFiles({});

    const config = loadConfig("/project", SOURCES);
    expect(config.moduleDescriptorFileName).toBe("module.md");
    expect(config.moduleDescriptorReadonly).toBe("frontmatter");
    expect(config.sourceRoots).toEqual(["src/"]);
    expect(config.disableSystemPrompt).toBe(false);
    expect(config.outputModuleProseOnBlock).toBe(false);
  });

  it("reads the whole file when the source has no key", () => {
    mockCanonical({ moduleDescriptorFileName: "CONTEXT.md" });

    const config = loadConfig("/project", SOURCES);
    expect(config.moduleDescriptorFileName).toBe("CONTEXT.md");
  });

  it("extracts the key from a keyed source", () => {
    mockFiles({
      "/project/.pi/settings.json": JSON.stringify({
        theme: "dark",
        "module-gates": { moduleDescriptorFileName: "CONTEXT.md" },
      }),
    });

    const config = loadConfig("/project", SOURCES);
    expect(config.moduleDescriptorFileName).toBe("CONTEXT.md");
  });

  it("returns defaults when a keyed source has no module-gates key", () => {
    mockFiles({
      "/project/.pi/settings.json": JSON.stringify({ theme: "dark" }),
    });

    const config = loadConfig("/project", [
      { filePath: ".pi/settings.json", key: "module-gates" },
    ]);
    expect(config.moduleDescriptorFileName).toBe("module.md");
  });

  it("first existing source wins", () => {
    mockFiles({
      "/project/.module-gates/config.json": JSON.stringify({
        moduleDescriptorFileName: "CANONICAL.md",
      }),
      "/project/.pi/settings.json": JSON.stringify({
        "module-gates": { moduleDescriptorFileName: "PI.md" },
      }),
    });

    const config = loadConfig("/project", SOURCES);
    expect(config.moduleDescriptorFileName).toBe("CANONICAL.md");
  });

  it("falls back to the next source when a file is missing", () => {
    mockFiles({
      "/project/.pi/settings.json": JSON.stringify({
        "module-gates": { moduleDescriptorFileName: "PI.md" },
      }),
    });

    const config = loadConfig("/project", SOURCES);
    expect(config.moduleDescriptorFileName).toBe("PI.md");
  });

  it("falls back to the next source when the key is absent", () => {
    mockFiles({
      "/project/.pi/settings.json": JSON.stringify({ theme: "dark" }),
      "/project/.claude/settings.json": JSON.stringify({
        "module-gates": { moduleDescriptorFileName: "CLAUDE.md" },
      }),
    });

    const config = loadConfig("/project", SOURCES);
    expect(config.moduleDescriptorFileName).toBe("CLAUDE.md");
  });

  it("falls back to the next source when JSON is invalid", () => {
    mockFiles({
      "/project/.module-gates/config.json": "{ broken",
      "/project/.pi/settings.json": JSON.stringify({
        "module-gates": { moduleDescriptorFileName: "PI.md" },
      }),
    });

    const config = loadConfig("/project", SOURCES);
    expect(config.moduleDescriptorFileName).toBe("PI.md");
  });

  it("accepts multiple roots in sourceRoots array", () => {
    mockCanonical({ sourceRoots: ["lib/", "packages/", "src/"] });

    const config = loadConfig("/project", SOURCES);
    expect(config.sourceRoots).toEqual(["lib/", "packages/", "src/"]);
  });

  it("accepts legacy singular sourceRoot as a string", () => {
    mockCanonical({ sourceRoot: "lib/" });

    const config = loadConfig("/project", SOURCES);
    expect(config.sourceRoots).toEqual(["lib/"]);
  });

  it("overrides only provided keys", () => {
    mockCanonical({ moduleDescriptorFileName: "CONTEXT.md" });

    const config = loadConfig("/project", SOURCES);
    expect(config.moduleDescriptorFileName).toBe("CONTEXT.md");
    expect(config.moduleDescriptorReadonly).toBe("frontmatter");
    expect(config.sourceRoots).toEqual(["src/"]);
  });

  it("accepts frontmatter mode", () => {
    mockCanonical({ moduleDescriptorReadonly: "frontmatter" });

    const config = loadConfig("/project", SOURCES);
    expect(config.moduleDescriptorReadonly).toBe("frontmatter");
  });

  it("normalizes boolean true to file mode", () => {
    mockCanonical({ moduleDescriptorReadonly: true });

    const config = loadConfig("/project", SOURCES);
    expect(config.moduleDescriptorReadonly).toBe("file");
  });

  it("normalizes boolean false to off mode", () => {
    mockCanonical({ moduleDescriptorReadonly: false });

    const config = loadConfig("/project", SOURCES);
    expect(config.moduleDescriptorReadonly).toBe("off");
  });

  it("reads the first source relative to cwd", () => {
    mockFiles({});

    loadConfig("/my/project", SOURCES);
    expect(mockedReadFileSync).toHaveBeenCalledWith(
      "/my/project/.module-gates/config.json",
      "utf-8",
    );
  });

  it("ignores legacy singular module-gate key", () => {
    mockFiles({
      "/project/.pi/settings.json": JSON.stringify({
        "module-gate": {
          moduleDescriptorFileName: "MODULE.md",
          moduleDescriptorReadonly: "file",
          sourceRoots: ["src/"],
        },
      }),
    });

    const config = loadConfig("/project", SOURCES);
    expect(config.moduleDescriptorFileName).toBe("module.md");
    expect(config.moduleDescriptorReadonly).toBe("frontmatter");
    expect(config.sourceRoots).toEqual(["src/"]);
  });

  it("overrides disableSystemPrompt from settings", () => {
    mockCanonical({ disableSystemPrompt: true });

    const config = loadConfig("/project", SOURCES);
    expect(config.disableSystemPrompt).toBe(true);
  });

  it("overrides outputModuleProseOnBlock from settings", () => {
    mockCanonical({ outputModuleProseOnBlock: true });

    const config = loadConfig("/project", SOURCES);
    expect(config.outputModuleProseOnBlock).toBe(true);
  });
});
