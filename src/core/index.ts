export { createGateEngine } from "./engine.ts";
export type {
  CheckEditOptions,
  CreateGateEngineOptions,
  GateEngine,
} from "./engine.ts";

export { DEFAULT_CONFIG_SOURCES, loadConfig } from "./config.ts";
export type { ConfigSource, ModuleGateConfig } from "./config.ts";

export { buildModuleIndex } from "./graph/index.ts";
export type { ModuleIndexBuildResult } from "./graph/module-index-builder.ts";

export { runGates } from "./gates/index.ts";
export type { GateDenial, GateEdit } from "./gates/run-gates.ts";

export { buildSystemPromptHint } from "./context/index.ts";

export { applyEdits, readFileSafe } from "./utils.ts";

export type {
  Diagnostic,
  ModuleContract,
  ModuleFrontmatter,
  ModuleIndex,
  Signature,
} from "./types.ts";
