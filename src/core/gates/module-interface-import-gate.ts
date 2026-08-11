import * as fs from "node:fs";
import * as path from "node:path";
import type { ModuleIndex } from "../types.ts";
import { findOwningModule } from "../utils.ts";

export type ImportCheckResult =
  | { blocked: true; reason: string }
  | { blocked: false };

export function checkModuleInterfaceImports(
  filePath: string,
  afterContent: string,
  index: ModuleIndex,
  cwd: string,
  disabled: boolean,
  sourceRoots: string[],
): ImportCheckResult {
  if (disabled) return { blocked: false };

  const absFile = path.resolve(cwd, filePath);
  const fileDir = path.dirname(absFile);
  const srcRoots = sourceRoots.map((r) => path.resolve(cwd, r));
  const violations: string[] = [];

  for (const importPath of extractJsImportPaths(afterContent)) {
    const resolved = resolveRelativeImport(importPath, fileDir);
    if (!resolved) continue;
    if (isInNodeModules(resolved, cwd)) continue;

    const violation = checkViolation(resolved, fileDir, cwd, index);
    if (violation) violations.push(violation);
  }

  for (const modulePath of extractRustUsePaths(afterContent)) {
    const resolved = resolveRustCratePath(modulePath, srcRoots);
    if (!resolved) continue;
    if (isInNodeModules(resolved, cwd)) continue;

    const violation = checkViolation(resolved, fileDir, cwd, index);
    if (violation) violations.push(violation);
  }

  if (violations.length === 0) return { blocked: false };

  return {
    blocked: true,
    reason: `Module interface import violations:\n${violations.map((v) => `  - ${v}`).join("\n")}`,
  };
}

function checkViolation(
  resolved: string,
  fileDir: string,
  cwd: string,
  index: ModuleIndex,
): string | undefined {
  const targetModule = findOwningModule(resolved, index);
  if (!targetModule) return undefined;

  const targetDir = path.dirname(resolved);
  if (targetDir === fileDir) return undefined;

  if (isInterfaceFile(resolved)) return undefined;

  const sourceModule = findOwningModule(path.join(fileDir, "dummy.ts"), index);
  if (sourceModule && isDescendantOrSelf(sourceModule, targetModule)) return undefined;

  const relTarget = path.relative(cwd, resolved);
  const relModule = path.relative(cwd, targetModule);
  return `Import from "${relTarget}" bypasses module interface of ${relModule}/`;
}

function extractJsImportPaths(content: string): string[] {
  const results: string[] = [];

  for (const m of content.matchAll(/^\s*import\s+[\s\S]*?\s+from\s+["']([^"']+)["']/gm)) {
    results.push(m[1]);
  }

  for (const m of content.matchAll(/^\s*export\s+[\s\S]*?\s+from\s+["']([^"']+)["']/gm)) {
    results.push(m[1]);
  }

  for (const m of content.matchAll(/import\s*\(\s*["']([^"']+)["']\s*\)/g)) {
    results.push(m[1]);
  }

  for (const m of content.matchAll(/^\s*(?:const|let|var)\s+[\s\S]*?=\s*require\s*\(\s*["']([^"']+)["']\s*\)/gm)) {
    results.push(m[1]);
  }

  return results;
}

function extractRustUsePaths(content: string): string[] {
  const results: string[] = [];

  for (const m of content.matchAll(/^\s*(?:pub\s+)?use\s+crate::(\w+(?:::\w+)*)::/gm)) {
    const segments = m[1].split("::");
    if (segments.length >= 2) {
      results.push(segments.join("/"));
    }
  }

  return results;
}

const JS_TS_EXTS = [".ts", ".tsx", ".js", ".jsx"];
const FILE_EXTS = [...JS_TS_EXTS, ".rs"];
const DIRECTORY_INDEX_NAMES = ["index.ts", "index.tsx", "index.js", "index.jsx", "mod.rs"];

function resolveRelativeImport(importPath: string, fileDir: string): string | undefined {
  if (!importPath.startsWith(".")) return undefined;

  const resolved = path.resolve(fileDir, importPath);
  const ext = path.extname(resolved);

  if (ext) {
    return resolveWithExtension(resolved, ext);
  }

  const asFile = resolveAsFile(resolved);
  if (asFile) return asFile;

  return resolveAsDirectory(resolved);
}

function resolveWithExtension(filePath: string, ext: string): string | undefined {
  if (!JS_TS_EXTS.includes(ext)) {
    return fs.existsSync(filePath) ? filePath : undefined;
  }

  const base = filePath.slice(0, -ext.length);
  for (const tryExt of [ext, ...JS_TS_EXTS.filter((e) => e !== ext)]) {
    const candidate = base + tryExt;
    if (fs.existsSync(candidate)) return candidate;
  }

  return undefined;
}

function resolveAsFile(basePath: string): string | undefined {
  for (const tryExt of FILE_EXTS) {
    const candidate = basePath + tryExt;
    if (fs.existsSync(candidate)) return candidate;
  }
  return undefined;
}

function resolveAsDirectory(dirPath: string): string | undefined {
  try {
    if (!fs.lstatSync(dirPath).isDirectory()) return undefined;
  } catch {
    return undefined;
  }

  for (const name of DIRECTORY_INDEX_NAMES) {
    const candidate = path.join(dirPath, name);
    if (fs.existsSync(candidate)) return candidate;
  }
  return undefined;
}

function resolveRustCratePath(modulePath: string, srcRoots: string[]): string | undefined {
  const segments = modulePath.split("/");

  for (const srcRoot of srcRoots) {
    const base = path.resolve(srcRoot, ...segments);

    const asFile = base + ".rs";
    if (fs.existsSync(asFile)) return asFile;

    const asMod = path.join(base, "mod.rs");
    if (fs.existsSync(asMod)) return asMod;
  }

  return undefined;
}

function isInNodeModules(resolvedPath: string, _cwd: string): boolean {
  return resolvedPath.split(path.sep).includes("node_modules");
}

function isInterfaceFile(absPath: string): boolean {
  const basename = path.basename(absPath);
  const ext = path.extname(absPath);

  if ([".ts", ".tsx", ".js", ".jsx"].includes(ext)) {
    return ["index.ts", "index.tsx", "index.js", "index.jsx"].includes(basename);
  }

  if (ext === ".rs") {
    return basename === "mod.rs";
  }

  return false;
}

function isDescendantOrSelf(child: string, ancestor: string): boolean {
  if (child === ancestor) return true;
  return child.startsWith(ancestor + path.sep);
}
