import * as fs from "node:fs";
import * as path from "node:path";

export const HOOK_MARKER = "@cuzfrog/module-gates";
export const PRE_TOOL_USE_MATCHER = "^(write|edit|apply_patch)$";
export const POST_TOOL_USE_MATCHER = "^(write|edit|apply_patch)$";

export type DevinHook = {
  type: string;
  command?: string;
  timeout?: number;
  [key: string]: unknown;
};

export type DevinHookMatcher = {
  matcher?: string;
  hooks: DevinHook[];
};

export type DevinHooks = {
  [event: string]: DevinHookMatcher[];
};

export function readHooks(projectDir: string): DevinHooks {
  const hooksPath = path.join(projectDir, ".devin", "hooks.v1.json");
  try {
    const raw = fs.readFileSync(hooksPath, "utf-8");
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as DevinHooks;
    }
    return {};
  } catch {
    return {};
  }
}

export function buildPreToolUseEntry(): DevinHookMatcher {
  return {
    matcher: PRE_TOOL_USE_MATCHER,
    hooks: [
      {
        type: "command",
        command: `node ${HOOK_BASE} pre-tool-use`,
        timeout: 10,
      },
    ],
  };
}

export function buildPostToolUseEntry(): DevinHookMatcher {
  return {
    matcher: POST_TOOL_USE_MATCHER,
    hooks: [
      {
        type: "command",
        command: `node ${HOOK_BASE} post-tool-use`,
        timeout: 10,
      },
    ],
  };
}

export function buildSessionStartEntry(): DevinHookMatcher {
  return {
    hooks: [
      {
        type: "command",
        command: `node ${HOOK_BASE} session-start`,
        timeout: 10,
      },
    ],
  };
}

export function upsertHooks(hooks: DevinHooks): DevinHooks {
  const next: DevinHooks = JSON.parse(JSON.stringify(hooks));
  next.PreToolUse = upsertEvent(next.PreToolUse ?? [], buildPreToolUseEntry());
  next.PostToolUse = upsertEvent(next.PostToolUse ?? [], buildPostToolUseEntry());
  next.SessionStart = upsertEvent(next.SessionStart ?? [], buildSessionStartEntry());
  return next;
}

export function removeHooks(hooks: DevinHooks): DevinHooks {
  const next: DevinHooks = JSON.parse(JSON.stringify(hooks));
  for (const event of ["PreToolUse", "PostToolUse", "SessionStart"]) {
    const existing = next[event];
    if (!existing) continue;
    const filtered = existing.filter((m) => !hasMarker(m));
    if (filtered.length === 0) delete next[event];
    else next[event] = filtered;
  }
  if (Object.keys(next).length === 0) return {};
  return next;
}

export function writeHooks(projectDir: string, hooks: DevinHooks): string {
  const devinDir = path.join(projectDir, ".devin");
  fs.mkdirSync(devinDir, { recursive: true });
  const target = path.join(devinDir, "hooks.v1.json");
  fs.writeFileSync(target, JSON.stringify(hooks, null, 2) + "\n", "utf-8");
  return target;
}

const HOOK_BASE =
  '"${DEVIN_PROJECT_DIR}/node_modules/@cuzfrog/module-gates/src/bridges/devin/run.mjs"';

function upsertEvent(existing: DevinHookMatcher[], entry: DevinHookMatcher): DevinHookMatcher[] {
  return [...existing.filter((m) => !hasMarker(m)), entry];
}

function hasMarker(matcher: DevinHookMatcher): boolean {
  return matcher.hooks.some(
    (h) => typeof h.command === "string" && h.command.includes(HOOK_MARKER),
  );
}
