import * as path from "node:path";
import type { ModuleIndex } from "../types.ts";
import { getAncestorContracts, matchesPattern } from "../utils.ts";
import { getChecker } from "./checkers/registry.ts";

export type NoNewExportsCheckResult =
  | { blocked: true; reason: string }
  | { blocked: false };

export function checkNoNewExports(
  filePath: string,
  beforeContent: string,
  afterContent: string,
  index: ModuleIndex,
  cwd: string,
): NoNewExportsCheckResult {
  const absFile = path.resolve(cwd, filePath);

  const checker = getChecker(absFile);
  if (!checker) return { blocked: false };

  const ancestors = getAncestorContracts(absFile, index);

  for (const contract of ancestors) {
    for (const pattern of contract.noNewExports) {
      if (matchesPattern(absFile, pattern, contract.modulePath)) {
        const newExports = checker.getNewExports(beforeContent, afterContent);
        if (newExports.length === 0) return { blocked: false };

        const relModuleMd = path.relative(cwd, path.join(contract.modulePath, contract.descriptorFileName));
        const names = newExports.map((s) => s.name).join(", ");
        return {
          blocked: true,
          reason: `No-new-exports rule: file is listed in ${relModuleMd}. Cannot add new exports: ${names}`,
        };
      }
    }
  }

  return { blocked: false };
}