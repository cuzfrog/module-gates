import { registerChecker } from "./registry.ts";
import type { ExportChecker } from "./registry.ts";
import type { Signature } from "../../types.ts";

const kotlinChecker: ExportChecker = {
  extensions: [".kt", ".kts"],
  getNewExports(before: string, after: string): Signature[] {
    const beforeNames = new Set(extractExports(before).map((s) => s.name));
    return extractExports(after).filter((sig) => !beforeNames.has(sig.name));
  },
};

registerChecker(kotlinChecker);

function extractExports(src: string): Signature[] {
  const declRe = /^(?:@\w+(?:\([^)]*\))?\s+)*(?:(public|internal|private)\s+)?(?:(?:data|sealed|enum|abstract|open|final|inline|value|annotation|expect|actual|external)\s+)*(?:companion\s+)?(?:class|interface|object|fun|val|var|typealias)\s+(\w+)/m;
  const results: Signature[] = [];
  let depth = 0;
  for (const rawLine of src.split("\n")) {
    const line = rawLine.replace(/\/\/.*$/, "").replace(/\/\*.*?\*\//g, "");
    if (depth === 0) {
      const m = declRe.exec(line);
      if (m) {
        const visibility = m[1];
        const name = m[2];
        if (visibility === "private") {
          // skip
        } else {
          results.push({ modifier: visibility, name });
        }
      }
    }
    depth += (line.match(/\{/g) || []).length;
    depth -= (line.match(/\}/g) || []).length;
    if (depth < 0) depth = 0;
  }
  return results;
}
