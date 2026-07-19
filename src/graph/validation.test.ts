import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Dirent } from "node:fs";

vi.mock("node:fs/promises", () => ({
  readdir: vi.fn(),
}));

vi.mock("node:fs", () => ({
  readFileSync: vi.fn(),
}));

vi.mock("../gates/checkers/index.ts", () => ({
  getChecker: vi.fn(),
}));

import { readdir } from "node:fs/promises";
import * as fs from "node:fs";
import { getChecker } from "../gates/checkers/index.ts";
import { validateVisibleEntries } from "./validation.ts";
import type { ModuleIndex, ModuleContract } from "../types.ts";

const mockedReaddir = readdir as unknown as ReturnType<typeof vi.fn>;
const mockedReadFileSync = vi.mocked(fs.readFileSync);
const mockedGetChecker = vi.mocked(getChecker);

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

function makeIndex(contracts: ModuleContract[]): ModuleIndex {
  const dirToModule = new Map<string, string>();
  for (const c of contracts) {
    dirToModule.set(c.modulePath, c.modulePath);
  }
  return { contracts, dirToModule };
}

describe("validateVisibleEntries", () => {
  const cwd = "/project";
  let notifications: { message: string; type: string }[];

  beforeEach(() => {
    vi.clearAllMocks();
    notifications = [];
  });

  const notify = (message: string, type?: string): void => {
    notifications.push({ message, type: type ?? "info" });
  };

  it("warns on dangling visible entry with no matching export", async () => {
    const index = makeIndex([
      {
        modulePath: "/project",
        descriptorFileName: "module.md",
        visible: [{ name: "GhostType" }],
        readonly: ["module.md"],
        noNewExports: [],
        prose: "",
      },
    ]);

    mockedReaddir.mockImplementation(async () => {
      return [makeDirent("stub.ts", false)] as Dirent[];
    });

    mockedReadFileSync.mockReturnValue("// no exports here");
    mockedGetChecker.mockReturnValue({
      extensions: [".ts"],
      getNewExports: () => [],
    });

    await validateVisibleEntries(index, cwd, notify, "module.md");

    expect(notifications).toHaveLength(1);
    expect(notifications[0].message).toContain("Dangling visible entry");
    expect(notifications[0].message).toContain("GhostType");
    expect(notifications[0].type).toBe("info");
  });

  it("does not warn when visible entry exists as export", async () => {
    const index = makeIndex([
      {
        modulePath: "/project",
        descriptorFileName: "module.md",
        visible: [{ name: "greet" }],
        readonly: ["module.md"],
        noNewExports: [],
        prose: "",
      },
    ]);

    mockedReaddir.mockImplementation(async () => {
      return [makeDirent("app.ts", false)] as Dirent[];
    });

    mockedReadFileSync.mockReturnValue("export function greet() {}");
    mockedGetChecker.mockReturnValue({
      extensions: [".ts"],
      getNewExports: () => [{ name: "greet" }],
    });

    await validateVisibleEntries(index, cwd, notify, "module.md");

    expect(notifications).toHaveLength(0);
  });

  it("skips modules with no visible key", async () => {
    const index = makeIndex([
      {
        modulePath: "/project",
        descriptorFileName: "module.md",
        visible: null,
        readonly: ["module.md"],
        noNewExports: [],
        prose: "",
      },
    ]);

    await validateVisibleEntries(index, cwd, notify, "module.md");
    expect(notifications).toHaveLength(0);
  });

  it("skips files without a checker", async () => {
    const index = makeIndex([
      {
        modulePath: "/project",
        descriptorFileName: "module.md",
        visible: [{ name: "anything" }],
        readonly: ["module.md"],
        noNewExports: [],
        prose: "",
      },
    ]);

    mockedReaddir.mockImplementation(async () => {
      return [makeDirent("data.json", false)] as Dirent[];
    });

    mockedGetChecker.mockReturnValue(undefined);

    await validateVisibleEntries(index, cwd, notify, "module.md");

    expect(notifications).toHaveLength(1);
  });

  it("skips nested child module directories", async () => {
    const index = makeIndex([
      {
        modulePath: "/project",
        descriptorFileName: "module.md",
        visible: [{ name: "GhostType" }],
        readonly: ["module.md"],
        noNewExports: [],
        prose: "",
      },
      {
        modulePath: "/project/src",
        descriptorFileName: "module.md",
        visible: [{ name: "greet" }],
        readonly: ["module.md"],
        noNewExports: [],
        prose: "",
      },
    ]);

    const filesInRoot: Dirent[] = [makeDirent("stub.ts", false), makeDirent("src", true)];
    const filesInSrc: Dirent[] = [makeDirent("app.ts", false)];

    mockedReaddir.mockImplementation(async (dir: unknown) => {
      const d = dir as string;
      if (d === "/project") return filesInRoot;
      if (d === "/project/src") return filesInSrc;
      return [] as Dirent[];
    });

    mockedReadFileSync.mockImplementation((path: unknown): string => {
      const p = path as string;
      if (p === "/project/stub.ts") return "// no exports here";
      if (p === "/project/src/app.ts") return "export function greet() {}";
      return "";
    });

    mockedGetChecker.mockImplementation((filePath) => {
      if (filePath.endsWith(".ts")) {
        return {
          extensions: [".ts"],
          getNewExports: (_before: string, after: string) => {
            if (after.includes("export function greet")) return [{ name: "greet" }];
            return [];
          },
        };
      }
      return undefined;
    });

    await validateVisibleEntries(index, cwd, notify, "module.md");

    expect(notifications).toHaveLength(1);
    expect(notifications[0].message).toContain("GhostType");
    expect(notifications[0].message).toContain("module.md");
  });

  it("reports multiple dangling entries from same module", async () => {
    const index = makeIndex([
      {
        modulePath: "/project",
        descriptorFileName: "module.md",
        visible: [{ name: "GhostA" }, { name: "GhostB" }],
        readonly: ["module.md"],
        noNewExports: [],
        prose: "",
      },
    ]);

    mockedReaddir.mockImplementation(async () => {
      return [makeDirent("stub.ts", false)] as Dirent[];
    });

    mockedReadFileSync.mockReturnValue("// no exports");
    mockedGetChecker.mockReturnValue({
      extensions: [".ts"],
      getNewExports: () => [],
    });

    await validateVisibleEntries(index, cwd, notify, "module.md");

    expect(notifications).toHaveLength(2);
  });
});
