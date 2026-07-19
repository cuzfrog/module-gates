# Development

## Project

This is a **pi extension** (`pi-module-gates`) that enforces module-boundary rules during coding agent sessions. When the agent edits or writes files, the extension checks whether the operation respects each module's contract — i.e., are you allowed to write to this file, and are you exposing the right public API?

## Setup

```bash
npm install
```

## Commands

| Command | Description |
|---------|-------------|
| `npm run check` | Type-check all sources (tsc --noEmit) |
| `npm run test` | Run all unit tests (vitest) |

## Project Structure

```
src/
  index.ts                        — Extension entry point, wires gates to pi events
  types.ts                        — Public domain types (ModuleContract, ModuleIndex)
  context/
    system-prompt.ts              — Builds system prompt hint from module index
  gates/
    readonly-gate.ts              — Blocks writes to readonly files in a module
    no-new-exports-gate.ts         — Blocks new exports on no-new-exports files in a module
    export-gate.ts                — Blocks changes that break a module's public API
    checkers/
      index.ts                    — Auto-registers all checkers
      registry.ts                 — Checker registry: dispatch by language
      typescript.ts               — TS-specific public-API checker
      rust.ts                     — Rust-specific public-API checker
  graph/
    module-index-builder.ts       — Scans for module.md files, builds the index
    validation.ts                 — Validates that visible entries actually exist
test/
  index.test.ts
  context/system-prompt.test.ts
  gates/export-gate.test.ts
  gates/readonly-gate.test.ts
  gates/checkers/typescript.test.ts
  gates/checkers/rust.test.ts
  graph/module-index-builder.test.ts
  graph/validation.test.ts
  fixture/
    module-simulation/            — Realistic project tree used by multiple tests
    malformed-module/             — Edge-case fixture
doc/
  AGENTS_GIT.md                   — Git conventions + gh bot setup
  Development.md                  — This file
```

## Adding a checker (new language)

1. Create `src/gates/checkers/<language>.ts` exporting a function matching the `Checker` signature
2. Add it to `src/gates/checkers/index.ts` with an import + auto-register call
3. Create `test/gates/checkers/<language>.test.ts` with unit tests
