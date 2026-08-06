import * as path from "node:path";

export type PatchOperation = {
  filePath: string;
  before: string;
  after: string;
};

export function extractPatchOperations(
  rawPatch: string,
  readFile: (absPath: string) => string,
  cwd: string,
): PatchOperation[] {
  const lines = splitPatchLines(rawPatch);
  const operations: PatchOperation[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (line.startsWith("*** Begin Patch")) {
      index++;
      continue;
    }
    if (line.startsWith("*** End Patch")) {
      index++;
      continue;
    }

    if (line.startsWith("*** Add File: ")) {
      const filePath = resolvePatchPath(line.slice("*** Add File: ".length), cwd);
      const { lines: hunkLines, nextIndex } = collectHunkLines(lines, index + 1);
      index = nextIndex;
      const after = hunkLines
        .filter((l) => l.startsWith("+"))
        .map((l) => l.slice(1))
        .join("\n");
      operations.push({ filePath, before: "", after });
      continue;
    }

    if (line.startsWith("*** Delete File: ")) {
      const filePath = resolvePatchPath(line.slice("*** Delete File: ".length), cwd);
      const { nextIndex } = collectHunkLines(lines, index + 1);
      index = nextIndex;
      const absPath = path.resolve(cwd, filePath);
      const before = readFile(absPath);
      operations.push({ filePath, before, after: "" });
      continue;
    }

    if (line.startsWith("*** Update File: ")) {
      const sourcePath = resolvePatchPath(line.slice("*** Update File: ".length), cwd);
      const sourceAbs = path.resolve(cwd, sourcePath);
      const before = readFile(sourceAbs);

      let targetPath = sourcePath;
      let targetBefore = before;
      index++;

      if (index < lines.length && lines[index].startsWith("*** Move to: ")) {
        targetPath = resolvePatchPath(lines[index].slice("*** Move to: ".length), cwd);
        targetBefore = readFile(path.resolve(cwd, targetPath));
        index++;
      }

      const { lines: hunkLines, nextIndex } = collectHunkLines(lines, index);
      index = nextIndex;

      const after = computeAfter(before, hunkLines);

      if (targetPath !== sourcePath) {
        operations.push({ filePath: sourcePath, before, after: "" });
      }
      operations.push({ filePath: targetPath, before: targetBefore, after });
      continue;
    }

    index++;
  }

  return operations;
}

function splitPatchLines(rawPatch: string): string[] {
  const body = rawPatch.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  return body.split("\n");
}

function resolvePatchPath(rawPath: string, cwd: string): string {
  const trimmed = rawPath.trim();
  if (path.isAbsolute(trimmed)) return trimmed;
  return path.resolve(cwd, trimmed);
}

function collectHunkLines(lines: string[], start: number): { lines: string[]; nextIndex: number } {
  const hunkLines: string[] = [];
  let index = start;
  while (index < lines.length) {
    const line = lines[index];
    if (
      line.startsWith("*** Add File: ") ||
      line.startsWith("*** Update File: ") ||
      line.startsWith("*** Delete File: ") ||
      line.startsWith("*** Begin Patch") ||
      line.startsWith("*** End Patch")
    ) {
      break;
    }
    if (line === "*** End of File") {
      index++;
      break;
    }
    hunkLines.push(line);
    index++;
  }
  return { lines: hunkLines, nextIndex: index };
}

function computeAfter(before: string, hunkLines: string[]): string {
  if (hunkLines.length === 0) return before;

  const hasHunkHeaders = hunkLines.some((l) => l.startsWith("@@"));
  if (!hasHunkHeaders) {
    return hunkLines
      .filter((l) => l.startsWith(" ") || l.startsWith("+"))
      .map((l) => l.slice(1))
      .join("\n");
  }

  return applyHunkedPatch(before, hunkLines);
}

function applyHunkedPatch(before: string, hunkLines: string[]): string {
  const beforeLines = before === "" ? [] : before.split("\n");
  const hunks = parseHunks(hunkLines);

  for (let i = hunks.length - 1; i >= 0; i--) {
    const hunk = hunks[i];
    beforeLines.splice(hunk.oldStart - 1, hunk.oldCount, ...hunk.newLines);
  }

  return beforeLines.join("\n");
}

type Hunk = {
  oldStart: number;
  oldCount: number;
  newLines: string[];
};

function parseHunks(lines: string[]): Hunk[] {
  const hunks: Hunk[] = [];
  let current: string[] = [];

  for (const line of lines) {
    if (line.startsWith("@@")) {
      if (current.length > 0) {
        const parsed = parseHunk(current);
        if (parsed) hunks.push(parsed);
      }
      current = [line];
      continue;
    }
    current.push(line);
  }

  if (current.length > 0) {
    const parsed = parseHunk(current);
    if (parsed) hunks.push(parsed);
  }

  return hunks;
}

function parseHunk(lines: string[]): Hunk | undefined {
  const header = lines[0];
  const body = lines.slice(1);

  const headerMatch = header.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
  const oldStart = headerMatch ? Number(headerMatch[1]) : 1;

  const newLines = body
    .filter((l) => l.startsWith(" ") || l.startsWith("+"))
    .map((l) => l.slice(1));

  const oldCount = body.filter((l) => l.startsWith(" ") || l.startsWith("-")).length;

  return { oldStart, oldCount, newLines };
}
