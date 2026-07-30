import * as path from "node:path";
import * as url from "node:url";
import type {
  ExtensionAPI,
  ExtensionContext,
  ToolCallEventResult,
  BeforeAgentStartEventResult,
} from "@earendil-works/pi-coding-agent";

export const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
export const FIXTURES = path.resolve(__dirname, "..", "fixture/module-simulation");
export const MALFORMED = path.resolve(__dirname, "..", "fixture/malformed-module");
export const MODIFIER_LOCK = path.resolve(__dirname, "..", "fixture/module-modifier-lock");

type EventHandler = (event: any, ctx: ExtensionContext) => Promise<any> | any;

export class MockExtensionAPI implements ExtensionAPI {
  private _handlers = new Map<string, EventHandler[]>();
  private _notifications: { message: string; type: string }[] = [];

  get notifications(): readonly { message: string; type: string }[] {
    return this._notifications;
  }
  recordNotification(message: string, type: string) {
    this._notifications.push({ message, type });
  }
  clearNotifications() {
    this._notifications.length = 0;
  }

  async dispatch(event: any, ctx: ExtensionContext): Promise<any[]> {
    const handlers = this._handlers.get(event.type) ?? [];
    const results: any[] = [];
    for (const fn of handlers) {
      results.push(await fn(event, ctx));
    }
    return results;
  }

  on(event: string, handler: EventHandler): void {
    const list = this._handlers.get(event) ?? [];
    list.push(handler);
    this._handlers.set(event, list);
  }

  registerTool() {}
  registerCommand() {}
  registerShortcut() {}
  registerFlag() {}
  getFlag() {
    return undefined;
  }
  registerMessageRenderer() {}
  registerEntryRenderer() {}
  registerProvider() {}
  unregisterProvider() {}
  exec = async () => ({ exitCode: 0, code: 0, killed: false, stdout: "", stderr: "" });
  sendMessage = () => {};
  sendUserMessage = () => {};
  appendEntry = () => {};
  setSessionName = () => {};
  getSessionName = () => undefined;
  setLabel = () => {};
  getActiveTools = () => [];
  getAllTools = () => [];
  setActiveTools = () => {};
  getCommands = () => [];
  setModel = async () => false;
  getThinkingLevel = () => "medium" as any;
  setThinkingLevel = () => {};

  events = {
    on() {},
    off() {},
    emit() {},
  } as any;
}

export function makeCtx(cwd: string): ExtensionContext {
  return {
    cwd,
    hasUI: true,
    mode: "tui",
    ui: {
      notify(_message: string, _type?: string) {
        throw new Error("ui.notify called before mockCtx wiring");
      },
    } as any,
    sessionManager: {
      getSessionFile: () => null,
      getEntries: () => [],
      getBranch: () => [],
      getLeafId: () => null,
    } as any,
    modelRegistry: {} as any,
    model: undefined,
    scopedModels: [],
    isIdle: () => true,
    isProjectTrusted: () => true,
    signal: undefined,
    abort() {},
    hasPendingMessages: () => false,
    shutdown() {},
    getContextUsage: () => undefined,
    compact() {},
    getSystemPrompt: () => "",
  };
}

export function makeCtxWithNotify(
  cwd: string,
  onNotify: (message: string, type?: string) => void,
): ExtensionContext {
  const base = makeCtx(cwd);
  return {
    ...base,
    ui: {
      ...base.ui,
      notify: onNotify,
    },
  };
}

// ── convenience helpers ─────────────────────────────────────────────────

export async function startSession(
  mock: MockExtensionAPI,
  cwd: string,
) {
  const ctx = makeCtxWithNotify(cwd, (message, type) => {
    mock.recordNotification(message, type ?? "info");
  });
  await mock.dispatch({ type: "session_start", reason: "startup" }, ctx);
}

export async function doWrite(
  mock: MockExtensionAPI,
  filePath: string,
  content: string,
  cwd: string,
): Promise<ToolCallEventResult | void> {
  const ctx = makeCtx(cwd);
  const results = await mock.dispatch(
    {
      type: "tool_call",
      toolCallId: "tc-1",
      toolName: "write",
      input: { path: filePath, content },
    },
    ctx,
  );
  return results.find((r) => r !== undefined);
}

export async function doEdit(
  mock: MockExtensionAPI,
  filePath: string,
  edits: { oldText: string; newText: string }[],
  cwd: string,
): Promise<ToolCallEventResult | void> {
  const ctx = makeCtx(cwd);
  const results = await mock.dispatch(
    {
      type: "tool_call",
      toolCallId: "tc-1",
      toolName: "edit",
      input: { path: filePath, edits },
    },
    ctx,
  );
  return results.find((r) => r !== undefined);
}

export async function doBeforeAgentStart(
  mock: MockExtensionAPI,
  systemPrompt: string,
  cwd: string,
): Promise<BeforeAgentStartEventResult | void> {
  const ctx = makeCtx(cwd);
  const results = await mock.dispatch(
    {
      type: "before_agent_start",
      prompt: "test",
      systemPrompt,
    },
    ctx,
  );
  return results.find((r) => r !== undefined);
}
