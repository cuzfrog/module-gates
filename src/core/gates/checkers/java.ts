import { registerChecker } from "./registry.ts";
import type { ExportChecker } from "./registry.ts";
import type { Signature } from "../../types.ts";

const javaChecker: ExportChecker = {
  extensions: [".java"],
  getNewExports(before: string, after: string): Signature[] {
    const beforeNames = new Set(extractExports(before).map((s) => s.name));
    return extractExports(after).filter((sig) => !beforeNames.has(sig.name));
  },
};

registerChecker(javaChecker);

function extractExports(src: string): Signature[] {
  return [...src.matchAll(
    /^(?:@\w+(?:\([^)]*\))?\s+)*public\s+(?:(?:abstract|final|sealed|non-sealed|static)\s+)*(class|interface|enum|@interface|record)\s+(\w+)/gm,
  )].map((m) => ({ modifier: "public", name: m[2] }));
}
