import type { Diagnostic, ModuleIndex } from "./types.ts";
import { loadConfig, type ConfigSource, type ModuleGateConfig } from "./config.ts";
import { buildModuleIndex } from "./graph/index.ts";
import { runGates, type GateDenial, type GateEdit } from "./gates/run-gates.ts";
import { buildSystemPromptHint } from "./context/index.ts";

export type GateEngine = {
  readonly cwd: string;
  readonly config: ModuleGateConfig;
  readonly index: ModuleIndex;
  readonly diagnostics: readonly Diagnostic[];
  checkEdit(
    filePath: string,
    edits: GateEdit[],
    opts?: CheckEditOptions,
  ): GateDenial | undefined;
  systemPromptHint(baseSystemPrompt: string): string;
};

export type CheckEditOptions = {
  beforeOverride?: string;
};

export type CreateGateEngineOptions = {
  configSources?: ConfigSource[];
};

export async function createGateEngine(
  cwd: string,
  opts?: CreateGateEngineOptions,
): Promise<GateEngine> {
  const config = loadConfig(cwd, opts?.configSources);
  const { index, diagnostics } = await buildModuleIndex(cwd, config);

  return {
    cwd,
    config,
    index,
    diagnostics,
    checkEdit: (filePath, edits, editOpts) =>
      runGates(filePath, edits, cwd, index, config, editOpts?.beforeOverride),
    systemPromptHint: (baseSystemPrompt) =>
      buildSystemPromptHint(index, baseSystemPrompt, config),
  };
}
