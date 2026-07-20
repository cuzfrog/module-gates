# Development

## Project

`module-gates` controls the entropy of the codebase by enforcing code module boundaries during coding agent sessions. When the agent edits or writes files, it checks whether the operation respects each module's contract.

The core is agent-agnostic; bridges connect it to each agent:

- `src/core/` — core logic (config, module index, gates, system prompt hint). Knows nothing about agents.
- `src/bridges/pi/` — pi extension bridge; wires pi session/tool events into the core.
- `src/bridges/claude/` — Claude Code bridge; `PreToolUse`/`SessionStart` hooks plus the settings writer used by the CLI.
- `src/cli/` + `bin/module-gates.mjs` — `module-gates install-claude | uninstall-claude`.
- `src/bootstrap-jiti.mjs` — shared Node bootstrap: loads TS entry points on the fly via [jiti](https://github.com/unjs/jiti). No build step, no bun.

## Setup

Node >= 20.

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
bin/
  module-gates.mjs                    — CLI entry (node + jiti)
src/
  bootstrap-jiti.mjs                  — jiti bootstrap shared by bin/ and claude run.mjs
  core/                               — agent-agnostic core; public surface: index.ts
    index.ts                          — public re-exports
    engine.ts                         — createGateEngine facade used by bridges
    types.ts                          — shared domain types
    config.ts                         — ConfigSource chain, first existing source wins
    context/
      system-prompt.ts                — builds system prompt hint from module index
    gates/
      run-gates.ts                    — composes all gates for one edit
      readonly-gate.ts                — blocks writes to readonly files
      no-new-exports-gate.ts          — blocks new exports on no-new-exports files
      module-interface-import-gate.ts — blocks imports of module internals
      checkers/                       — per-language public-API checkers + registry
    graph/
      module-index-builder.ts         — scans for descriptors, builds module index
    utils/
      frontmatter.ts                  — YAML frontmatter parsing
  bridges/
    pi/index.ts                       — pi extension entry
    claude/
      run.mjs                         — hook runner entry (node + jiti)
      hooks.json                      — plugin hook declarations
      pre-tool-use.ts                 — PreToolUse hook
      session-start.ts                — SessionStart hook (system prompt injection)
      settings-writer.ts              — upsert/remove hooks in .claude/settings.json
      config-sources.ts               — config discovery chain for the claude bridge
  cli/
    install-claude.ts
    uninstall-claude.ts
.claude-plugin/                       — Claude Code plugin + marketplace manifests (git-only, not in the npm tarball)
test/
  behavior/                           — end-to-end gate behavior against fixtures
  fixture/                            — realistic project trees used by tests
```

## Runtime bootstrap

TypeScript runs on the fly — there is no compile step:
- pi loads TS entry points natively.
- Node entry points (`bin/module-gates.mjs`, `src/bridges/claude/run.mjs`) go through `src/bootstrap-jiti.mjs`.
- Installed as a Claude plugin (no `node_modules` in the plugin dir), the bootstrap installs runtime deps (`jiti`, `yaml`) into `${CLAUDE_PLUGIN_DATA}` on first hook invocation.

## Config discovery

`loadConfig(cwd, sources)` walks an ordered list of `ConfigSource = { filePath; key? }`; the first source whose file exists wins. A source without `key` reads the whole file. The core never knows agent-specific locations — each bridge supplies its chain:

- canonical: `.module-gates/config.json` (whole file)
- pi bridge: then `.pi/settings.json#module-gates`, then `.claude/settings.json#module-gates`
- claude bridge: then `.claude/settings.json#module-gates`, then `.pi/settings.json#module-gates`

## Adding a checker (new language)

1. Create `src/core/gates/checkers/<language>.ts` exporting a function matching the `Checker` signature
2. Register it in `src/core/gates/checkers/index.ts`
3. Add unit tests at `src/core/gates/checkers/<language>.test.ts`

## Adding a bridge (new agent)

1. Create `src/bridges/<agent>/`.
2. Define an ordered `ConfigSource[]` for the agent's settings locations (canonical first).
3. Create the engine once per session or per invocation: `createGateEngine(cwd, { configSources })`.
4. Map the agent's edit events to `{ oldText, newText }` pairs and call `engine.checkEdit`.
5. Surface `engine.diagnostics` prefixed with `[Module Gate] ` and inject `engine.systemPromptHint` where the agent supports it.
6. Fail open: bootstrap or indexing errors must never block the agent — log and allow.
7. Register the entry point where the agent's runtime expects it (e.g. `pi.extensions` in package.json, or a hooks manifest).

## Publishing

1. Bump `version` in `package.json` (package name is `@cuzfrog/module-gates`).
2. `npm publish --no-provenance` — `publishConfig` already sets public access and provenance (`--no-provenance` is for local publish the first time).
3. see @AGENTS_GIT.md for CI publish

The Claude plugin is installed from this git repo via the marketplace, not from npm. When the repo is renamed to `module-gates`, update the marketplace command in README and the homepage/repository URLs in package.json.
