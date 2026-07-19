import type { Signature } from "../types.ts";

export type VisibleEntryRaw = string | { path: string; modifier?: string };

export type ModuleFrontmatter = {
  visible?: VisibleEntryRaw[];
  readonly?: string[];
  "no-new-exports"?: string[];
};

export function parseVisibleEntry(raw: VisibleEntryRaw): Signature {
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    return { name: extractNameFromPath(trimmed), path: trimmed };
  }
  return {
    name: extractNameFromPath(raw.path),
    modifier: raw.modifier,
    path: raw.path,
  };
}

function extractNameFromPath(pathStr: string): string {
  let p = pathStr.trim();
  if (p.endsWith("/")) p = p.slice(0, -1);
  const lastSlash = p.lastIndexOf("/");
  return lastSlash >= 0 ? p.slice(lastSlash + 1) : p;
}
