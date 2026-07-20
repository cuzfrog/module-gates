import type { ConfigSource } from "../../core/index.ts";

export const CLAUDE_CONFIG_SOURCES: ConfigSource[] = [
  { filePath: ".module-gates/config.json" },
  { filePath: ".claude/settings.json", key: "module-gates" },
  { filePath: ".pi/settings.json", key: "module-gates" },
];
