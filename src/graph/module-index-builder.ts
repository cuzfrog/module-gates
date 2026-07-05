import * as fs from "node:fs";
import * as path from "node:path";
import { readdir } from "node:fs/promises";
import { parseFrontmatter } from "../utils/frontmatter.ts";
import type { ModuleContract, ModuleIndex } from "../types.ts";
import type { ModuleGateConfig } from "../config.ts";
import type { Dirent } from "node:fs";
import { validateVisibleEntries } from "./validation.ts";
import { parseVisibleEntry, type ModuleFrontmatter } from "./frontmatter-parser.ts";

type IndexContext = {
  cwd: string;
  ui: { notify(message: string, type?: string): void };
};

export async function buildModuleIndex(
  ctx: IndexContext,
  config: ModuleGateConfig,
): Promise<ModuleIndex> {
  const notify = (msg: string) => ctx.ui.notify(msg, "info");
  const scanRoots = resolveScanRoots(ctx.cwd, config.sourceRoots);

  const moduleFilesList = await Promise.all(
    scanRoots.map((root) => findModuleFiles(root, config.moduleDescriptorFileName)),
  );
  const moduleFiles = moduleFilesList.flat();
  const contracts = buildContracts(moduleFiles, notify);
  applyComplementPass(contracts);
  const dirToModule = await buildDirToModuleMap(contracts);
  const index: ModuleIndex = { contracts, dirToModule };

  await validateVisibleEntries(index, ctx.cwd, ctx.ui.notify, config.moduleDescriptorFileName);

  return index;
}

function resolveScanRoots(cwd: string, sourceRoots: string[]): string[] {
  if (sourceRoots.length === 0) return [path.resolve(cwd)];
  return sourceRoots.map((r) => path.resolve(cwd, r));
}

function buildContracts(
  moduleFiles: string[],
  onInfo: (message: string) => void,
): ModuleContract[] {
  const contracts: ModuleContract[] = [];

  for (const absModuleFile of moduleFiles) {
    const modulePath = path.dirname(absModuleFile);
    const content = fs.readFileSync(absModuleFile, "utf-8");

    let frontmatter: ModuleFrontmatter;
    let body: string;
    try {
      const parsed = parseFrontmatter<ModuleFrontmatter>(content);
      frontmatter = parsed.frontmatter;
      body = parsed.body;
    } catch {
      onInfo(
        `[Module Gate] Failed to parse ${absModuleFile} — module will be unguarded`,
      );
      continue;
    }

    contracts.push({
      modulePath,
      descriptorFileName: path.basename(absModuleFile),
      visible:
        frontmatter.visible !== undefined
          ? frontmatter.visible.map(parseVisibleEntry)
          : null,
      readonly: frontmatter.readonly ?? [],
      sealed: frontmatter.sealed ?? [],
      prose: body.trim(),
    });
  }

  contracts.sort((a, b) => a.modulePath.length - b.modulePath.length);
  return contracts;
}

async function buildDirToModuleMap(
  contracts: ModuleContract[],
): Promise<Map<string, string>> {
  const dirToModule = new Map<string, string>();
  const sortedByDepth = [...contracts].sort(
    (a, b) => a.modulePath.length - b.modulePath.length,
  );

  for (const contract of sortedByDepth) {
    const dirs = await walkDirs(contract.modulePath);
    for (const dir of dirs) {
      dirToModule.set(dir, contract.modulePath);
    }
  }

  return dirToModule;
}

async function findModuleFiles(dir: string, descriptorFileName: string): Promise<string[]> {
  const results: string[] = [];
  const stack: string[] = [dir];

  while (stack.length > 0) {
    const current = stack.pop()!;
    let entries: Dirent[];
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (entry.name === "node_modules" || entry.name === ".git") continue;
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
      } else if (entry.name.toLowerCase() === descriptorFileName.toLowerCase()) {
        results.push(fullPath);
      }
    }
  }

  return results;
}

function applyComplementPass(contracts: ModuleContract[]): void {
  for (const contract of contracts) {
    if (contract.visible === null) continue;
    for (const sig of contract.visible) {
      if (!sig.path) continue;
      const targetDir = resolveDir(contract.modulePath, sig.path);
      if (targetDir === contract.modulePath) continue;
      const target = contracts.find((c) => c.modulePath === targetDir);
      if (!target || target.visible === null) continue;
      if (target.visible.some((s) => s.name === sig.name)) continue;
      target.visible.push({ name: sig.name, modifier: sig.modifier });
    }
  }
}

function resolveDir(modulePath: string, entryPath: string): string {
  const dirPart = pathDirPart(entryPath);
  if (!dirPart) return modulePath;
  const joined = path.join(modulePath, dirPart);
  return joined.endsWith(path.sep) ? joined.slice(0, -1) : joined;
}

function pathDirPart(entryPath: string): string {
  const trimmed = entryPath.trim();
  const lastSlash = trimmed.lastIndexOf("/");
  if (lastSlash < 0) return "";
  return trimmed.slice(0, lastSlash + 1);
}

async function walkDirs(root: string): Promise<string[]> {
  const results: string[] = [root];
  const stack: string[] = [root];

  while (stack.length > 0) {
    const current = stack.pop()!;
    let entries: Dirent[];
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (entry.name === "node_modules" || entry.name === ".git") continue;
      if (entry.isDirectory()) {
        const fullPath = path.join(current, entry.name);
        results.push(fullPath);
        stack.push(fullPath);
      }
    }
  }

  return results;
}


