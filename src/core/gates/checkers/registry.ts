import * as path from "node:path";
import type { Signature } from "../../types.ts";

export interface ExportChecker {
  extensions: string[];
  getNewExports(before: string, after: string): Signature[];
}

const checkerRegistry = new Map<string, ExportChecker>();

export function registerChecker(checker: ExportChecker): void {
  for (const ext of checker.extensions) {
    checkerRegistry.set(ext, checker);
  }
}

export function getChecker(filePath: string): ExportChecker | undefined {
  return checkerRegistry.get(path.extname(filePath));
}
