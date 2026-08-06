#!/usr/bin/env node
// Plain JavaScript so npm can invoke it directly; TypeScript CLI modules are
// loaded through jiti (see src/bootstrap-jiti.mjs).
import { isAbsolute, join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadTsModule } from "../src/bootstrap-jiti.mjs";

const PKG_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function printUsage() {
  process.stderr.write(`Usage: module-gates <command> [...args]

Commands:
  install-claude [--project-dir <dir>]    Install Claude Code hooks into <dir>/.claude/settings.json
  uninstall-claude [--project-dir <dir>]  Remove Claude Code hooks from <dir>/.claude/settings.json
  install-devin [--project-dir <dir>]     Install Devin CLI hooks into <dir>/.devin/hooks.v1.json
  uninstall-devin [--project-dir <dir>]   Remove Devin CLI hooks from <dir>/.devin/hooks.v1.json

Environment:
  CLAUDE_PROJECT_DIR    Default --project-dir when running inside Claude Code.
  DEVIN_PROJECT_DIR     Default --project-dir when running inside Devin CLI.

Examples:
  module-gates install-claude
  module-gates install-claude --project-dir /path/to/project
  module-gates uninstall-claude
  module-gates install-devin
  module-gates install-devin --project-dir /path/to/project
  module-gates uninstall-devin
`);
}

function parseProjectDir(argv) {
  let projectDir =
    process.env.DEVIN_PROJECT_DIR ?? process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--project-dir" && i + 1 < argv.length) {
      projectDir = argv[++i];
    }
  }
  return isAbsolute(projectDir) ? projectDir : resolve(process.cwd(), projectDir);
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  if (!cmd) {
    printUsage();
    process.exit(1);
  }
  if (cmd === "-h" || cmd === "--help") {
    printUsage();
    process.exit(0);
  }

  const projectDir = parseProjectDir(rest);

  if (cmd === "install-claude") {
    const mod = await loadTsModule(join(PKG_ROOT, "src/cli/install-claude.ts"));
    const result = mod.installClaude({ projectDir });
    if (!result.ok) {
      process.stderr.write(`${result.reason}\n`);
      process.exit(1);
    }
    process.exit(0);
  }

  if (cmd === "uninstall-claude") {
    const mod = await loadTsModule(join(PKG_ROOT, "src/cli/uninstall-claude.ts"));
    const result = mod.uninstallClaude({ projectDir });
    if (!result.ok) {
      process.stderr.write(`${result.reason}\n`);
      process.exit(1);
    }
    process.exit(0);
  }

  if (cmd === "install-devin") {
    const mod = await loadTsModule(join(PKG_ROOT, "src/cli/install-devin.ts"));
    const result = mod.installDevin({ projectDir });
    if (!result.ok) {
      process.stderr.write(`${result.reason}\n`);
      process.exit(1);
    }
    process.exit(0);
  }

  if (cmd === "uninstall-devin") {
    const mod = await loadTsModule(join(PKG_ROOT, "src/cli/uninstall-devin.ts"));
    const result = mod.uninstallDevin({ projectDir });
    if (!result.ok) {
      process.stderr.write(`${result.reason}\n`);
      process.exit(1);
    }
    process.exit(0);
  }

  process.stderr.write(`Unknown command: ${cmd}\n`);
  printUsage();
  process.exit(2);
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`[module-gates] Unexpected error: ${message}\n`);
  process.exit(1);
});
