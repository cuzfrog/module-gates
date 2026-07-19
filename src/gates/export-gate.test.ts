import { describe, it, expect } from "vitest";
import { checkExports } from "./export-gate.ts";
import type { ModuleIndex, ModuleContract } from "../types.ts";
import "./checkers/typescript.ts";

function makeIndex(contracts: ModuleContract[]): ModuleIndex {
  return { contracts, dirToModule: new Map() };
}

describe("checkExports", () => {
  const cwd = "/project";

  it("blocks new export not in visible list", () => {
    const index = makeIndex([
      {
        modulePath: "/project/src",
        descriptorFileName: "module.md",
        visible: [{ name: "allowedFn" }],
        readonly: ["module.md"],
        noNewExports: [],
        prose: "",
      },
    ]);

    const before = "";
    const after = "export function notAllowed() {}";
    const result = checkExports("src/app.ts", before, after, index, cwd);

    expect(result.blocked).toBe(true);
    if (result.blocked) {
      expect(result.violations).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: "notAllowed" }),
        ]),
      );
    }
  });

  it("passes new export that is in visible list", () => {
    const index = makeIndex([
      {
        modulePath: "/project/src",
        descriptorFileName: "module.md",
        visible: [{ name: "allowedFn" }],
        readonly: ["module.md"],
        noNewExports: [],
        prose: "",
      },
    ]);

    const before = "";
    const after = "export function allowedFn() {}";
    const result = checkExports("src/app.ts", before, after, index, cwd);

    expect(result.blocked).toBe(false);
  });

  it("does not block when no checker exists for extension", () => {
    const index = makeIndex([
      {
        modulePath: "/project/src",
        descriptorFileName: "module.md",
        visible: [],
        readonly: ["module.md"],
        noNewExports: [],
        prose: "",
      },
    ]);

    const result = checkExports(
      "src/data.json",
      "{}",
      '{"new": true}',
      index,
      cwd,
      
    );

    expect(result.blocked).toBe(false);
  });

  it("all ancestor modules with visible key form intersection", () => {
    const index = makeIndex([
      {
        modulePath: "/project",
        descriptorFileName: "module.md",
        visible: [{ name: "sharedFn" }, { name: "rootOnly" }],
        readonly: ["module.md"],
        noNewExports: [],
        prose: "",
      },
      {
        modulePath: "/project/src",
        descriptorFileName: "module.md",
        visible: [{ name: "sharedFn" }, { name: "srcOnly" }],
        readonly: ["module.md"],
        noNewExports: [],
        prose: "",
      },
    ]);

    const before = "";
    const after = "export function rootOnly() {}";
    const result = checkExports("src/app.ts", before, after, index, cwd);

    expect(result.blocked).toBe(true);
    if (result.blocked) {
      expect(result.violations[0].name).toBe("rootOnly");
    }
  });

  it("module with no visible key does not constrain", () => {
    const index = makeIndex([
      {
        modulePath: "/project/src",
        descriptorFileName: "module.md",
        visible: null,
        readonly: ["module.md"],
        noNewExports: [],
        prose: "",
      },
    ]);

    const before = "";
    const after = "export function anything() {}";
    const result = checkExports("src/app.ts", before, after, index, cwd);

    expect(result.blocked).toBe(false);
  });

  it("empty visible list blocks all exports", () => {
    const index = makeIndex([
      {
        modulePath: "/project/src",
        descriptorFileName: "module.md",
        visible: [],
        readonly: ["module.md"],
        noNewExports: [],
        prose: "",
      },
    ]);

    const before = "";
    const after = "export function blocked() {}";
    const result = checkExports("src/app.ts", before, after, index, cwd);

    expect(result.blocked).toBe(true);
    if (result.blocked) {
      expect(result.violations[0].name).toBe("blocked");
    }
  });

  it("does not block when there are no new exports", () => {
    const index = makeIndex([
      {
        modulePath: "/project/src",
        descriptorFileName: "module.md",
        visible: [],
        readonly: ["module.md"],
        noNewExports: [],
        prose: "",
      },
    ]);

    const code = "export function existing() {}";
    const result = checkExports("src/app.ts", code, code, index, cwd);

    expect(result.blocked).toBe(false);
  });

  it("reports multiple new unlisted exports in one write", () => {
    const index = makeIndex([
      {
        modulePath: "/project/src",
        descriptorFileName: "module.md",
        visible: [{ name: "allowedFn" }],
        readonly: ["module.md"],
        noNewExports: [],
        prose: "",
      },
    ]);

    const before = "export function allowedFn() {}";
    const after =
      "export function allowedFn() {}\nexport function unlistedA() {}\nexport type unlistedB = string;";
    const result = checkExports("src/app.ts", before, after, index, cwd);

    expect(result.blocked).toBe(true);
    if (result.blocked) {
      expect(result.violations).toHaveLength(2);
      expect(result.violations.map((v) => v.name)).toEqual(
        expect.arrayContaining(["unlistedA", "unlistedB"]),
      );
    }
  });

  it("allows anything when index has no contracts", () => {
    const index = makeIndex([]);

    const before = "";
    const after = "export function anything() {}";
    const result = checkExports("src/app.ts", before, after, index, cwd);

    expect(result.blocked).toBe(false);
  });

  it("allows symbol listed in both child and parent visible", () => {
    const index = makeIndex([
      {
        modulePath: "/project",
        descriptorFileName: "module.md",
        visible: [{ name: "sharedFn" }, { name: "rootOnly" }],
        readonly: ["module.md"],
        noNewExports: [],
        prose: "",
      },
      {
        modulePath: "/project/src",
        descriptorFileName: "module.md",
        visible: [{ name: "sharedFn" }, { name: "srcOnly" }],
        readonly: ["module.md"],
        noNewExports: [],
        prose: "",
      },
    ]);

    const before = "";
    const after = "export function sharedFn() {}";
    const result = checkExports("src/app.ts", before, after, index, cwd);

    expect(result.blocked).toBe(false);
  });

  it("allows export when parent has no visible key but child does", () => {
    const index = makeIndex([
      {
        modulePath: "/project",
        descriptorFileName: "module.md",
        visible: null,
        readonly: ["module.md"],
        noNewExports: [],
        prose: "",
      },
      {
        modulePath: "/project/src",
        descriptorFileName: "module.md",
        visible: [{ name: "childFn" }],
        readonly: ["module.md"],
        noNewExports: [],
        prose: "",
      },
    ]);

    const before = "";
    const after = "export function childFn() {}";
    const result = checkExports("src/app.ts", before, after, index, cwd);

    expect(result.blocked).toBe(false);
  });

  it("allows export when immediate parent lists it, regardless of ancestor", () => {
    const index = makeIndex([
      {
        modulePath: "/project",
        descriptorFileName: "module.md",
        visible: [{ name: "rootOnly" }],
        readonly: ["module.md"],
        noNewExports: [],
        prose: "",
      },
      {
        modulePath: "/project/src",
        descriptorFileName: "module.md",
        visible: [{ name: "sharedFn" }],
        readonly: ["module.md"],
        noNewExports: [],
        prose: "",
      },
      {
        modulePath: "/project/src/payments",
        descriptorFileName: "module.md",
        visible: [{ name: "leafOnly" }],
        readonly: ["module.md"],
        noNewExports: [],
        prose: "",
      },
    ]);

    const before = "";
    const after = "export function leafOnly() {}";
    const result = checkExports(
      "src/payments/app.ts",
      before,
      after,
      index,
      cwd,
      
    );

    expect(result.blocked).toBe(false);
  });

  it("blocks export not in immediate parent's visible, even if grandparent has it", () => {
    const index = makeIndex([
      {
        modulePath: "/project",
        descriptorFileName: "module.md",
        visible: [{ name: "rootOnly" }],
        readonly: ["module.md"],
        noNewExports: [],
        prose: "",
      },
      {
        modulePath: "/project/src",
        descriptorFileName: "module.md",
        visible: [{ name: "sharedFn" }, { name: "rootOnly" }],
        readonly: ["module.md"],
        noNewExports: [],
        prose: "",
      },
    ]);

    const before = "";
    const after = "export function sharedFn() {}";
    const result = checkExports(
      "src/app.ts",
      before,
      after,
      index,
      cwd,
      
    );

    expect(result.blocked).toBe(false);
  });
});
