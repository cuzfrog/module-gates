import { registerChecker } from "./registry.ts";
import type { ExportChecker } from "./registry.ts";
import type { Signature } from "../../types.ts";

const tsChecker: ExportChecker = {
  extensions: [".ts", ".tsx", ".js", ".jsx"],
  getNewExports(before: string, after: string): Signature[] {
    const beforeNames = new Set(extractExports(before).map((s) => s.name));
    return extractExports(after).filter((sig) => !beforeNames.has(sig.name));
  },
};

registerChecker(tsChecker);

const ANNOTATION_PREFIX = String.raw`(?:@[^\n]*\n)*[ \t]*`;
const DECL_KEYWORD = String.raw`(?:function(?:\s*\*)?|class|const|let|var|type|interface|enum)`;
const DECL_KEYWORD_NEG = String.raw`(?:function\s*\*?|class|const|let|var|type|interface|enum|abstract|async|declare)`;

function extractExports(src: string): Signature[] {
  const results: Signature[] = [];

  for (const m of src.matchAll(
    new RegExp(`^${ANNOTATION_PREFIX}export\\s+(?:default\\s+)?(?:\\w+\\s+)*${DECL_KEYWORD}\\s+(\\w+)`, "gm"),
  )) {
    results.push({ name: m[1] });
  }

  for (const m of src.matchAll(
    new RegExp(`^${ANNOTATION_PREFIX}export\\s*(?:type\\s+)?\\{\\s*([^}]+?)\\s*\\}(?:\\s+from\\b)?`, "gm"),
  )) {
    const inner = m[1];
    for (const entry of inner.split(",")) {
      let trimmed = entry.trim();
      if (!trimmed) continue;
      if (trimmed.startsWith("type ")) {
        trimmed = trimmed.slice(5).trim();
        if (!trimmed) continue;
      }
      const asMatch = trimmed.match(/^(\w+)\s+as\s+(\w+)$/);
      results.push({ name: asMatch ? asMatch[2] : trimmed });
    }
  }

  for (const m of src.matchAll(
    new RegExp(`^${ANNOTATION_PREFIX}export\\s+(?:type\\s+)?\\*\\s+from`, "gm"),
  )) {
    results.push({ name: "*" });
  }

  for (const m of src.matchAll(
    new RegExp(`^${ANNOTATION_PREFIX}export\\s*\\*\\s+as\\s+(\\w+)\\s+from`, "gm"),
  )) {
    results.push({ name: m[1] });
  }

  for (const m of src.matchAll(
    new RegExp(`^${ANNOTATION_PREFIX}export\\s*=\\s*(\\w+)`, "gm"),
  )) {
    results.push({ name: m[1] });
  }

  for (const m of src.matchAll(
    new RegExp(`^${ANNOTATION_PREFIX}export\\s+default\\s+(?!${DECL_KEYWORD_NEG})([a-zA-Z_]\\w*)`, "gm"),
  )) {
    results.push({ name: m[1] });
  }

  return results;
}
