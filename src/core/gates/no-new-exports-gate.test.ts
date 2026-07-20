import { describe, it, expect } from "vitest";
import { checkNoNewExports } from "./no-new-exports-gate.ts";
import type { ModuleIndex, ModuleContract } from "../types.ts";
import "./checkers/typescript.ts";

function makeIndex(contracts: ModuleContract[]): ModuleIndex {
  return { contracts, dirToModule: new Map() };
}

describe("checkNoNewExports", () => {
  const cwd = "/project";

  it("blocks when new export is added to no-new-exports file", () => {
    const index = makeIndex([
      {
        modulePath: "/project/src",
        descriptorFileName: "module.md",
        readonly: ["module.md"],
        noNewExports: ["no-new-exports.ts"],
        prose: "",
      },
    ]);

    const before = "export function existingFn() {}";
    const after = "export function existingFn() {}\nexport function newFn() {}";
    const result = checkNoNewExports("src/no-new-exports.ts", before, after, index, cwd);

    expect(result.blocked).toBe(true);
    if (result.blocked) {
      expect(result.reason).toContain("No-new-exports rule");
      expect(result.reason).toContain("newFn");
    }
  });

  it("allows edit without new exports on no-new-exports file", () => {
    const index = makeIndex([
      {
        modulePath: "/project/src",
        descriptorFileName: "module.md",
        readonly: ["module.md"],
        noNewExports: ["no-new-exports.ts"],
        prose: "",
      },
    ]);

    const before = "export function existingFn() { return 1; }";
    const after = "export function existingFn() { return 2; }";
    const result = checkNoNewExports("src/no-new-exports.ts", before, after, index, cwd);

    expect(result.blocked).toBe(false);
  });

  it("allows file not in no-new-exports list", () => {
    const index = makeIndex([
      {
        modulePath: "/project/src",
        descriptorFileName: "module.md",
        readonly: ["module.md"],
        noNewExports: ["no-new-exports.ts"],
        prose: "",
      },
    ]);

    const before = "";
    const after = "export function anything() {}";
    const result = checkNoNewExports("src/app.ts", before, after, index, cwd);

    expect(result.blocked).toBe(false);
  });

  it("allows when no checker exists for extension", () => {
    const index = makeIndex([
      {
        modulePath: "/project/src",
        descriptorFileName: "module.md",
        readonly: ["module.md"],
        noNewExports: ["data.json"],
        prose: "",
      },
    ]);

    const result = checkNoNewExports(
      "src/data.json",
      "{}",
      '{"new": true}',
      index,
      cwd,
      
    );

    expect(result.blocked).toBe(false);
  });

  it("checks ancestor module no-new-exports patterns", () => {
    const index = makeIndex([
      {
        modulePath: "/project",
        descriptorFileName: "module.md",
        readonly: ["module.md"],
        noNewExports: ["src/no-new-exports.ts"],
        prose: "",
      },
      {
        modulePath: "/project/src",
        descriptorFileName: "module.md",
        readonly: ["module.md"],
        noNewExports: [],
        prose: "",
      },
    ]);

    const before = "export function existingFn() {}";
    const after = "export function existingFn() {}\nexport function newFn() {}";
    const result = checkNoNewExports("src/no-new-exports.ts", before, after, index, cwd);

    expect(result.blocked).toBe(true);
    if (result.blocked) {
      expect(result.reason).toContain("newFn");
    }
  });

  it("blocks new export matching directory pattern", () => {
    const index = makeIndex([
      {
        modulePath: "/project/src",
        descriptorFileName: "module.md",
        readonly: ["module.md"],
        noNewExports: ["vendor"],
        prose: "",
      },
    ]);

    const before = "";
    const after = "export function newFn() {}";
    const result = checkNoNewExports("src/vendor/lib.ts", before, after, index, cwd);

    expect(result.blocked).toBe(true);
  });

  it("blocks new export matching glob pattern", () => {
    const index = makeIndex([
      {
        modulePath: "/project/src",
        descriptorFileName: "module.md",
        readonly: ["module.md"],
        noNewExports: ["generated*"],
        prose: "",
      },
    ]);

    const before = "";
    const after = "export function newFn() {}";
    const result = checkNoNewExports("src/generated-types.ts", before, after, index, cwd);

    expect(result.blocked).toBe(true);
  });

  it("allows when index has no contracts", () => {
    const index = makeIndex([]);

    const before = "";
    const after = "export function anything() {}";
    const result = checkNoNewExports("src/app.ts", before, after, index, cwd);

    expect(result.blocked).toBe(false);
  });

  it("allows when no no-new-exports patterns match", () => {
    const index = makeIndex([
      {
        modulePath: "/project/src",
        descriptorFileName: "module.md",
        readonly: ["module.md"],
        noNewExports: [],
        prose: "",
      },
    ]);

    const before = "";
    const after = "export function anything() {}";
    const result = checkNoNewExports("src/app.ts", before, after, index, cwd);

    expect(result.blocked).toBe(false);
  });

  it("reports all new export names in reason", () => {
    const index = makeIndex([
      {
        modulePath: "/project/src",
        descriptorFileName: "module.md",
        readonly: ["module.md"],
        noNewExports: ["no-new-exports.ts"],
        prose: "",
      },
    ]);

    const before = "export function existingFn() {}";
    const after =
      "export function existingFn() {}\nexport function newA() {}\nexport type newB = string;";
    const result = checkNoNewExports("src/no-new-exports.ts", before, after, index, cwd);

    expect(result.blocked).toBe(true);
    if (result.blocked) {
      expect(result.reason).toContain("newA");
      expect(result.reason).toContain("newB");
    }
  });

  it("pinpoints immediate module in ancestor chain", () => {
    const index = makeIndex([
      {
        modulePath: "/project",
        descriptorFileName: "module.md",
        readonly: ["module.md"],
        noNewExports: [],
        prose: "",
      },
      {
        modulePath: "/project/src",
        descriptorFileName: "module.md",
        readonly: ["module.md"],
        noNewExports: ["no-new-exports.ts"],
        prose: "",
      },
    ]);

    const before = "";
    const after = "export function newFn() {}";
    const result = checkNoNewExports("src/no-new-exports.ts", before, after, index, cwd);

    expect(result.blocked).toBe(true);
    if (result.blocked) {
      expect(result.reason).toContain("src/module.md");
    }
  });
});