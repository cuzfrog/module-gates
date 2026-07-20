import { registerChecker } from "./registry.ts";
import type { ExportChecker } from "./registry.ts";
import type { Signature } from "../../types.ts";

const rustChecker: ExportChecker = {
  extensions: [".rs"],
  getNewExports(before: string, after: string): Signature[] {
    const beforeNames = new Set(
      [...extractPubItems(before), ...extractPubUses(before)].map((s) => s.name),
    );
    return [...extractPubItems(after), ...extractPubUses(after)].filter(
      (sig) => !beforeNames.has(sig.name),
    );
  },
};

registerChecker(rustChecker);

function extractPubItems(src: string): Signature[] {
  return [...src.matchAll(
    /^(pub(?:\([^)]*\))?)(?:\s+(?:unsafe|async|const|extern(?:\s+"[^"]+")?))*\s+(?:fn|struct|enum|trait|type|const|mod|static)\s+(\w+)/gm,
  )].map((m) => ({ modifier: m[1], name: m[2] }));
}

function extractPubUses(src: string): Signature[] {
  const out: Signature[] = [];
  const re = /^(pub(?:\([^)]*\))?)\s+use\s+([\s\S]*?);/gm;
  for (const m of src.matchAll(re)) {
    const modifier = m[1];
    const body = m[2];
    for (const name of extractUseNames(body)) {
      out.push({ modifier, name });
    }
  }
  return out;
}

function extractUseNames(body: string): string[] {
  const trimmed = body.trim();
  const groupMatch = /^(.+?)::\s*\{([\s\S]*)\}\s*$/.exec(trimmed);
  if (groupMatch) {
    const prefix = groupMatch[1].split("::").pop() ?? "";
    return extractGroupItems(groupMatch[2], prefix);
  }
  const last = trimmed.split("::").pop() ?? "";
  if (last === "self") {
    const segments = trimmed.split("::");
    segments.pop();
    const fallback = segments.pop() ?? "";
    return fallback ? [fallback] : [];
  }
  const parsed = parseRenamed(last);
  return parsed && parsed !== "*" ? [parsed] : [];
}

function extractGroupItems(inner: string, prefix: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let buf = "";
  for (const ch of inner) {
    if (ch === "{") depth++;
    else if (ch === "}") depth--;
    if (ch === "," && depth === 0) {
      pushItem(buf, out, prefix);
      buf = "";
    } else {
      buf += ch;
    }
  }
  pushItem(buf, out, prefix);
  return out;
}

function pushItem(raw: string, out: string[], prefix: string): void {
  const item = raw.trim();
  if (!item || item === "*") return;
  if (item === "self") {
    if (prefix) out.push(prefix);
    return;
  }
  out.push(parseRenamed(item));
}

function parseRenamed(item: string): string {
  const asIdx = item.lastIndexOf(" as ");
  const tail = asIdx >= 0 ? item.slice(asIdx + 4) : item;
  return tail.split("::").pop() ?? "";
}
