import * as fs from "node:fs";
import * as path from "node:path";

export const HOOK_MARKER = "@cuzfrog/module-gates";
export const PRE_TOOL_USE_MATCHER = "Edit|MultiEdit|Write";
export const SESSION_START_MATCHER = "startup|resume|clear";

export type ClaudeHook = {
  type: string;
  command?: string;
  statusMessage?: string;
  [key: string]: unknown;
};

export type HookMatcher = {
  matcher: string;
  hooks: ClaudeHook[];
};

export type ClaudeSettings = {
  hooks?: Record<string, HookMatcher[]>;
  [key: string]: unknown;
};

export function readSettings(projectDir: string): ClaudeSettings {
  const settingsPath = path.join(projectDir, ".claude", "settings.json");
  try {
    const raw = fs.readFileSync(settingsPath, "utf-8");
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as ClaudeSettings;
    }
    return {};
  } catch {
    return {};
  }
}

export function buildPreToolUseEntry(): HookMatcher {
  return {
    matcher: PRE_TOOL_USE_MATCHER,
    hooks: [
      {
        type: "command",
        command: `node ${HOOK_BASE} pre-tool-use`,
        statusMessage: "Module gate checking edit...",
      },
    ],
  };
}

export function buildSessionStartEntry(): HookMatcher {
  return {
    matcher: SESSION_START_MATCHER,
    hooks: [
      {
        type: "command",
        command: `node ${HOOK_BASE} session-start`,
      },
    ],
  };
}

export function upsertHooks(settings: ClaudeSettings): ClaudeSettings {
  const next: ClaudeSettings = JSON.parse(JSON.stringify(settings));
  next.hooks = next.hooks ?? {};
  next.hooks.PreToolUse = upsertEvent(next.hooks.PreToolUse ?? [], buildPreToolUseEntry());
  next.hooks.SessionStart = upsertEvent(next.hooks.SessionStart ?? [], buildSessionStartEntry());
  return next;
}

export function removeHooks(settings: ClaudeSettings): ClaudeSettings {
  const next: ClaudeSettings = JSON.parse(JSON.stringify(settings));
  if (!next.hooks) return next;
  for (const event of ["PreToolUse", "SessionStart"]) {
    const existing = next.hooks[event];
    if (!existing) continue;
    const filtered = existing.filter((m) => !hasMarker(m));
    if (filtered.length === 0) delete next.hooks[event];
    else next.hooks[event] = filtered;
  }
  if (Object.keys(next.hooks).length === 0) delete next.hooks;
  return next;
}

export function writeSettings(projectDir: string, settings: ClaudeSettings): string {
  const claudeDir = path.join(projectDir, ".claude");
  fs.mkdirSync(claudeDir, { recursive: true });
  const target = path.join(claudeDir, "settings.json");
  fs.writeFileSync(target, JSON.stringify(settings, null, 2) + "\n", "utf-8");
  return target;
}

const HOOK_BASE =
  "${CLAUDE_PROJECT_DIR}/node_modules/@cuzfrog/module-gates/src/bridges/claude/run.mjs";

function upsertEvent(existing: HookMatcher[], entry: HookMatcher): HookMatcher[] {
  return [...existing.filter((m) => !hasMarker(m)), entry];
}

function hasMarker(matcher: HookMatcher): boolean {
  return matcher.hooks.some(
    (h) => typeof h.command === "string" && h.command.includes(HOOK_MARKER),
  );
}
