import * as path from "node:path";
import type { ModuleIndex } from "../types.ts";
import { getAncestorContracts, matchesPattern } from "../utils.ts";

export type ReadonlyCheckResult =
  | { blocked: true; reason: string }
  | { blocked: false };

export function checkReadonly(
  filePath: string,
  index: ModuleIndex,
  cwd: string,
): ReadonlyCheckResult {
  const absFile = path.resolve(cwd, filePath);
  const ancestors = getAncestorContracts(absFile, index);

  for (const contract of ancestors) {
    for (const pattern of contract.readonly) {
      if (matchesPattern(absFile, pattern, contract.modulePath)) {
        const relModuleMd = path.relative(cwd, path.join(contract.modulePath, contract.descriptorFileName));
        return {
          blocked: true,
          reason: `Readonly rule: file is listed as readonly in ${relModuleMd}`,
        };
      }
    }
  }

  return { blocked: false };
}
