import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fs from "node:fs";
import { findOwningModule, readFileSafe, applyEdits, isWithinSourceRoot, getAncestorContracts, matchesPattern } from "./utils.ts";
import type { ModuleContract } from "./types.ts";

vi.mock("node:fs", () => ({
  readFileSync: vi.fn(),
}));

const mockedReadFileSync = vi.mocked(fs.readFileSync);

describe("findOwningModule", () => {
  it("returns module for direct directory match", () => {
    const dirToModule = new Map<string, string>();
    dirToModule.set("/project/src/app", "/project/src");
    const index = { contracts: [], dirToModule };

    expect(findOwningModule("/project/src/app/file.ts", index)).toBe(
      "/project/src",
    );
  });

  it("walks up to find parent module", () => {
    const dirToModule = new Map<string, string>();
    dirToModule.set("/project/src", "/project/src");
    const index = { contracts: [], dirToModule };

    expect(
      findOwningModule("/project/src/sub/deep/file.ts", index),
    ).toBe("/project/src");
  });

  it("returns undefined for unowned files", () => {
    const dirToModule = new Map<string, string>();
    const index = { contracts: [], dirToModule };

    expect(findOwningModule("/project/other/file.ts", index)).toBeUndefined();
  });

  it("resolves file directly in module root", () => {
    const dirToModule = new Map<string, string>();
    dirToModule.set("/project", "/project");
    const index = { contracts: [], dirToModule };

    expect(findOwningModule("/project/config.ts", index)).toBe("/project");
  });

  it("returns deepest owning module", () => {
    const dirToModule = new Map<string, string>();
    dirToModule.set("/project", "/project");
    dirToModule.set("/project/src", "/project/src");
    const index = { contracts: [], dirToModule };

    expect(findOwningModule("/project/src/app.ts", index)).toBe(
      "/project/src",
    );
  });
});

describe("readFileSafe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns file content on success", () => {
    mockedReadFileSync.mockReturnValue("hello world");

    expect(readFileSafe("/some/file.ts")).toBe("hello world");
  });

  it("returns empty string on error", () => {
    mockedReadFileSync.mockImplementation(() => {
      throw new Error("ENOENT");
    });

    expect(readFileSafe("/nonexistent.ts")).toBe("");
  });
});

describe("applyEdits", () => {
  it("applies a single edit", () => {
    const result = applyEdits("hello world", [
      { oldText: "world", newText: "there" },
    ]);
    expect(result).toBe("hello there");
  });

  it("applies multiple edits sequentially", () => {
    const result = applyEdits("a b c", [
      { oldText: "a", newText: "x" },
      { oldText: "c", newText: "z" },
    ]);
    expect(result).toBe("x b z");
  });

  it("returns original content when no edits match", () => {
    const result = applyEdits("hello", [
      { oldText: "xyz", newText: "abc" },
    ]);
    expect(result).toBe("hello");
  });

  it("returns original content for empty edits array", () => {
    expect(applyEdits("hello", [])).toBe("hello");
  });

  it("only replaces first occurrence per edit", () => {
    const result = applyEdits("a a a", [
      { oldText: "a", newText: "b" },
    ]);
    // String.replace without /g only replaces first occurrence
    expect(result).toBe("b a a");
  });
});


describe("isWithinSourceRoot", () => {
  it("returns true for file inside sourceRoot", () => {
    expect(isWithinSourceRoot("/project/src/app/file.ts", ["/project/src"])).toBe(true);
  });

  it("returns true for file exactly at sourceRoot", () => {
    expect(isWithinSourceRoot("/project/src", ["/project/src"])).toBe(true);
  });

  it("returns false for file outside sourceRoot", () => {
    expect(isWithinSourceRoot("/project/lib/app.ts", ["/project/src"])).toBe(false);
  });

  it("returns false for similarly-named sibling directory", () => {
    expect(isWithinSourceRoot("/project/src-other/file.ts", ["/project/src"])).toBe(false);
  });

  it("returns true for file at project root when sourceRoot is empty string", () => {
    expect(isWithinSourceRoot("/project/app.ts", ["/project"])).toBe(true);
  });

  it("returns true for file exactly at filesystem root", () => {
    expect(isWithinSourceRoot("/", ["/"])).toBe(true);
  });

  it("returns false for file in root when resolvedRoot is a child path", () => {
    expect(isWithinSourceRoot("/project", ["/project/src"])).toBe(false);
  });

  it("returns true when file is inside any of multiple roots", () => {
    expect(isWithinSourceRoot("/project/lib/app.ts", ["/project/src", "/project/lib"])).toBe(true);
    expect(isWithinSourceRoot("/project/src/app.ts", ["/project/src", "/project/lib"])).toBe(true);
  });

  it("returns false when file is outside all of multiple roots", () => {
    expect(isWithinSourceRoot("/project/other/app.ts", ["/project/src", "/project/lib"])).toBe(false);
  });

  it("returns false for empty roots array", () => {
    expect(isWithinSourceRoot("/project/src/app.ts", [])).toBe(false);
  });
});

describe("getAncestorContracts", () => {
  function contract(modulePath: string, readonly: string[] = [], sealed: string[] = []): ModuleContract {
    return { modulePath, descriptorFileName: "module.md", visible: null, readonly, sealed, prose: "" };
  }

  it("returns matching contracts for file under module path", () => {
    const index = { contracts: [contract("/project/src")], dirToModule: new Map() };
    expect(getAncestorContracts("/project/src/app.ts", index)).toHaveLength(1);
  });

  it("returns multiple ancestor contracts", () => {
    const index = {
      contracts: [contract("/project"), contract("/project/src"), contract("/project/other")],
      dirToModule: new Map(),
    };
    expect(getAncestorContracts("/project/src/app.ts", index)).toHaveLength(2);
  });

  it("excludes non-ancestor contracts", () => {
    const index = {
      contracts: [contract("/project/other")],
      dirToModule: new Map(),
    };
    expect(getAncestorContracts("/project/src/app.ts", index)).toHaveLength(0);
  });

  it("includes contract for exact module path match", () => {
    const index = { contracts: [contract("/project/src")], dirToModule: new Map() };
    expect(getAncestorContracts("/project/src", index)).toHaveLength(1);
  });

  it("returns the full contract (preserving descriptorFileName)", () => {
    const index = {
      contracts: [contract("/project/src", ["a.ts"], ["b.ts"])],
      dirToModule: new Map(),
    };
    const result = getAncestorContracts("/project/src/app.ts", index);
    expect(result[0]).toEqual({
      modulePath: "/project/src",
      descriptorFileName: "module.md",
      visible: null,
      readonly: ["a.ts"],
      sealed: ["b.ts"],
      prose: "",
    });
  });
});

describe("matchesPattern", () => {
  const modulePath = "/project/src";

  it("matches exact file path", () => {
    expect(matchesPattern("/project/src/app.ts", "app.ts", modulePath)).toBe(true);
  });

  it("does not match different file", () => {
    expect(matchesPattern("/project/src/app.ts", "other.ts", modulePath)).toBe(false);
  });

  it("matches file under a directory pattern", () => {
    expect(matchesPattern("/project/src/vendor/lib.ts", "vendor", modulePath)).toBe(true);
  });

  it("matches the directory itself", () => {
    expect(matchesPattern("/project/src/vendor", "vendor", modulePath)).toBe(true);
  });

  it("matches glob pattern (wildcard suffix)", () => {
    expect(matchesPattern("/project/src/generated-types.ts", "generated*", modulePath)).toBe(true);
  });

  it("glob matches directory prefix", () => {
    expect(matchesPattern("/project/src/generated/sub/file.ts", "generated*", modulePath)).toBe(true);
  });

  it("glob does not match unrelated prefix", () => {
    expect(matchesPattern("/project/src/generic/file.ts", "generated*", modulePath)).toBe(false);
  });

  it("resolves pattern relative to module path", () => {
    expect(matchesPattern("/project/src/sub/app.ts", "sub", modulePath)).toBe(true);
  });
});
