import { describe, it, expect } from "vitest";
import { parseJsonc } from "./jsonc.ts";

describe("parseJsonc", () => {
  it("parses plain JSON", () => {
    expect(parseJsonc('{"a": 1}')).toEqual({ a: 1 });
  });

  it("strips line comments", () => {
    const raw = `{
      // this is a comment
      "a": 1
    }`;
    expect(parseJsonc(raw)).toEqual({ a: 1 });
  });

  it("strips block comments", () => {
    const raw = `{
      /* block
         comment */
      "a": 1
    }`;
    expect(parseJsonc(raw)).toEqual({ a: 1 });
  });

  it("does not strip comments inside strings", () => {
    const raw = `{
      "a": "// not a comment",
      "b": "/* also not */"
    }`;
    expect(parseJsonc(raw)).toEqual({
      a: "// not a comment",
      b: "/* also not */",
    });
  });

  it("preserves escaped quotes", () => {
    const raw = '{ "a": "say \\"hi\\"" }';
    expect(parseJsonc(raw)).toEqual({ a: 'say "hi"' });
  });
});
