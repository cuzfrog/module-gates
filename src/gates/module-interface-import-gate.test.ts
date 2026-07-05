import { describe, it, expect, afterEach } from "vitest";
import { tmpdir } from "node:os";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { checkModuleInterfaceImports } from "./module-interface-import-gate.ts";
import type { ModuleIndex } from "../types.ts";
import "./checkers/index.ts";

function makeIndex(dirToModule: Map<string, string>): ModuleIndex {
  return { contracts: [], dirToModule };
}

let tmpDir: string;

function setup(): string {
  tmpDir = mkdtempSync(join(tmpdir(), "module-import-gate-test-"));
  return tmpDir;
}

afterEach(() => {
  if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
});

function createDir(...segments: string[]): string {
  const dir = join(tmpDir, ...segments);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function createFile(content: string, ...segments: string[]): string {
  const filePath = join(tmpDir, ...segments);
  const dir = join(tmpDir, ...segments.slice(0, -1));
  mkdirSync(dir, { recursive: true });
  writeFileSync(filePath, content);
  return filePath;
}

describe("checkModuleInterfaceImports", () => {
  it("blocks import from non-interface file in another module", () => {
    setup();
    createFile("", "src", "module1", "module.md");
    createFile("export function foo() {}", "src", "module1", "file1.ts");
    createFile("", "src", "module2", "module.md");
    createDir("src", "module2");

    const dirToModule = new Map<string, string>();
    dirToModule.set(join(tmpDir, "src", "module1"), join(tmpDir, "src", "module1"));
    dirToModule.set(join(tmpDir, "src", "module2"), join(tmpDir, "src", "module2"));
    const index = makeIndex(dirToModule);

    const content = 'import { foo } from "../module1/file1";\n';
    const result = checkModuleInterfaceImports(
      "src/module2/app.ts",
      content,
      index,
      tmpDir,
      false,
      ["src/"],
    );

    expect(result.blocked).toBe(true);
    if (result.blocked) {
      expect(result.reason).toContain("file1.ts");
    }
  });

  it("allows import from interface file (index.ts)", () => {
    setup();
    createFile("", "src", "module1", "module.md");
    createFile("export function foo() {}", "src", "module1", "index.ts");
    createFile("", "src", "module2", "module.md");
    createDir("src", "module2");

    const dirToModule = new Map<string, string>();
    dirToModule.set(join(tmpDir, "src", "module1"), join(tmpDir, "src", "module1"));
    dirToModule.set(join(tmpDir, "src", "module2"), join(tmpDir, "src", "module2"));
    const index = makeIndex(dirToModule);

    const content = 'import { foo } from "../module1/index";\n';
    const result = checkModuleInterfaceImports(
      "src/module2/app.ts",
      content,
      index,
      tmpDir,
      false,
      ["src/"],
    );

    expect(result.blocked).toBe(false);
  });

  it("allows import from sibling file in same directory", () => {
    setup();
    createFile("", "src", "module1", "module.md");
    createFile("export function bar() {}", "src", "module1", "file2.ts");

    const dirToModule = new Map<string, string>();
    dirToModule.set(join(tmpDir, "src", "module1"), join(tmpDir, "src", "module1"));
    const index = makeIndex(dirToModule);

    const content = 'import { bar } from "./file2";\n';
    const result = checkModuleInterfaceImports(
      "src/module1/file1.ts",
      content,
      index,
      tmpDir,
      false,
      ["src/"],
    );

    expect(result.blocked).toBe(false);
  });

  it("skips imports resolving to node_modules", () => {
    setup();
    createFile("", "src", "module1", "module.md");
    createFile("export function foo() {}", "node_modules", "some-pkg", "index.ts");
    createDir("src", "module1");

    const dirToModule = new Map<string, string>();
    dirToModule.set(join(tmpDir, "src", "module1"), join(tmpDir, "src", "module1"));
    const index = makeIndex(dirToModule);

    const content = 'import { foo } from "some-pkg";\n';
    const result = checkModuleInterfaceImports(
      "src/module1/app.ts",
      content,
      index,
      tmpDir,
      false,
      ["src/"],
    );

    expect(result.blocked).toBe(false);
  });

  it("blocks extensionless import resolving to non-interface file", () => {
    setup();
    createFile("", "src", "module1", "module.md");
    createFile("export function foo() {}", "src", "module1", "file1.ts");
    createFile("", "src", "module2", "module.md");
    createDir("src", "module2");

    const dirToModule = new Map<string, string>();
    dirToModule.set(join(tmpDir, "src", "module1"), join(tmpDir, "src", "module1"));
    dirToModule.set(join(tmpDir, "src", "module2"), join(tmpDir, "src", "module2"));
    const index = makeIndex(dirToModule);

    const content = 'import { foo } from "../module1/file1";\n';
    const result = checkModuleInterfaceImports(
      "src/module2/app.ts",
      content,
      index,
      tmpDir,
      false,
      ["src/"],
    );

    expect(result.blocked).toBe(true);
  });

  it("allows when no module.md governs the target", () => {
    setup();
    createFile("export function foo() {}", "src", "other", "file1.ts");
    createDir("src", "module1");
    createFile("", "src", "module1", "module.md");

    const dirToModule = new Map<string, string>();
    dirToModule.set(join(tmpDir, "src", "module1"), join(tmpDir, "src", "module1"));
    const index = makeIndex(dirToModule);

    const content = 'import { foo } from "../other/file1";\n';
    const result = checkModuleInterfaceImports(
      "src/module1/app.ts",
      content,
      index,
      tmpDir,
      false,
      ["src/"],
    );

    expect(result.blocked).toBe(false);
  });

  it("allows when config disabled", () => {
    setup();
    createFile("", "src", "module1", "module.md");
    createFile("export function foo() {}", "src", "module1", "file1.ts");
    createFile("", "src", "module2", "module.md");
    createDir("src", "module2");

    const dirToModule = new Map<string, string>();
    dirToModule.set(join(tmpDir, "src", "module1"), join(tmpDir, "src", "module1"));
    dirToModule.set(join(tmpDir, "src", "module2"), join(tmpDir, "src", "module2"));
    const index = makeIndex(dirToModule);

    const content = 'import { foo } from "../module1/file1";\n';
    const result = checkModuleInterfaceImports(
      "src/module2/app.ts",
      content,
      index,
      tmpDir,
      true,
      ["src/"],
    );

    expect(result.blocked).toBe(false);
  });

  it("blocks Rust use of non-mod.rs file in another module", () => {
    setup();
    createFile("", "src", "module1", "module.md");
    createFile("pub fn foo() {}", "src", "module1", "internal.rs");
    createFile("", "src", "module2", "module.md");
    createDir("src", "module2");

    const dirToModule = new Map<string, string>();
    dirToModule.set(join(tmpDir, "src", "module1"), join(tmpDir, "src", "module1"));
    dirToModule.set(join(tmpDir, "src", "module2"), join(tmpDir, "src", "module2"));
    const index = makeIndex(dirToModule);

    const content = "use crate::module1::internal::foo;\n";
    const result = checkModuleInterfaceImports(
      "src/module2/app.rs",
      content,
      index,
      tmpDir,
      false,
      ["src/"],
    );

    expect(result.blocked).toBe(true);
    if (result.blocked) {
      expect(result.reason).toContain("internal.rs");
    }
  });

  it("allows Rust use of mod.rs", () => {
    setup();
    createFile("", "src", "module1", "module.md");
    createFile("pub fn foo() {}", "src", "module1", "mod.rs");
    createFile("", "src", "module2", "module.md");
    createDir("src", "module2");

    const dirToModule = new Map<string, string>();
    dirToModule.set(join(tmpDir, "src", "module1"), join(tmpDir, "src", "module1"));
    dirToModule.set(join(tmpDir, "src", "module2"), join(tmpDir, "src", "module2"));
    const index = makeIndex(dirToModule);

    const content = "use crate::module1::foo;\n";
    const result = checkModuleInterfaceImports(
      "src/module2/app.rs",
      content,
      index,
      tmpDir,
      false,
      ["src/"],
    );

    expect(result.blocked).toBe(false);
  });

  it("allows require from interface file", () => {
    setup();
    createFile("", "src", "module1", "module.md");
    createFile("export function foo() {}", "src", "module1", "index.ts");
    createFile("", "src", "module2", "module.md");
    createDir("src", "module2");

    const dirToModule = new Map<string, string>();
    dirToModule.set(join(tmpDir, "src", "module1"), join(tmpDir, "src", "module1"));
    dirToModule.set(join(tmpDir, "src", "module2"), join(tmpDir, "src", "module2"));
    const index = makeIndex(dirToModule);

    const content = 'const { foo } = require("../module1/index");\n';
    const result = checkModuleInterfaceImports(
      "src/module2/app.ts",
      content,
      index,
      tmpDir,
      false,
      ["src/"],
    );

    expect(result.blocked).toBe(false);
  });

  it("blocks require from non-interface file", () => {
    setup();
    createFile("", "src", "module1", "module.md");
    createFile("export function foo() {}", "src", "module1", "file1.ts");
    createFile("", "src", "module2", "module.md");
    createDir("src", "module2");

    const dirToModule = new Map<string, string>();
    dirToModule.set(join(tmpDir, "src", "module1"), join(tmpDir, "src", "module1"));
    dirToModule.set(join(tmpDir, "src", "module2"), join(tmpDir, "src", "module2"));
    const index = makeIndex(dirToModule);

    const content = 'const { foo } = require("../module1/file1");\n';
    const result = checkModuleInterfaceImports(
      "src/module2/app.ts",
      content,
      index,
      tmpDir,
      false,
      ["src/"],
    );

    expect(result.blocked).toBe(true);
  });

  it("skips bare imports that are not relative", () => {
    setup();
    createFile("", "src", "module1", "module.md");
    createDir("src", "module1");

    const dirToModule = new Map<string, string>();
    dirToModule.set(join(tmpDir, "src", "module1"), join(tmpDir, "src", "module1"));
    const index = makeIndex(dirToModule);

    const content = 'import { foo } from "some-library";\n';
    const result = checkModuleInterfaceImports(
      "src/module1/app.ts",
      content,
      index,
      tmpDir,
      false,
      ["src/"],
    );

    expect(result.blocked).toBe(false);
  });

  it("reports multiple violations in one edit", () => {
    setup();
    createFile("", "src", "module1", "module.md");
    createFile("export function foo() {}", "src", "module1", "file1.ts");
    createFile("export function bar() {}", "src", "module1", "file2.ts");
    createFile("", "src", "module2", "module.md");
    createDir("src", "module2");

    const dirToModule = new Map<string, string>();
    dirToModule.set(join(tmpDir, "src", "module1"), join(tmpDir, "src", "module1"));
    dirToModule.set(join(tmpDir, "src", "module2"), join(tmpDir, "src", "module2"));
    const index = makeIndex(dirToModule);

    const content = 'import { foo } from "../module1/file1";\nimport { bar } from "../module1/file2";\n';
    const result = checkModuleInterfaceImports(
      "src/module2/app.ts",
      content,
      index,
      tmpDir,
      false,
      ["src/"],
    );

    expect(result.blocked).toBe(true);
    if (result.blocked) {
      expect(result.reason).toContain("file1.ts");
      expect(result.reason).toContain("file2.ts");
    }
  });

  it("blocks import type from non-interface file in another module", () => {
    setup();
    createFile("", "src", "module1", "module.md");
    createFile("export type Foo = string;", "src", "module1", "types.ts");
    createFile("", "src", "module2", "module.md");
    createDir("src", "module2");

    const dirToModule = new Map<string, string>();
    dirToModule.set(join(tmpDir, "src", "module1"), join(tmpDir, "src", "module1"));
    dirToModule.set(join(tmpDir, "src", "module2"), join(tmpDir, "src", "module2"));
    const index = makeIndex(dirToModule);

    const content = 'import type { Foo } from "../module1/types";\n';
    const result = checkModuleInterfaceImports(
      "src/module2/app.ts",
      content,
      index,
      tmpDir,
      false,
      ["src/"],
    );

    expect(result.blocked).toBe(true);
    if (result.blocked) {
      expect(result.reason).toContain("types.ts");
    }
  });

  it("blocks import from non-interface file in a child module", () => {
    setup();
    createFile("", "src", "parent", "module.md");
    createFile("export function foo() {}", "src", "parent", "app.ts");
    createFile("", "src", "parent", "child", "module.md");
    createFile("export function bar() {}", "src", "parent", "child", "internal.ts");
    createDir("src", "parent");

    const dirToModule = new Map<string, string>();
    dirToModule.set(join(tmpDir, "src", "parent"), join(tmpDir, "src", "parent"));
    dirToModule.set(join(tmpDir, "src", "parent", "child"), join(tmpDir, "src", "parent", "child"));
    const index = makeIndex(dirToModule);

    const content = 'import { bar } from "./child/internal";\n';
    const result = checkModuleInterfaceImports(
      "src/parent/app.ts",
      content,
      index,
      tmpDir,
      false,
      ["src/"],
    );

    expect(result.blocked).toBe(true);
    if (result.blocked) {
      expect(result.reason).toContain("internal.ts");
    }
  });

  it("allows import from sibling file within the same module", () => {
    setup();
    createFile("", "src", "module1", "module.md");
    createFile("export function foo() {}", "src", "module1", "file1.ts");
    createFile("export function bar() {}", "src", "module1", "file2.ts");

    const dirToModule = new Map<string, string>();
    dirToModule.set(join(tmpDir, "src", "module1"), join(tmpDir, "src", "module1"));
    const index = makeIndex(dirToModule);

    const content = 'import { bar } from "./file2";\n';
    const result = checkModuleInterfaceImports(
      "src/module1/file1.ts",
      content,
      index,
      tmpDir,
      false,
      ["src/"],
    );

    expect(result.blocked).toBe(false);
  });

  it("allows import from internal sub-directory within the same module", () => {
    setup();
    createFile("", "src", "module1", "module.md");
    createFile("export function foo() {}", "src", "module1", "file1.ts");
    createDir("src", "module1", "sub");
    createFile("export function bar() {}", "src", "module1", "sub", "file2.ts");

    const dirToModule = new Map<string, string>();
    dirToModule.set(join(tmpDir, "src", "module1"), join(tmpDir, "src", "module1"));
    const index = makeIndex(dirToModule);

    const content = 'import { bar } from "../file1";\n';
    const result = checkModuleInterfaceImports(
      "src/module1/sub/file2.ts",
      content,
      index,
      tmpDir,
      false,
      ["src/"],
    );

    expect(result.blocked).toBe(false);
  });

  it("allows child module to import from parent module's internal file (not recommended but allowed)", () => {
    setup();
    createFile("", "src", "parent", "module.md");
    createFile("export type InternalType = string;", "src", "parent", "internal.ts");
    createFile("", "src", "parent", "child", "module.md");
    createFile("import type { InternalType } from \"../internal\";\nexport const consumer = (_x: InternalType) => {};", "src", "parent", "child", "consumer.ts");

    const dirToModule = new Map<string, string>();
    dirToModule.set(join(tmpDir, "src", "parent"), join(tmpDir, "src", "parent"));
    dirToModule.set(join(tmpDir, "src", "parent", "child"), join(tmpDir, "src", "parent", "child"));
    const index = makeIndex(dirToModule);

    const content = 'import type { InternalType } from "../internal";\n';
    const result = checkModuleInterfaceImports(
      "src/parent/child/consumer.ts",
      content,
      index,
      tmpDir,
      false,
      ["src/"],
    );

    expect(result.blocked).toBe(false);
  });

  it("still blocks parent module from importing child module's internal file", () => {
    setup();
    createFile("", "src", "parent", "module.md");
    createFile("", "src", "parent", "child", "module.md");
    createFile("export function hidden() {}", "src", "parent", "child", "internal.ts");
    createDir("src", "parent");

    const dirToModule = new Map<string, string>();
    dirToModule.set(join(tmpDir, "src", "parent"), join(tmpDir, "src", "parent"));
    dirToModule.set(join(tmpDir, "src", "parent", "child"), join(tmpDir, "src", "parent", "child"));
    const index = makeIndex(dirToModule);

    const content = 'import { hidden } from "./child/internal";\n';
    const result = checkModuleInterfaceImports(
      "src/parent/app.ts",
      content,
      index,
      tmpDir,
      false,
      ["src/"],
    );

    expect(result.blocked).toBe(true);
    if (result.blocked) {
      expect(result.reason).toContain("internal.ts");
    }
  });

  it("still blocks sibling module imports", () => {
    setup();
    createFile("", "src", "module1", "module.md");
    createFile("export function foo() {}", "src", "module1", "file1.ts");
    createFile("", "src", "module2", "module.md");
    createDir("src", "module2");

    const dirToModule = new Map<string, string>();
    dirToModule.set(join(tmpDir, "src", "module1"), join(tmpDir, "src", "module1"));
    dirToModule.set(join(tmpDir, "src", "module2"), join(tmpDir, "src", "module2"));
    const index = makeIndex(dirToModule);

    const content = 'import { foo } from "../module1/file1";\n';
    const result = checkModuleInterfaceImports(
      "src/module2/app.ts",
      content,
      index,
      tmpDir,
      false,
      ["src/"],
    );

    expect(result.blocked).toBe(true);
  });
});
