import { describe, it, expect } from "vitest";
import { extractPatchOperations } from "./apply-patch.ts";

const readFile = (path: string): string => {
  if (path.endsWith("/src/app.ts")) {
    return "console.log(\"hello\");\nexport { foo };";
  }
  if (path.endsWith("/src/utils.ts")) {
    return "export const util = 1;";
  }
  return "";
};

describe("extractPatchOperations", () => {
  it("adds a new file from + lines", () => {
    const patch = "*** Add File: /project/src/new.ts\n+export const x = 1;";
    const ops = extractPatchOperations(patch, readFile, "/project");
    expect(ops).toHaveLength(1);
    expect(ops[0].filePath).toBe("/project/src/new.ts");
    expect(ops[0].before).toBe("");
    expect(ops[0].after).toBe("export const x = 1;");
  });

  it("deletes a file", () => {
    const patch = "*** Delete File: /project/src/app.ts";
    const ops = extractPatchOperations(patch, readFile, "/project");
    expect(ops).toHaveLength(1);
    expect(ops[0].filePath).toBe("/project/src/app.ts");
    expect(ops[0].before).toBe("console.log(\"hello\");\nexport { foo };");
    expect(ops[0].after).toBe("");
  });

  it("updates a file with full-file representation", () => {
    const patch = [
      "*** Update File: /project/src/app.ts",
      " console.log(\"hello\");",
      "+export { bar };",
      "-export { foo };",
    ].join("\n");
    const ops = extractPatchOperations(patch, readFile, "/project");
    expect(ops).toHaveLength(1);
    expect(ops[0].after).toBe("console.log(\"hello\");\nexport { bar };");
  });

  it("moves a file", () => {
    const patch = [
      "*** Update File: /project/src/app.ts",
      "*** Move to: /project/src/moved.ts",
      "+moved content",
    ].join("\n");
    const ops = extractPatchOperations(patch, readFile, "/project");
    expect(ops).toHaveLength(2);
    expect(ops[0]).toEqual({
      filePath: "/project/src/app.ts",
      before: "console.log(\"hello\");\nexport { foo };",
      after: "",
    });
    expect(ops[1].filePath).toBe("/project/src/moved.ts");
    expect(ops[1].after).toBe("moved content");
  });

  it("applies a hunked diff with @@ headers", () => {
    const before = "line1\nline2\nline3";
    const read = (path: string): string => (path.endsWith("/file.ts") ? before : "");
    const patch = [
      "*** Update File: /project/file.ts",
      "@@ -2,1 +2,2 @@",
      " line2",
      "+line2.5",
      " line3",
      "*** End of File",
    ].join("\n");
    const ops = extractPatchOperations(patch, read, "/project");
    expect(ops).toHaveLength(1);
    expect(ops[0].after).toBe("line1\nline2\nline2.5\nline3");
  });

  it("resolves relative paths against cwd", () => {
    const patch = "*** Add File: src/relative.ts\n+export const x = 1;";
    const ops = extractPatchOperations(patch, readFile, "/project");
    expect(ops[0].filePath).toBe("/project/src/relative.ts");
  });

  it("strips Begin/End Patch wrapper", () => {
    const patch = [
      "*** Begin Patch",
      "*** Add File: /project/src/new.ts",
      "+export const x = 1;",
      "*** End Patch",
    ].join("\n");
    const ops = extractPatchOperations(patch, readFile, "/project");
    expect(ops).toHaveLength(1);
    expect(ops[0].after).toBe("export const x = 1;");
  });
});
