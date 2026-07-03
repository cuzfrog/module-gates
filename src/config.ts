import * as fs from "node:fs";
import * as path from "node:path";

export type ModuleGateConfig = {
  moduleDescriptorFileName: string;
  moduleDescriptorReadonly: "file" | "frontmatter" | "off";
  sourceRoot: string;
  disableModuleInterfaceImportGate: boolean;
  disableSystemPrompt: boolean;
  outputModuleProseOnBlock: boolean;
};

const DEFAULTS: ModuleGateConfig = {
  moduleDescriptorFileName: "module.md",
  moduleDescriptorReadonly: "frontmatter",
  sourceRoot: "src/",
  disableModuleInterfaceImportGate: false,
  disableSystemPrompt: false,
  outputModuleProseOnBlock: false,
};

export function loadConfig(cwd: string): ModuleGateConfig {
  const settingsPath = path.join(cwd, ".pi", "settings.json");
  let userConfig: Partial<Omit<ModuleGateConfig, "moduleDescriptorReadonly"> & { moduleDescriptorReadonly?: ModuleGateConfig["moduleDescriptorReadonly"] | boolean }> = {};
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
  return merged as ModuleGateConfig;
}

function normalizeReadonly(value: ModuleGateConfig["moduleDescriptorReadonly"] | boolean): ModuleGateConfig["moduleDescriptorReadonly"] {
  if (value === true || value === "file") return "file";
  if (value === false || value === "off") return "off";
  return value;
}
