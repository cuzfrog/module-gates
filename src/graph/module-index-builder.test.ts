import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Dirent } from "node:fs";

vi.mock("node:fs/promises", () => ({
  readdir: vi.fn(),
}));

vi.mock("node:fs", () => ({
  readFileSync: vi.fn(),
}));

vi.mock("../utils/frontmatter.ts", () => ({
  parseFrontmatter: vi.fn(),
}));

vi.mock("./validation.ts", () => ({
  validateVisibleEntries: vi.fn(),
}));

vi.mock("./frontmatter-parser.ts", () => ({
  parseVisibleEntry: vi.fn((raw: any) => {
    let pathStr: string;
    let modifier: string | undefined;
    if (typeof raw === "string") {
      pathStr = raw.trim();
    } else {
      pathStr = raw.path;
      modifier = raw.modifier;
    }
    if (pathStr.endsWith("/")) pathStr = pathStr.slice(0, -1);
    const lastSlash = pathStr.lastIndexOf("/");
    const name = lastSlash >= 0 ? pathStr.slice(lastSlash + 1) : pathStr;
    return { name, modifier, path: raw.path ?? raw };
  }),
}));

import { readdir } from "node:fs/promises";
import * as fs from "node:fs";
import { parseFrontmatter } from "../utils/frontmatter.ts";
import { validateVisibleEntries } from "./index.ts";
import { buildModuleIndex } from "./module-index-builder.ts";
import type { ModuleGateConfig } from "../config.ts";

const mockedReaddir = readdir as unknown as ReturnType<typeof vi.fn>;
const mockedReadFileSync = vi.mocked(fs.readFileSync);
const mockedParseFrontmatter = vi.mocked(parseFrontmatter);
const mockedValidateVisibleEntries = vi.mocked(validateVisibleEntries);

const defaultConfig: ModuleGateConfig = {
  moduleDescriptorFileName: "module.md",
  moduleDescriptorReadonly: "file",
  sourceRoot: "",
  disableModuleInterfaceImportGate: false,
      disableSystemPrompt: false,
      outputModuleProseOnBlock: false,
};

function makeDirent(name: string, isDir: boolean): Dirent {
  return {
    name,
    isDirectory: () => isDir,
    isFile: () => !isDir,
    isBlockDevice: () => false,
    isCharacterDevice: () => false,
    isFIFO: () => false,
    isSocket: () => false,
    isSymbolicLink: () => false,
    parentPath: "",
    path: "",
  } as Dirent;
}

function makeCtx(cwd: string, onNotify?: (msg: string, type?: string) => void) {
  return {
    cwd,
    ui: {
      notify(msg: string, type?: string) {
        onNotify?.(msg, type);
      },
    },
  };
}

describe("buildModuleIndex", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("builds contracts from module.md files", async () => {
    mockedReaddir.mockImplementation(async (dir: unknown) => {
      const d = dir as string;
      if (d === "/project") return [makeDirent("src", true)] as Dirent[];
      if (d === "/project/src")
        return [makeDirent("module.md", false), makeDirent("app.ts", false)] as Dirent[];
      return [] as Dirent[];
    });

    mockedReadFileSync.mockReturnValue("---\nvisible: [greet]\n---\nGreeting module.");

    mockedParseFrontmatter.mockReturnValue({
      frontmatter: { visible: ["greet"], readonly: ["secret.ts"] },
      body: "Greeting module.",
    });

    const index = await buildModuleIndex(makeCtx("/project"), defaultConfig);

    expect(index.contracts).toHaveLength(1);
    expect(index.contracts[0].modulePath).toBe("/project/src");
    expect(index.contracts[0].visible).toEqual([{ name: "greet", path: "greet" }]);
    expect(index.contracts[0].readonly).toContain("secret.ts");
    expect(index.contracts[0].prose).toBe("Greeting module.");
  });

  it("does not add module.md to readonly implicitly regardless of moduleDescriptorReadonly mode", async () => {
    mockedReaddir.mockImplementation(async (dir: unknown) => {
      const d = dir as string;
      if (d === "/project") return [makeDirent("module.md", false)] as Dirent[];
      return [] as Dirent[];
    });

    mockedReadFileSync.mockReturnValue("---\nreadonly: [config.json]\n---\nRoot.");

    mockedParseFrontmatter.mockReturnValue({
      frontmatter: { readonly: ["config.json"] },
      body: "Root.",
    });

    const index = await buildModuleIndex(makeCtx("/project"), defaultConfig);

    expect(index.contracts[0].readonly).not.toContain("module.md");
    expect(index.contracts[0].readonly).toContain("config.json");
  });

  it("does not add module.md to readonly when moduleDescriptorReadonly is off", async () => {
    mockedReaddir.mockImplementation(async (dir: unknown) => {
      const d = dir as string;
      if (d === "/project") return [makeDirent("module.md", false)] as Dirent[];
      return [] as Dirent[];
    });

    mockedReadFileSync.mockReturnValue("---\nreadonly: [config.json]\n---\nRoot.");

    mockedParseFrontmatter.mockReturnValue({
      frontmatter: { readonly: ["config.json"] },
      body: "Root.",
    });

    const config: ModuleGateConfig = {
      moduleDescriptorFileName: "module.md",
      moduleDescriptorReadonly: "off",
      sourceRoot: "",
      disableModuleInterfaceImportGate: false,
      disableSystemPrompt: false,
      outputModuleProseOnBlock: false,
    };
    const index = await buildModuleIndex(makeCtx("/project"), config);

    expect(index.contracts[0].readonly).not.toContain("module.md");
    expect(index.contracts[0].readonly).toContain("config.json");
  });

  it("does not add module.md to readonly when moduleDescriptorReadonly is frontmatter", async () => {
    mockedReaddir.mockImplementation(async (dir: unknown) => {
      const d = dir as string;
      if (d === "/project") return [makeDirent("module.md", false)] as Dirent[];
      return [] as Dirent[];
    });

    mockedReadFileSync.mockReturnValue("---\nreadonly: [config.json]\n---\nRoot.");

    mockedParseFrontmatter.mockReturnValue({
      frontmatter: { readonly: ["config.json"] },
      body: "Root.",
    });

    const config: ModuleGateConfig = {
      moduleDescriptorFileName: "module.md",
      moduleDescriptorReadonly: "frontmatter",
      sourceRoot: "",
      disableModuleInterfaceImportGate: false,
      disableSystemPrompt: false,
      outputModuleProseOnBlock: false,
    };
    const index = await buildModuleIndex(makeCtx("/project"), config);

    expect(index.contracts[0].readonly).not.toContain("module.md");
    expect(index.contracts[0].readonly).toContain("config.json");
  });

  it("parses frontmatter with visible and readonly", async () => {
    mockedReaddir.mockImplementation(async (dir: unknown) => {
      const d = dir as string;
      if (d === "/project") return [makeDirent("module.md", false)] as Dirent[];
      return [] as Dirent[];
    });

    mockedReadFileSync.mockReturnValue("content");

    mockedParseFrontmatter.mockReturnValue({
      frontmatter: { visible: ["exportA", "exportB"], readonly: ["locked/"] },
      body: "Some prose.",
    });

    const index = await buildModuleIndex(makeCtx("/project"), defaultConfig);

    expect(index.contracts[0].visible).toEqual([{ name: "exportA", path: "exportA" }, { name: "exportB", path: "exportB" }]);
    expect(index.contracts[0].readonly).toContain("locked/");
    expect(index.contracts[0].prose).toBe("Some prose.");
  });

  it("parses visible entries with paths and modifiers from object form", async () => {
    mockedReaddir.mockImplementation(async (dir: unknown) => {
      const d = dir as string;
      if (d === "/project") return [makeDirent("module.md", false)] as Dirent[];
      return [] as Dirent[];
    });

    mockedReadFileSync.mockReturnValue("content");

    mockedParseFrontmatter.mockReturnValue({
      frontmatter: {
        visible: [{ path: "sub/Foo", modifier: "pub(super)" }, { path: "Bar" }],
        readonly: [],
      },
      body: "",
    });

    const index = await buildModuleIndex(makeCtx("/project"), defaultConfig);

    expect(index.contracts[0].visible).toEqual([
      { modifier: "pub(super)", name: "Foo", path: "sub/Foo" },
      { name: "Bar", path: "Bar" },
    ]);
  });

  it("sets visible to null when not specified in frontmatter", async () => {
    mockedReaddir.mockImplementation(async (dir: unknown) => {
      const d = dir as string;
      if (d === "/project") return [makeDirent("module.md", false)] as Dirent[];
      return [] as Dirent[];
    });

    mockedReadFileSync.mockReturnValue("content");

    mockedParseFrontmatter.mockReturnValue({
      frontmatter: { readonly: ["secret.ts"] },
      body: "No visible constraint.",
    });

    const index = await buildModuleIndex(makeCtx("/project"), defaultConfig);
    expect(index.contracts[0].visible).toBeNull();
  });

  it("deepest module.md wins directory ownership in dirToModule", async () => {
    mockedReaddir.mockImplementation(async (dir: unknown) => {
      const d = dir as string;
      if (d === "/project")
        return [makeDirent("module.md", false), makeDirent("src", true)] as Dirent[];
      if (d === "/project/src")
        return [makeDirent("module.md", false), makeDirent("app.ts", false)] as Dirent[];
      return [] as Dirent[];
    });

    mockedReadFileSync.mockReturnValue("content");

    mockedParseFrontmatter.mockReturnValue({
      frontmatter: {},
      body: "",
    });

    const index = await buildModuleIndex(makeCtx("/project"), defaultConfig);

    expect(index.contracts).toHaveLength(2);
    expect(index.dirToModule.get("/project/src")).toBe("/project/src");
    expect(index.dirToModule.get("/project")).toBe("/project");
  });

  it("skips malformed module.md and notifies with info level", async () => {
    mockedReaddir.mockImplementation(async (dir: unknown) => {
      const d = dir as string;
      if (d === "/project")
        return [makeDirent("module.md", false), makeDirent("good", true)] as Dirent[];
      if (d === "/project/good")
        return [makeDirent("module.md", false)] as Dirent[];
      return [] as Dirent[];
    });

    mockedReadFileSync.mockImplementation((p: unknown): string => {
      const filePath = p as string;
      if (filePath === "/project/module.md") return "---\nbroken: [\n---\nbad";
      return "---\nvisible: [ok]\n---\ngood";
    });

    mockedParseFrontmatter.mockImplementation((content: string) => {
      if (content.includes("broken")) {
        throw new Error("YAML parse error");
      }
      return { frontmatter: { visible: ["ok"] }, body: "good" };
    });

    const notifications: { message: string; type: string }[] = [];
    const ctx = makeCtx("/project", (msg, type) =>
      notifications.push({ message: msg, type: type ?? "info" }),
    );

    const index = await buildModuleIndex(ctx, defaultConfig);

    expect(notifications).toHaveLength(1);
    expect(notifications[0].message).toContain("Failed to parse");
    expect(notifications[0].message).toContain("/project/module.md");
    expect(notifications[0].message).toContain("unguarded");
    expect(notifications[0].type).toBe("info");

    expect(index.contracts).toHaveLength(1);
    expect(index.contracts[0].modulePath).toBe("/project/good");
    expect(index.contracts[0].visible).toEqual([{ name: "ok", path: "ok" }]);
  });

  it("matches configurable descriptor file name", async () => {
    mockedReaddir.mockImplementation(async (dir: unknown) => {
      const d = dir as string;
      if (d === "/project")
        return [makeDirent("CONTEXT.md", false)] as Dirent[];
      return [] as Dirent[];
    });

    mockedReadFileSync.mockReturnValue("content");
    mockedParseFrontmatter.mockReturnValue({
      frontmatter: {},
      body: "Root.",
    });

    const config: ModuleGateConfig = {
      moduleDescriptorFileName: "CONTEXT.md",
      moduleDescriptorReadonly: "file",
      sourceRoot: "",
      disableModuleInterfaceImportGate: false,
      disableSystemPrompt: false,
      outputModuleProseOnBlock: false,
    };
    const index = await buildModuleIndex(makeCtx("/project"), config);
    expect(index.contracts).toHaveLength(1);
    expect(index.contracts[0].modulePath).toBe("/project");
    expect(index.contracts[0].readonly).not.toContain("CONTEXT.md");
  });

  it("matches module.md case-insensitively", async () => {
    mockedReaddir.mockImplementation(async (dir: unknown) => {
      const d = dir as string;
      if (d === "/project")
        return [makeDirent("Module.MD", false)] as Dirent[];
      return [] as Dirent[];
    });

    mockedReadFileSync.mockReturnValue("content");
    mockedParseFrontmatter.mockReturnValue({
      frontmatter: {},
      body: "Root.",
    });

    const index = await buildModuleIndex(makeCtx("/project"), defaultConfig);
    expect(index.contracts).toHaveLength(1);
    expect(index.contracts[0].modulePath).toBe("/project");
  });

  it("scans only within sourceRoot", async () => {
    mockedReaddir.mockImplementation(async (dir: unknown) => {
      const d = dir as string;
      if (d === "/project/src") return [makeDirent("module.md", false)] as Dirent[];
      return [] as Dirent[];
    });

    mockedReadFileSync.mockReturnValue("content");
    mockedParseFrontmatter.mockReturnValue({
      frontmatter: {},
      body: "Src module.",
    });

    const config: ModuleGateConfig = {
      moduleDescriptorFileName: "module.md",
      moduleDescriptorReadonly: "file",
      sourceRoot: "src/",
      disableModuleInterfaceImportGate: false,
      disableSystemPrompt: false,
      outputModuleProseOnBlock: false,
    };
    const index = await buildModuleIndex(makeCtx("/project"), config);

    expect(index.contracts).toHaveLength(1);
    expect(index.contracts[0].modulePath).toBe("/project/src");
  });

  it("complements child visible with parent's path-based entry", async () => {
    mockedReaddir.mockImplementation(async (dir: unknown) => {
      const d = dir as string;
      if (d === "/project") return [makeDirent("module.md", false), makeDirent("sub", true)] as Dirent[];
      if (d === "/project/sub") return [makeDirent("module.md", false)] as Dirent[];
      return [] as Dirent[];
    });

    mockedReadFileSync.mockImplementation((p: unknown): string => {
      const filePath = p as string;
      if (filePath.endsWith("project/sub/module.md")) return "child";
      return "parent";
    });

    mockedParseFrontmatter.mockImplementation((content: string) => {
      if (content === "parent") return { frontmatter: { visible: [{ path: "sub/Helper" }] }, body: "" };
      return { frontmatter: { visible: ["OwnType"] }, body: "" };
    });

    const index = await buildModuleIndex(makeCtx("/project"), defaultConfig);

    expect(index.contracts).toHaveLength(2);
    const child = index.contracts.find((c) => c.modulePath === "/project/sub")!;
    expect(child.visible).toEqual(
      expect.arrayContaining([
        { name: "OwnType", path: "OwnType" },
        { name: "Helper" },
      ])
    );
    const parent = index.contracts.find((c) => c.modulePath === "/project")!;
    expect(parent.visible).toEqual([{ name: "Helper", path: "sub/Helper" }]);
  });

  it("does not complement when child has no module.md", async () => {
    mockedReaddir.mockImplementation(async (dir: unknown) => {
      const d = dir as string;
      if (d === "/project") return [makeDirent("module.md", false), makeDirent("sub", true)] as Dirent[];
      if (d === "/project/sub") return [makeDirent("lib.rs", false)] as Dirent[];
      return [] as Dirent[];
    });

    mockedReadFileSync.mockReturnValue("content");
    mockedParseFrontmatter.mockReturnValue({
      frontmatter: { visible: [{ path: "sub/Helper" }] },
      body: "",
    });

    const index = await buildModuleIndex(makeCtx("/project"), defaultConfig);

    expect(index.contracts).toHaveLength(1);
    expect(index.contracts[0].visible).toEqual([{ name: "Helper", path: "sub/Helper" }]);
  });

  it("complements with trailing slash (directory as module reference)", async () => {
    mockedReaddir.mockImplementation(async (dir: unknown) => {
      const d = dir as string;
      if (d === "/project") return [makeDirent("module.md", false), makeDirent("sub", true)] as Dirent[];
      if (d === "/project/sub") return [makeDirent("module.md", false)] as Dirent[];
      return [] as Dirent[];
    });

    mockedReadFileSync.mockImplementation((p: unknown): string => {
      const filePath = p as string;
      if (filePath.endsWith("project/sub/module.md")) return "child";
      return "parent";
    });

    mockedParseFrontmatter.mockImplementation((content: string) => {
      if (content === "parent") return { frontmatter: { visible: [{ path: "sub/" }] }, body: "" };
      return { frontmatter: { visible: [] }, body: "" };
    });

    const index = await buildModuleIndex(makeCtx("/project"), defaultConfig);

    const child = index.contracts.find((c) => c.modulePath === "/project/sub")!;
    expect(child.visible).toEqual(expect.arrayContaining([{ name: "sub" }]));
  });

  it("complements with bare string path containing slash", async () => {
    mockedReaddir.mockImplementation(async (dir: unknown) => {
      const d = dir as string;
      if (d === "/project") return [makeDirent("module.md", false), makeDirent("sub", true)] as Dirent[];
      if (d === "/project/sub") return [makeDirent("module.md", false)] as Dirent[];
      return [] as Dirent[];
    });

    mockedReadFileSync.mockImplementation((p: unknown): string => {
      const filePath = p as string;
      if (filePath.endsWith("project/sub/module.md")) return "child";
      return "parent";
    });

    mockedParseFrontmatter.mockImplementation((content: string) => {
      if (content === "parent") return { frontmatter: { visible: ["sub/Helper"] }, body: "" };
      return { frontmatter: { visible: [] }, body: "" };
    });

    const index = await buildModuleIndex(makeCtx("/project"), defaultConfig);

    const child = index.contracts.find((c) => c.modulePath === "/project/sub")!;
    expect(child.visible).toEqual(expect.arrayContaining([{ name: "Helper" }]));
  });
});
