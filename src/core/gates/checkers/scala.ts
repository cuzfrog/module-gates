import { registerChecker } from "./registry.ts";
import type { ExportChecker } from "./registry.ts";
import type { Signature } from "../../types.ts";

const scalaChecker: ExportChecker = {
  extensions: [".scala", ".sc"],
  getNewExports(before: string, after: string): Signature[] {
    const beforeNames = new Set(extractExports(before).map((s) => s.name));
    return extractExports(after).filter((sig) => !beforeNames.has(sig.name));
  },
};

registerChecker(scalaChecker);

function extractExports(src: string): Signature[] {
  const declRe = /^(?:@\w+(?:\([^)]*\))?\s+)*(?:(private(?:\[[^\]]*\])?|protected(?:\[[^\]]*\])?|public)\s+)?(?:(?:sealed|final|abstract|lazy|opaque|implicit)\s+)*(?:case\s+)?(?:class|object|trait|def|val|var|type|enum|given|extension)\s+(\w+)/m;
  const results: Signature[] = [];
  let depth = 0;
  for (const rawLine of src.split("\n")) {
    const line = rawLine.replace(/\/\/.*$/, "");
    if (depth === 0) {
      const m = declRe.exec(line);
      if (m) {
        const visibility = m[1];
        const name = m[2];
        if (visibility === "private" || visibility === "protected") {
          // skip bare private/protected
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
