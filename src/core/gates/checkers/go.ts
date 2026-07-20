import { registerChecker } from "./registry.ts";
import type { ExportChecker } from "./registry.ts";
import type { Signature } from "../../types.ts";

const goChecker: ExportChecker = {
  extensions: [".go"],
  getNewExports(before: string, after: string): Signature[] {
    const beforeNames = new Set(extractExports(before).map((s) => s.name));
    return extractExports(after).filter((sig) => !beforeNames.has(sig.name));
  },
};

registerChecker(goChecker);

function extractExports(src: string): Signature[] {
  const out: Signature[] = [];

  for (const m of src.matchAll(
    /^(?:func\s+(?:\([^)]*\)\s+)?|type\s+|var\s+|const\s+)([\p{Lu}]\w*)/gmu,
  )) {
    out.push({ name: m[1] });
  }

  for (const block of src.matchAll(/(?:^|\n)(?:var|const)\s*\(([\s\S]*?)\)/g)) {
    const inner = block[1];
    for (const line of inner.split(/\n/)) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const m = /^([\p{Lu}]\w*)(?:\s*(?::\s*[\w.\[\]any, |]+)?=\s*[\s\S]*|\s*$)/u.exec(trimmed);
      if (m) out.push({ name: m[1] });
    }
  }

  for (const iface of src.matchAll(/(?:^|\n)type\s+[\p{Lu}]\w*\s+interface\s*\{([\s\S]*?)\}/gu)) {
    const inner = iface[1];
    for (const line of inner.split(/\n/)) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const m = /^([\p{Lu}]\w*)\s*\(/u.exec(trimmed);
      if (m) out.push({ name: m[1] });
    }
  }

  return out;
}
