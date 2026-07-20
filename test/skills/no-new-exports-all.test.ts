import { describe, it, expect } from "vitest";
import { tmpdir } from "node:os";
import { mkdtempSync, writeFileSync, rmSync, mkdirSync, existsSync, readFileSync, readdirSync } from "node:fs";
import { join, sep } from "node:path";
import { execSync } from "node:child_process";
import { SUPPORTED_EXTENSIONS } from "../../skills/module-no-new-exports-all/scripts/no-new-exports-all.mjs";
import { getChecker } from "../../src/core/gates/checkers/registry.ts";
import "../../src/core/gates/checkers/typescript.ts";
import "../../src/core/gates/checkers/rust.ts";
import "../../src/core/gates/checkers/java.ts";
import "../../src/core/gates/checkers/go.ts";
import "../../src/core/gates/checkers/kotlin.ts";
import "../../src/core/gates/checkers/scala.ts";

const scriptPath = join(
  import.meta.dirname,
  "..",
  "..",
  "skills",
  "module-no-new-exports-all",
  "scripts",
  "no-new-exports-all.mjs",
);

const checkersDir = join(import.meta.dirname, "..", "..", "src", "core", "gates", "checkers");

function extractCheckerExtensions(): Set<string> {
  const extensions = new Set<string>();
  for (const name of readdirSync(checkersDir)) {
    if (!name.endsWith(".ts") || name === "index.ts" || name === "registry.ts" || name.endsWith(".test.ts")) continue;
    const content = readFileSync(join(checkersDir, name), "utf-8");
    const match = content.match(/extensions:\s*\[([^\]]+)\]/);
    if (!match) throw new Error(`No extensions array found in ${name}`);
    for (const ext of match[1].matchAll(/"([^"]+)"/g)) {
      extensions.add(ext[1]);
    }
  }
  return extensions;
}

function runScript(cwd: string, args: string[]): { stdout: string; stderr: string; status: number } {
  try {
    const stdout = execSync(`node ${scriptPath} ${args.join(" ")}`, {
      cwd,
      encoding: "utf-8",
      stdio: "pipe",
    });
    return { stdout, stderr: "", status: 0 };
  } catch (e: unknown) {
    const err = e as { stdout?: string; stderr?: string; status?: number };
    return {
      stdout: (err.stdout ?? "").toString(),
      stderr: (err.stderr ?? "").toString(),
      status: err.status ?? 1,
    };
  }
}

function setupFixture(): string {
  const dir = mkdtempSync(join(tmpdir(), "module-no-new-exports-all-test-"));
  mkdirSync(join(dir, "src"), { recursive: true });
  mkdirSync(join(dir, "src", "sub"), { recursive: true });
  return dir;
}

function cleanupFixture(dir: string): void {
  rmSync(dir, { recursive: true, force: true });
}

describe("no-new-exports-all.mjs", () => {
  it("adds no-new-exports entries to existing module.md", () => {
    const dir = setupFixture();

    writeFileSync(
      join(dir, "src", "module.md"),
      "---\nnote: [greet]\n---\n\nSome prose.\n",
    );
    writeFileSync(join(dir, "src", "app.ts"), "export function greet() {}");
    writeFileSync(join(dir, "src", "utils.ts"), "export function helper() {}");
    // subdir with files but no module.md — should NOT be included
    writeFileSync(join(dir, "src", "sub", "nested.ts"), "export const x = 1");

    const result = runScript(dir, ["--root", "src"]);
    expect(result.status).toBe(0);

    const updated = readFileSync(join(dir, "src", "module.md"), "utf-8");
    expect(updated).toContain("no-new-exports:");
    expect(updated).toContain("app.ts");
    expect(updated).toContain("utils.ts");
    expect(updated).not.toContain("nested.ts");

    // Should preserve existing fields
    expect(updated).toContain("note:");
    expect(updated).toContain("greet");
    expect(updated).toContain("Some prose.");

    cleanupFixture(dir);
  });

  it("preserves existing no-new-exports entries when adding new ones", () => {
    const dir = setupFixture();

    writeFileSync(
      join(dir, "src", "module.md"),
      "---\nno-new-exports:\n  - existing.ts\n---\n\n",
    );
    writeFileSync(join(dir, "src", "existing.ts"), "");
    writeFileSync(join(dir, "src", "new-file.ts"), "");

    const result = runScript(dir, ["--root", "src"]);
    expect(result.status).toBe(0);

    const updated = readFileSync(join(dir, "src", "module.md"), "utf-8");
    expect(updated).toContain("existing.ts");
    expect(updated).toContain("new-file.ts");

    // existing should appear before new-file
    const existingIdx = updated.indexOf("existing.ts");
    const newIdx = updated.indexOf("new-file.ts");
    expect(existingIdx).toBeLessThan(newIdx);

    cleanupFixture(dir);
  });

  it("skips sub-module directories", () => {
    const dir = setupFixture();

    writeFileSync(
      join(dir, "src", "module.md"),
      "---\n---\n\n",
    );
    writeFileSync(join(dir, "src", "app.ts"), "");
    writeFileSync(join(dir, "src", "sub", "module.md"), "---\n---\n\n");
    writeFileSync(join(dir, "src", "sub", "child.ts"), "");

    const result = runScript(dir, ["--root", "src"]);
    expect(result.status).toBe(0);

    const parent = readFileSync(join(dir, "src", "module.md"), "utf-8");
    expect(parent).toContain("app.ts");
    expect(parent).not.toContain("child.ts");

    const child = readFileSync(join(dir, "src", "sub", "module.md"), "utf-8");
    expect(child).toContain("child.ts");

    cleanupFixture(dir);
  });

  it("idempotent: running twice produces same result", () => {
    const dir = setupFixture();

    writeFileSync(
      join(dir, "src", "module.md"),
      "---\nnote: [greet]\n---\n\n",
    );
    writeFileSync(join(dir, "src", "app.ts"), "");

    runScript(dir, ["--root", "src"]);
    const firstRun = readFileSync(join(dir, "src", "module.md"), "utf-8");

    runScript(dir, ["--root", "src"]);
    const secondRun = readFileSync(join(dir, "src", "module.md"), "utf-8");

    expect(secondRun).toBe(firstRun);

    cleanupFixture(dir);
  });

  it("dry-run does not modify files", () => {
    const dir = setupFixture();

    const original = "---\nnote: [greet]\n---\n\n";
    writeFileSync(join(dir, "src", "module.md"), original);
    writeFileSync(join(dir, "src", "app.ts"), "");

    const result = runScript(dir, ["--root", "src", "--dry-run"]);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Dry run");

    const content = readFileSync(join(dir, "src", "module.md"), "utf-8");
    expect(content).toBe(original);

    cleanupFixture(dir);
  });

  it("reports no changes when all up to date", () => {
    const dir = setupFixture();

    writeFileSync(
      join(dir, "src", "module.md"),
      "---\nno-new-exports:\n  - app.ts\n---\n\n",
    );
    writeFileSync(join(dir, "src", "app.ts"), "");

    const result = runScript(dir, ["--root", "src"]);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("up to date");

    cleanupFixture(dir);
  });

  it("--create adds module.md to directories without one", () => {
    const dir = setupFixture();

    writeFileSync(join(dir, "src", "app.ts"), "");
    writeFileSync(join(dir, "src", "utils.ts"), "");

    // No module.md exists
    expect(existsSync(join(dir, "src", "module.md"))).toBe(false);

    const result = runScript(dir, ["--root", "src", "--create"]);
    expect(result.status).toBe(0);

    const created = readFileSync(join(dir, "src", "MODULE.md"), "utf-8");
    expect(created).toContain("no-new-exports:");
    expect(created).toContain("app.ts");
    expect(created).toContain("utils.ts");

    cleanupFixture(dir);
  });

  it("handles module.md without frontmatter gracefully", () => {
    const dir = setupFixture();

    writeFileSync(join(dir, "src", "module.md"), "Just prose, no frontmatter.\n");
    writeFileSync(join(dir, "src", "app.ts"), "");

    const result = runScript(dir, ["--root", "src"]);
    expect(result.status).toBe(0);

    const updated = readFileSync(join(dir, "src", "module.md"), "utf-8");
    expect(updated).toContain("no-new-exports:");
    expect(updated).toContain("app.ts");
    expect(updated).toContain("Just prose");

    cleanupFixture(dir);
  });

  it("handles custom descriptor name", () => {
    const dir = setupFixture();

    writeFileSync(join(dir, "src", "MODULE.md"), "---\n---\n\n");
    writeFileSync(join(dir, "src", "app.ts"), "");

    const result = runScript(dir, ["--root", "src", "--descriptor-name", "MODULE.md"]);
    expect(result.status).toBe(0);

    const updated = readFileSync(join(dir, "src", "MODULE.md"), "utf-8");
    expect(updated).toContain("app.ts");

    cleanupFixture(dir);
  });

  it("errors on non-existent root", () => {
    const dir = setupFixture();
    const result = runScript(dir, ["--root", "nonexistent"]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("not found");
    cleanupFixture(dir);
  });

  it("skips module.md when directory has no files", () => {
    const dir = setupFixture();
    mkdirSync(join(dir, "src", "empty"), { recursive: true });

    const original = "---\n---\n\n";
    writeFileSync(join(dir, "src", "empty", "module.md"), original);

    const result = runScript(dir, ["--root", "src"]);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("up to date");

    const updated = readFileSync(join(dir, "src", "empty", "module.md"), "utf-8");
    expect(updated).toBe(original);

    cleanupFixture(dir);
  });

  it("filters out files with unsupported extensions by default", () => {
    const dir = setupFixture();

    writeFileSync(join(dir, "src", "module.md"), "---\n---\n\n");
    writeFileSync(join(dir, "src", "app.ts"), "");
    writeFileSync(join(dir, "src", "main.go"), "");
    writeFileSync(join(dir, "src", "lib.rs"), "");
    writeFileSync(join(dir, "src", "README.md"), "readme");
    writeFileSync(join(dir, "src", "package.json"), "{}");
    writeFileSync(join(dir, "src", "notes.txt"), "notes");
    writeFileSync(join(dir, "src", "config.yaml"), "key: val");

    const result = runScript(dir, ["--root", "src"]);
    expect(result.status).toBe(0);

    const updated = readFileSync(join(dir, "src", "module.md"), "utf-8");
    expect(updated).toContain("app.ts");
    expect(updated).toContain("main.go");
    expect(updated).toContain("lib.rs");
    expect(updated).not.toContain("README.md");
    expect(updated).not.toContain("package.json");
    expect(updated).not.toContain("notes.txt");
    expect(updated).not.toContain("config.yaml");

    cleanupFixture(dir);
  });

  it("preserves existing no-new-exports entries with unsupported extensions", () => {
    const dir = setupFixture();

    writeFileSync(
      join(dir, "src", "module.md"),
      "---\nno-new-exports:\n  - docs.md\n---\n\n",
    );
    writeFileSync(join(dir, "src", "docs.md"), "doc");
    writeFileSync(join(dir, "src", "app.ts"), "");

    const result = runScript(dir, ["--root", "src"]);
    expect(result.status).toBe(0);

    const updated = readFileSync(join(dir, "src", "module.md"), "utf-8");
    expect(updated).toContain("docs.md");
    expect(updated).toContain("app.ts");
    // docs.md should come first since it was an existing entry
    const docsIdx = updated.indexOf("docs.md");
    const appIdx = updated.indexOf("app.ts");
    expect(docsIdx).toBeLessThan(appIdx);

    cleanupFixture(dir);
  });

  it("SUPPORTED_EXTENSIONS matches registered checker extensions", () => {
    const checkerExtensions = extractCheckerExtensions();

    const scriptList = new Set(SUPPORTED_EXTENSIONS);

    for (const ext of scriptList) {
      expect(getChecker(`file${ext}`), `getChecker for ${ext}`).toBeDefined();
    }

    const missingFromScript = [...checkerExtensions].filter((e) => !scriptList.has(e));
    const extraInScript = [...scriptList].filter((e) => !checkerExtensions.has(e));

    expect(missingFromScript, `checker extensions missing from script: ${missingFromScript.join(", ")}`).toEqual([]);
    expect(extraInScript, `script extensions missing from checkers: ${extraInScript.join(", ")}`).toEqual([]);
  });
});