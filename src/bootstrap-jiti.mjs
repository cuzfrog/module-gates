import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const PKG_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export async function loadTsModule(absScriptPath) {
  const jiti = await loadJiti();
  return jiti.import(pathToFileURL(absScriptPath).href);
}

async function loadJiti() {
  const fromPkg = await jitiFrom(PKG_ROOT);
  if (fromPkg) return fromPkg;

  const dataDir = process.env.CLAUDE_PLUGIN_DATA;
  if (dataDir) {
    ensurePluginDeps(dataDir);
    const fromData = await jitiFrom(dataDir);
    if (fromData) return fromData;
  }

  throw new Error("could not load jiti from the package or CLAUDE_PLUGIN_DATA");
}

async function jitiFrom(baseDir) {
  const require_ = createRequire(join(baseDir, "noop.js"));
  let jitiEntry;
  try {
    jitiEntry = require_.resolve("jiti");
  } catch {
    return undefined;
  }
  let yamlEntry;
  try {
    yamlEntry = require_.resolve("yaml");
  } catch {
    yamlEntry = undefined;
  }
  const mod = await import(pathToFileURL(jitiEntry).href);
  const createJiti = mod.createJiti ?? mod.default;
  return createJiti(import.meta.url, yamlEntry ? { alias: { yaml: yamlEntry } } : {});
}

function ensurePluginDeps(dataDir) {
  if (existsSync(join(dataDir, "node_modules", "jiti"))) return;
  mkdirSync(dataDir, { recursive: true });
  copyFileSync(join(PKG_ROOT, "package.json"), join(dataDir, "package.json"));
  const npm = process.platform === "win32" ? "npm.cmd" : "npm";
  const result = spawnSync(
    npm,
    ["install", "--omit=dev", "--omit=peer", "--omit=optional", "--no-audit", "--no-fund"],
    { cwd: dataDir, stdio: ["ignore", "ignore", "inherit"], timeout: 180_000 },
  );
  if (result.status !== 0) {
    throw new Error("npm install of plugin dependencies failed");
  }
}
