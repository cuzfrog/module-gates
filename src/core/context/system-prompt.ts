import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import type { ModuleIndex } from "../types.ts";
import type { ModuleGateConfig } from "../config.ts";

export function buildSystemPromptHint(
  index: ModuleIndex,
  systemPrompt: string,
  config: ModuleGateConfig,
): string {
  if (config.disableSystemPrompt) return systemPrompt;
  if (index.contracts.length === 0) return systemPrompt;

  const descriptorFileName = config.moduleDescriptorFileName;

  const descriptorReadonly =
    config.moduleDescriptorReadonly === "frontmatter"
      ? `The frontmatter of \`${descriptorFileName}\` is readonly.`
      : config.moduleDescriptorReadonly === "file"
        ? `The \`${descriptorFileName}\` file itself is readonly.`
        : "";

  const moduleInterfaceImportGate = config.disableModuleInterfaceImportGate
    ? ""
    : "External files can only import through the module interface (e.g. `index.ts` in TypeScript, `mod.rs` in Rust).";

  const section = applyTemplate(TEMPLATE, {
    descriptorFileName,
    descriptorReadonly,
    moduleInterfaceImportGate,
  });

  return systemPrompt + "\n\n" + section;
}

const TEMPLATE = fs.readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), "system-prompt.template.md"),
  "utf-8",
);

function applyTemplate(template: string, vars: Record<string, string>): string {
  const ifBlock = /\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g;
  const variable = /\{\{(\w+)\}\}/g;
  return template
    .replace(ifBlock, (_match, name: string, body: string) => (vars[name] ? body : ""))
    .replace(variable, (_match, name: string) => vars[name] ?? "");
}