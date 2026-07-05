import * as fs from "node:fs";
import * as path from "node:path";

export type ModuleGateConfig = {
  moduleDescriptorFileName: string;
  moduleDescriptorReadonly: "file" | "frontmatter" | "off";
  sourceRoots: string[];
  disableModuleInterfaceImportGate: boolean;
  disableSystemPrompt: boolean;
  outputModuleProseOnBlock: boolean;
};

const DEFAULTS: ModuleGateConfig = {
  moduleDescriptorFileName: "module.md",
  moduleDescriptorReadonly: "frontmatter",
  sourceRoots: ["src/"],
  disableModuleInterfaceImportGate: false,
  disableSystemPrompt: false,
  outputModuleProseOnBlock: false,
};

export function loadConfig(cwd: string): ModuleGateConfig {
  const settingsPath = path.join(cwd, ".pi", "settings.json");
  let userConfig: Partial<Omit<ModuleGateConfig, "moduleDescriptorReadonly" | "sourceRoots"> & {
    moduleDescriptorReadonly?: ModuleGateConfig["moduleDescriptorReadonly"] | boolean;
    sourceRoots?: string | string[];
  }> = {};
  try {
    const raw = fs.readFileSync(settingsPath, "utf-8");
    const settings = JSON.parse(raw);
    if (settings && typeof settings === "object") {
      const gates = (settings as Record<string, unknown>)["module-gates"];
      if (gates && typeof gates === "object" && !Array.isArray(gates)) {
        userConfig = gates as Partial<ModuleGateConfig>;
      }
    }
  } catch {
    // file doesn't exist or invalid — use defaults
  }
  const merged = { ...DEFAULTS, ...userConfig };
  merged.moduleDescriptorReadonly = normalizeReadonly(merged.moduleDescriptorReadonly);
  const raw = (userConfig as { sourceRoots?: string | string[]; sourceRoot?: string | string[] });
  merged.sourceRoots = normalizeSourceRoots(
    raw.sourceRoots ?? raw.sourceRoot,
    DEFAULTS.sourceRoots,
  );
  return merged as ModuleGateConfig;
}

function normalizeReadonly(value: ModuleGateConfig["moduleDescriptorReadonly"] | boolean): ModuleGateConfig["moduleDescriptorReadonly"] {
  if (value === true || value === "file") return "file";
  if (value === false || value === "off") return "off";
  return value;
}

function normalizeSourceRoots(
  value: string | string[] | undefined,
  fallback: string[],
): string[] {
  if (value === undefined) return [...fallback];
  const list = Array.isArray(value) ? value : [value];
  return list.filter((s) => typeof s === "string" && s.length > 0);
}
