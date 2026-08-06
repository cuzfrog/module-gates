import * as fs from "node:fs";
import * as path from "node:path";
import {
  readHooks,
  removeHooks,
  writeHooks,
  HOOK_MARKER,
} from "../bridges/devin/index.ts";

export type UninstallDevinOptions = {
  projectDir: string;
};

export type UninstallDevinResult =
  | { ok: true; removed: boolean; written: string }
  | { ok: false; reason: string };

export function uninstallDevin(opts: UninstallDevinOptions): UninstallDevinResult {
  const projectDir = path.resolve(opts.projectDir);
  const hooksPath = path.join(projectDir, ".devin", "hooks.v1.json");

  if (!fs.existsSync(hooksPath)) {
    process.stdout.write(`No .devin/hooks.v1.json found at ${hooksPath} — nothing to do.\n`);
    return { ok: true, removed: false, written: hooksPath };
  }

  const before = readHooks(projectDir);
  const beforeHadMarker = JSON.stringify(before).includes(HOOK_MARKER);
  const after = removeHooks(before);
  const afterHasMarker = JSON.stringify(after).includes(HOOK_MARKER);

  if (beforeHadMarker && !afterHasMarker) {
    writeHooks(projectDir, after);
    process.stdout.write(`Removed module-gates hooks from ${hooksPath}.\n`);
    return { ok: true, removed: true, written: hooksPath };
  }

  process.stdout.write(`No module-gates hooks found in ${hooksPath}.\n`);
  return { ok: true, removed: false, written: hooksPath };
}
