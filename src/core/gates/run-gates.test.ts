import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
  runGates,
  checkDescriptorFileReadonly,
  formatDenial,
  isDescriptorFile,
  extractFrontmatter,
} from "./run-gates.ts";
import "./checkers/index.ts";
import type { ModuleIndex, ModuleContract } from "../types.ts";
import type { ModuleGateConfig } from "../config.ts";

function makeIndex(
  contracts: ModuleContract[],
  dirToModule?: Map<string, string>,
): ModuleIndex {
  return { contracts, dirToModule: dirToModule ?? new Map() };
}

function cfg(over: Partial<ModuleGateConfig> = {}): ModuleGateConfig {
  return {
    moduleDescriptorFileName: "module.md",
    moduleDescriptorReadonly: "file",
    sourceRoots: [""],
    disableModuleInterfaceImportGate: false,
    disableSystemPrompt: false,
    outputModuleProseOnBlock: false,
    ...over,
  };
}

let tmp: string;
beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "pmg-rungates-"));
});
afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

function writeSource(relativePath: string, content: string): string {
  const abs = path.join(tmp, relativePath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content, "utf-8");
  return abs;
}

describe("runGates", () => {
  it("returns undefined when no contracts exist", () => {
    writeSource("src/foo.ts", "");
    const index = makeIndex([]);
    const result = runGates("src/foo.ts", [{ oldText: "", newText: "" }], tmp, index, cfg());
    expect(result).toBeUndefined();
  });

  it("blocks readonly files", () => {
    writeSource("src/locked.ts", "");
    const index = makeIndex([
      { modulePath: path.join(tmp, "src"), descriptorFileName: "module.md", readonly: ["module.md", "locked.ts"], noNewExports: [], prose: "" },
    ]);
    const result = runGates("src/locked.ts", [{ oldText: "", newText: "x" }], tmp, index, cfg());
    expect(result?.block).toBe(true);
    expect(result?.reason).toContain("Readonly rule");
  });

  it("blocks no-new-exports file when adding a new export", () => {
    writeSource("src/no-new-exports.ts", "export function a() {}");
    const index = makeIndex([
      { modulePath: path.join(tmp, "src"), descriptorFileName: "module.md", readonly: ["module.md"], noNewExports: ["no-new-exports.ts"], prose: "" },
    ]);
    const after = "export function a() {}\nexport function b() {}";
    const result = runGates("src/no-new-exports.ts", [{ oldText: "export function a() {}", newText: after }], tmp, index, cfg());
    expect(result?.block).toBe(true);
    expect(result?.reason).toContain("No-new-exports rule");
    expect(result?.reason).toContain("b");
  });

  it("returns undefined when edit does not add exports on no-new-exports file", () => {
    writeSource("src/no-new-exports.ts", "export function a() { return 1; }");
    const index = makeIndex([
      { modulePath: path.join(tmp, "src"), descriptorFileName: "module.md", readonly: [], noNewExports: ["no-new-exports.ts"], prose: "" },
    ]);
    const result = runGates(
      "src/no-new-exports.ts",
      [{ oldText: "return 1;", newText: "return 2;" }],
      tmp,
      index,
      cfg(),
    );
    expect(result).toBeUndefined();
  });
});

describe("formatDenial", () => {
  it("omits module prose when outputModuleProseOnBlock is false (default)", () => {
    const modulePath = path.join(tmp, "src");
    const index: ModuleIndex = {
      contracts: [
        { modulePath, descriptorFileName: "module.md", readonly: ["locked.ts"], noNewExports: [], prose: "Greeting module." },
      ],
      dirToModule: new Map([[modulePath, modulePath]]),
    };
    const formatted = formatDenial("src/locked.ts", "Readonly rule", path.join(modulePath, "locked.ts"), index, tmp, false);
    expect(formatted).toContain("[Module Gate]");
    expect(formatted).not.toContain("Greeting module.");
    expect(formatted).not.toContain("Module contract");
  });

  it("includes module prose when outputModuleProseOnBlock is true", () => {
    const modulePath = path.join(tmp, "src");
    const index: ModuleIndex = {
      contracts: [
        { modulePath, descriptorFileName: "module.md", readonly: ["locked.ts"], noNewExports: [], prose: "Greeting module." },
      ],
      dirToModule: new Map([[modulePath, modulePath]]),
    };
    const formatted = formatDenial("src/locked.ts", "Readonly rule", path.join(modulePath, "locked.ts"), index, tmp, true);
    expect(formatted).toContain("[Module Gate]");
    expect(formatted).toContain("Greeting module.");
  });

  it("uses contract's descriptorFileName (preserving case) in the contract reference", () => {
    const modulePath = path.join(tmp, "src");
    const index: ModuleIndex = {
      contracts: [
        { modulePath, descriptorFileName: "MODULE.md", readonly: ["locked.ts"], noNewExports: [], prose: "Greeting module." },
      ],
      dirToModule: new Map([[modulePath, modulePath]]),
    };
    const formatted = formatDenial("src/locked.ts", "Readonly rule", path.join(modulePath, "locked.ts"), index, tmp, true);
    expect(formatted).toContain("MODULE.md");
  });
});

describe("isDescriptorFile", () => {
  it("matches case-insensitively", () => {
    expect(isDescriptorFile("/p/src/MODULE.md", "module.md")).toBe(true);
    expect(isDescriptorFile("/p/src/module.md", "MODULE.md")).toBe(true);
    expect(isDescriptorFile("/p/src/other.ts", "module.md")).toBe(false);
  });
});

describe("extractFrontmatter", () => {
  it("returns empty object on malformed input", () => {
    expect(extractFrontmatter("not yaml")).toEqual({});
  });

  it("parses valid frontmatter", () => {
    const fm = extractFrontmatter("---\nreadonly: [x]\n---\nbody");
    expect(fm).toMatchObject({ readonly: ["x"] });
  });
});

describe("checkDescriptorFileReadonly", () => {
  const MODULE_BODY_OLD = "---\nreadonly: [x]\n---\nBody text.";
  const MODULE_BODY_NEW = "---\nreadonly: [x]\n---\nBody changed.";
  const MODULE_FM_CHANGED = "---\nreadonly: [x, y]\n---\nBody text.";

  describe('mode "file"', () => {
    it("blocks any edit to the descriptor file body", () => {
      const result = checkDescriptorFileReadonly(
        "/p/module.md",
        MODULE_BODY_OLD,
        MODULE_BODY_NEW,
        cfg({ moduleDescriptorReadonly: "file" }),
      );
      expect(result?.block).toBe(true);
    });

    it("blocks any edit that changes only frontmatter", () => {
      const result = checkDescriptorFileReadonly(
        "/p/module.md",
        MODULE_BODY_OLD,
        MODULE_FM_CHANGED,
        cfg({ moduleDescriptorReadonly: "file" }),
      );
      expect(result?.block).toBe(true);
    });

    it("blocks descriptor when file is uppercase (MODULE.md) even though config name is lowercase", () => {
      const result = checkDescriptorFileReadonly(
        "/p/src/MODULE.md",
        MODULE_BODY_OLD,
        MODULE_BODY_NEW,
        cfg({ moduleDescriptorFileName: "module.md", moduleDescriptorReadonly: "file" }),
      );
      expect(result?.block).toBe(true);
      if (result?.block) {
        expect(result.reason).toContain("MODULE.md");
        expect(result.reason).not.toContain("module.md");
      }
    });

    it("does not affect non-descriptor files", () => {
      const result = checkDescriptorFileReadonly(
        "/p/src/app.ts",
        "x",
        "y",
        cfg({ moduleDescriptorReadonly: "file" }),
      );
      expect(result).toBeUndefined();
    });
  });

  describe('mode "frontmatter"', () => {
    it("allows edit that changes only body", () => {
      const result = checkDescriptorFileReadonly(
        "/p/module.md",
        MODULE_BODY_OLD,
        MODULE_BODY_NEW,
        cfg({ moduleDescriptorReadonly: "frontmatter" }),
      );
      expect(result).toBeUndefined();
    });

    it("blocks edit that changes frontmatter", () => {
      const result = checkDescriptorFileReadonly(
        "/p/module.md",
        MODULE_BODY_OLD,
        MODULE_FM_CHANGED,
        cfg({ moduleDescriptorReadonly: "frontmatter" }),
      );
      expect(result?.block).toBe(true);
    });
  });

  describe('mode "off"', () => {
    it("allows any edit to the descriptor file", () => {
      const result = checkDescriptorFileReadonly(
        "/p/module.md",
        MODULE_BODY_OLD,
        MODULE_FM_CHANGED,
        cfg({ moduleDescriptorReadonly: "off" }),
      );
      expect(result).toBeUndefined();
    });
  });
});

describe("runGates descriptor protection (independent of readonly list)", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pmg-descriptor-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("blocks edit to uppercase MODULE.md in file mode even when not listed in readonly", () => {
    const modulePath = path.join(tmpDir, "src");
    fs.mkdirSync(modulePath, { recursive: true });
    const moduleAbs = path.join(modulePath, "MODULE.md");
    fs.writeFileSync(
      moduleAbs,
      "---\nno-new-exports: [config.ts]\n---\nProse.",
      "utf-8",
    );
    const index: ModuleIndex = {
      contracts: [
        {
          modulePath,
          descriptorFileName: "MODULE.md",
          readonly: [],
          noNewExports: ["config.ts"],
          prose: "Prose.",
        },
      ],
      dirToModule: new Map([[modulePath, modulePath]]),
    };
    const result = runGates(
      "src/MODULE.md",
      [{ oldText: "Prose.", newText: "Changed prose." }],
      tmpDir,
      index,
      cfg({ moduleDescriptorFileName: "MODULE.md", moduleDescriptorReadonly: "file", sourceRoots: ["src/"] }),
    );
    expect(result?.block).toBe(true);
    expect(result?.reason).toContain("Readonly rule");
    expect(result?.reason).toContain("MODULE.md");
  });

  it("blocks edit to lowercase module.md in file mode even when not listed in readonly", () => {
    const modulePath = path.join(tmpDir, "src");
    fs.mkdirSync(modulePath, { recursive: true });
    const moduleAbs = path.join(modulePath, "module.md");
    fs.writeFileSync(moduleAbs, "---\nno-new-exports: [config.ts]\n---\nProse.", "utf-8");
    const index: ModuleIndex = {
      contracts: [
        { modulePath, descriptorFileName: "module.md", readonly: [], noNewExports: ["config.ts"], prose: "Prose." },
      ],
      dirToModule: new Map([[modulePath, modulePath]]),
    };
    const result = runGates(
      "src/module.md",
      [{ oldText: "Prose.", newText: "Changed." }],
      tmpDir,
      index,
      cfg({ sourceRoots: ["src/"] }),
    );
    expect(result?.block).toBe(true);
  });
});