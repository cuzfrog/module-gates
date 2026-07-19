#!/usr/bin/env node
/**
 * Populate no-new-exports entries in module descriptors.
 *
 * Scans module descriptor files under a source root and populates each
 * descriptor's `no-new-exports` field with every direct code file in the module
 * directory. Files in nested sub-modules (directories with their own
 * descriptor) are excluded from the parent.
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { resolve, relative, join, dirname, extname } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

const SUPPORTED_EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".jsx",
  ".rs",
  ".java",
  ".go",
  ".kt", ".kts",
  ".scala", ".sc",
]);

export { SUPPORTED_EXTENSIONS };

function main() {
  const { values } = parseArgs({
    options: {
      root: { type: "string", default: "src" },
      "dry-run": { type: "boolean", default: false },
      create: { type: "boolean", default: false },
      "descriptor-name": { type: "string", default: "MODULE.md" },
    },
  });

  const cwd = process.cwd();
  const root = resolve(cwd, values.root);

  if (!existsSync(root)) {
    console.error(`Root directory not found: ${root}`);
    process.exit(1);
  }

  const descriptorName = values["descriptor-name"];

  const allModuleDirs = findModuleDirs(root, descriptorName);
  const results = [];

  for (const [modDir, modFile] of allModuleDirs) {
    const result = updateNoNewExports(modDir, modFile, descriptorName, allModuleDirs);
    if (result) results.push(result);
  }

  if (values.create) {
    const allDirs = findAllDirsWithFiles(root);
    const dirsWithoutModule = allDirs.filter((d) => !allModuleDirs.has(d));
    for (const dir of dirsWithoutModule) {
      const result = createModuleDescriptor(dir, descriptorName);
      if (result) results.push(result);
    }
  }

  if (results.length === 0) {
    console.log("All module descriptors are up to date.");
    return;
  }

  if (values["dry-run"]) {
    console.log("Dry run — would modify:");
    for (const r of results) {
      const rel = relative(cwd, r.path);
      console.log(`  ${rel}: no-new-exports [${r.files.join(", ") || "(none)"}]`);
    }
    return;
  }

  for (const r of results) {
    writeFileSync(r.path, r.content, "utf-8");
    console.log(`Updated: ${relative(cwd, r.path)}`);
  }
  console.log(`Done. ${results.length} module descriptor(s) processed.`);
}

// ---------------------------------------------------------------------------
// File system scanning
// ---------------------------------------------------------------------------

function findModuleDirs(root, descriptorName) {
  const map = new Map();
  const lowerName = descriptorName.toLowerCase();
  walkDir(root, (fullPath, entry) => {
    if (entry.isFile() && entry.name.toLowerCase() === lowerName) {
      map.set(dirname(fullPath), entry.name);
      return "prune";
    }
    return "continue";
  });
  return map;
}

function findAllDirsWithFiles(root) {
  const dirHasFiles = new Map();

  function collectFileDirs(dir) {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name === "node_modules" || entry.name === ".git") continue;
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        collectFileDirs(fullPath);
      } else {
        dirHasFiles.set(dir, true);
      }
    }
  }
  collectFileDirs(root);

  const dirs = [];
  function collectAllDirs(dir) {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name === "node_modules" || entry.name === ".git") continue;
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        collectAllDirs(fullPath);
      }
    }
    if (dirHasFiles.has(dir)) {
      dirs.push(dir);
    }
  }
  collectAllDirs(root);
  return dirs;
}

function walkDir(dir, visitor) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name === ".git") continue;
    const fullPath = join(dir, entry.name);
    const action = visitor(fullPath, {
      name: entry.name,
      isFile: () => entry.isFile(),
      isDirectory: () => entry.isDirectory(),
    });
    if (action === "prune") continue;
    if (entry.isDirectory()) {
      walkDir(fullPath, visitor);
    }
  }
}

// ---------------------------------------------------------------------------
// Module processing
// ---------------------------------------------------------------------------

function updateNoNewExports(modDir, descriptorFileName, descriptorName, allModuleDirs) {
  const modPath = join(modDir, descriptorFileName);
  let raw;
  try {
    raw = readFileSync(modPath, "utf-8");
  } catch {
    return undefined;
  }

  const parsed = parseFrontmatter(raw);
  const existingNoNewExports = normalizeNoNewExports(parsed.frontmatter["no-new-exports"]);
  const directFiles = listDirectFiles(modDir, descriptorName, allModuleDirs);
  const mergedNoNewExports = mergePreservingOrder(existingNoNewExports, directFiles);

  if (arraysEqual(existingNoNewExports, mergedNoNewExports)) return undefined;

  const newContent = serializeModule(parsed, mergedNoNewExports);

  return { path: modPath, content: newContent, files: mergedNoNewExports };
}

function createModuleDescriptor(dir, descriptorName) {
  const directFiles = listDirectFiles(dir, descriptorName, new Map());
  if (directFiles.length === 0) return undefined;

  const content = serializeModule(
    { prelude: "---\n", frontmatter: {}, body: "\n" },
    directFiles,
  );

  const modPath = join(dir, descriptorName);

  return { path: modPath, content, files: directFiles };
}

// ---------------------------------------------------------------------------
// Frontmatter parsing & serialization
// ---------------------------------------------------------------------------

function parseFrontmatter(raw) {
  const trimmed = raw.trimStart();
  if (!trimmed.startsWith("---")) {
    return { prelude: "", frontmatter: {}, body: raw };
  }

  const endIdx = trimmed.indexOf("\n---", 3);
  const actualEnd = endIdx === -1 ? trimmed.indexOf("---", 3) : endIdx;

  if (actualEnd === -1) {
    return { prelude: "", frontmatter: {}, body: raw };
  }

  const prelude = "---\n";
  const fmBlock = trimmed.slice(3, actualEnd).trim();
  const body = trimmed.slice(actualEnd + (trimmed[actualEnd] === "\n" ? 4 : 3));

  const frontmatter = parseYamlBlock(fmBlock);

  return { prelude, frontmatter, body };
}

function parseYamlBlock(block) {
  const result = {};
  if (block.length === 0) return result;

  const lines = block.split("\n");
  let currentKey = null;
  let currentList = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length === 0) continue;

    const listMatch = trimmed.match(/^\s*-\s+(.+)$/);
    if (listMatch && currentKey) {
      currentList.push(listMatch[1].trim());
      continue;
    }

    if (currentKey) {
      result[currentKey] = currentList;
      currentKey = null;
      currentList = [];
    }

    const kvMatch = trimmed.match(/^(\w[\w-]*)\s*:\s*(.*)$/);
    if (kvMatch) {
      const key = kvMatch[1];
      const value = kvMatch[2].trim();

      if (value === "" || value === "[]") {
        currentKey = key;
        currentList = [];
      } else if (value.startsWith("[") && value.endsWith("]")) {
        result[key] = parseInlineList(value);
      } else {
        result[key] = value;
      }
    }
  }

  if (currentKey) {
    result[currentKey] = currentList;
  }

  return result;
}

function parseInlineList(raw) {
  const inner = raw.slice(1, -1).trim();
  if (inner.length === 0) return [];
  return inner.split(",").map((s) => s.trim().replace(/^['"]|['"]$/g, ""));
}

function serializeModule(parsed, noNewExports) {
  const fm = { ...parsed.frontmatter, "no-new-exports": noNewExports };

  let yaml = parsed.prelude;
  for (const [key, value] of Object.entries(fm)) {
    if (Array.isArray(value)) {
      yaml += `${key}:\n`;
      for (const item of value) {
        yaml += `  - ${item}\n`;
      }
    } else if (typeof value === "string") {
      yaml += `${key}: ${value}\n`;
    }
  }
  yaml += "---\n";
  yaml += parsed.body;

  if (!parsed.body.endsWith("\n")) {
    yaml += "\n";
  }

  return yaml;
}

// ---------------------------------------------------------------------------
// File listing
// ---------------------------------------------------------------------------

function listDirectFiles(modDir, descriptorName, allModuleDirs) {
  const lowerDesc = descriptorName.toLowerCase();
  const files = [];

  let entries;
  try {
    entries = readdirSync(modDir, { withFileTypes: true });
  } catch {
    return [];
  }

  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name === ".git") continue;

    if (entry.isDirectory()) {
      const subDir = join(modDir, entry.name);
      if (allModuleDirs.has(subDir)) continue;
      // Skip directory entries entirely — sub-modules handle their own
      // Non-module subdirs are skipped too to avoid granularity issues
    } else {
      if (entry.name.toLowerCase() === lowerDesc) continue;
      if (!SUPPORTED_EXTENSIONS.has(extname(entry.name).toLowerCase())) continue;
      files.push(entry.name);
    }
  }

  return files;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizeNoNewExports(value) {
  if (Array.isArray(value)) return value.map(String);
  return [];
}

function mergePreservingOrder(existing, newFiles) {
  const result = [...existing];
  for (const f of newFiles) {
    if (!existing.includes(f)) result.push(f);
  }
  return result;
}

function arraysEqual(a, b) {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((v, i) => v === sortedB[i]);
}

if (import.meta.url === pathToFileURL(resolve(process.argv[1] ?? "")).href) {
  main();
}