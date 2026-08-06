import type { ConfigSource } from "../../core/index.ts";

export const DEVIN_CONFIG_SOURCES: ConfigSource[] = [
  { filePath: ".module-gates/config.json" },
  { filePath: ".devin/config.json", key: "module-gates" },
  { filePath: ".devin/config.local.json", key: "module-gates" },
  { filePath: ".pi/settings.json", key: "module-gates" },
];
