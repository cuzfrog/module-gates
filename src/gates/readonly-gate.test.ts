import { describe, it, expect } from "vitest";
import { checkReadonly } from "./readonly-gate.ts";
import type { ModuleIndex, ModuleContract } from "../types.ts";

function makeIndex(contracts: ModuleContract[]): ModuleIndex {
  return { contracts, dirToModule: new Map() };
}

describe("checkReadonly", () => {
  const cwd = "/project";

  it("blocks file matching exact readonly entry", () => {
    const index = makeIndex([
      {
        modulePath: "/project/src",
        descriptorFileName: "module.md",
        visible: null,
        readonly: ["config.json", "module.md"],
        noNewExports: [],
        prose: "",
      },
    ]);

    const result = checkReadonly("src/config.json", index, cwd);
    expect(result.blocked).toBe(true);
  });

  it("blocks file under a readonly directory", () => {
    const index = makeIndex([
      {
        modulePath: "/project/src",
        descriptorFileName: "module.md",
        visible: null,
        readonly: ["vendor", "module.md"],
        noNewExports: [],
        prose: "",
      },
    ]);

    const result = checkReadonly("src/vendor/lib.ts", index, cwd);
    expect(result.blocked).toBe(true);
  });

  it("blocks file matching glob pattern (wildcard suffix)", () => {
    const index = makeIndex([
      {
        modulePath: "/project/src",
        descriptorFileName: "module.md",
        visible: null,
        readonly: ["generated*", "module.md"],
        noNewExports: [],
        prose: "",
      },
    ]);

    const result = checkReadonly("src/generated-types.ts", index, cwd);
    expect(result.blocked).toBe(true);
  });

  it("passes file not matching any pattern", () => {
    const index = makeIndex([
      {
        modulePath: "/project/src",
        descriptorFileName: "module.md",
        visible: null,
        readonly: ["config.json", "module.md"],
        noNewExports: [],
        prose: "",
      },
    ]);

    const result = checkReadonly("src/app.ts", index, cwd);
    expect(result.blocked).toBe(false);
  });

  it("blocks descriptor file when explicitly listed in readonly", () => {
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

    const result = checkReadonly("src/module.md", index, cwd);
    expect(result.blocked).toBe(true);
  });

  it("checks ancestor module readonly patterns", () => {
    const index = makeIndex([
      {
        modulePath: "/project",
        descriptorFileName: "module.md",
        visible: null,
        readonly: ["src/secret.ts", "module.md"],
        noNewExports: [],
        prose: "",
      },
      {
        modulePath: "/project/src",
        descriptorFileName: "module.md",
        visible: null,
        readonly: ["module.md"],
        noNewExports: [],
        prose: "",
      },
    ]);

    const result = checkReadonly("src/secret.ts", index, cwd);
    expect(result.blocked).toBe(true);
  });

  it("provides reason mentioning the contract's actual descriptor file name", () => {
    const index = makeIndex([
      {
        modulePath: "/project/src",
        descriptorFileName: "CONTEXT.md",
        visible: null,
        readonly: ["locked.ts"],
        noNewExports: [],
        prose: "",
      },
    ]);

    const result = checkReadonly("src/locked.ts", index, cwd);
    expect(result.blocked).toBe(true);
    if (result.blocked) {
      expect(result.reason).toContain("CONTEXT.md");
    }
  });

  it("preserves the case of the on-disk descriptor file name in the reason", () => {
    const index = makeIndex([
      {
        modulePath: "/project/src",
        descriptorFileName: "MODULE.md",
        visible: null,
        readonly: ["locked.ts"],
        noNewExports: [],
        prose: "",
      },
    ]);

    const result = checkReadonly("src/locked.ts", index, cwd);
    expect(result.blocked).toBe(true);
    if (result.blocked) {
      expect(result.reason).toContain("MODULE.md");
      expect(result.reason).not.toContain("module.md");
    }
  });
});
