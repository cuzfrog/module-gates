import * as fs from "node:fs";
import * as path from "node:path";
import type { ModuleContract, ModuleIndex } from "./types.ts";

export function findOwningModule(
  absPath: string,
  index: ModuleIndex,
): string | undefined {
  let current = path.dirname(absPath);
  const root = path.parse(current).root;

  while (true) {
    const owner = index.dirToModule.get(current);
    if (owner !== undefined) return owner;
    if (current === root) break;
    current = path.dirname(current);
  }

  return undefined;
}

export function readFileSafe(absPath: string): string {
  try {
    return fs.readFileSync(absPath, "utf-8");
  } catch {
    return "";
  }
}

export function applyEdits(content: string, edits: { oldText: string; newText: string }[]): string {
  let result = content;
  for (const edit of edits) {
    result = result.replace(edit.oldText, edit.newText);
  }
  return result;
}

export function isWithinSourceRoot(absPath: string, resolvedRoots: string[]): boolean {
  for (const resolvedRoot of resolvedRoots) {
    if (absPath.startsWith(resolvedRoot + path.sep) || absPath === resolvedRoot) {
      return true;
    }
  }
  return false;
}

export function getAncestorContracts(
  absFile: string,
  index: ModuleIndex,
): ModuleContract[] {
  return index.contracts.filter(
    (c) => absFile.startsWith(c.modulePath + path.sep) || absFile === c.modulePath,
  );
}

export function matchesPattern(
  absFile: string,
  pattern: string,
  modulePath: string,
): boolean {
  const resolved = path.resolve(modulePath, pattern);

  if (pattern.endsWith("*")) {
    const prefix = path.resolve(modulePath, pattern.slice(0, -1));
    return absFile.startsWith(prefix);
  }

  if (absFile === resolved) return true;

  if (absFile.startsWith(resolved + path.sep)) return true;

  return false;
}
