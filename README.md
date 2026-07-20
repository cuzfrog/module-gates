# module-gates - Constraints liberate, liberties constrain.

Coding-agent extension that controls the entropy of the codebase by enforcing code module boundaries.
It helps combat slop generation and code architecture degradation.

The core is agent-agnostic; per-agent **bridges** connect it to each agent:
- **pi** — pi extension
- **Claude Code** — plugin, or plain hooks installed by the CLI

Adding support for another agent (qwen-code, cursor, ...) means adding a bridge.

## Problem

AI coding agents produce edits with limited context knowledge (myopia) — their changes may leak implementation details, and break architectural contracts (slop).

### Approach

**Module contracts as guardrails.** Each directory can contain a descriptor file that declares:

- `readonly` — files and directories the agent must not touch
- `no-new-exports` — files where no new exports are allowed (body still editable)

The extension intercepts agent `write`/`edit` operations and enforces these contracts. Violations are blocked with a clear reason.

The attempt to add 2 public helper functions is blocked, forcing the agent to re-think the design.
![Module Gate denial example](doc/module_gates_block.png)

### How it works

1. **Indexing** — On session start, scans the project tree for descriptor files and builds a module index.
2. **System prompt** — Injects a hint so the agent knows to respect descriptor file conventions.
3. **Gating** — On every write/edit, checks:
   - **Readonly gate** — is the target file locked?
   - **No-new-exports gate** — would the change add new exports to a file in the `no-new-exports` list?
   - **Module interface import gate** — external files can only import from the module not internal files, i.e. re-exports from `index.ts` or `mod.rs`. A child module may import from a parent module's internal files (not recommended but allowed). (Only Typescript/JavaScript and Rust are supported)
   - **Import gate** (not implemented yet) — would the change introduce an import violating visibility scope?

- System prompt: [system-prompt.md](src/core/context/system-prompt.template.md)
- Currently [supported languages](src/core/gates/checkers/index.ts): **TypeScript/JavaScript**, **Rust**, **Java**, **Go**, **Kotlin**, **Scala**

## Installation

### pi
```bash
pi install npm:@cuzfrog/module-gates
```
Or load directly for a single session:
```bash
pi -e npm:@cuzfrog/module-gates
```

### Claude Code

As a plugin, from this repository's marketplace (no login required — public repo):
```
/plugin marketplace add cuzfrog/module-gates
/plugin install module-gates@cuzfrog
```
On the first hook invocation the plugin installs its runtime dependencies into its data directory.

Or as plain hooks wired into a project (requires the package installed in the project):
```bash
npm install --save-dev @cuzfrog/module-gates
npx module-gates install-claude
```
This writes `PreToolUse` and `SessionStart` hooks into `.claude/settings.json`; `npx module-gates uninstall-claude` removes them. The `SessionStart` hook injects the system prompt hint automatically.

## Module Descriptor Semantics

A module descriptor is a Markdown file (default name: `MODULE.md`) placed in a directory. You can piggy-back on your module context file for example `CONTEXT.md`. A `MODULE.md` only enforces its own immediate directory.

### Readonly constraints

```markdown
---
readonly: [mod.rs]
---

Any prose for the agent to better understand the module.
```

### No-new-exports constraints

```yaml
no-new-exports: [mod.rs]
```
No-new-exports files cannot change their surface size: no new exports or public entries are allowed. The file body is still editable.

A skill [module-no-new-exports-all](skills/module-no-new-exports-all) has been included to populate no-new-exports entries in modules.

| Scenario | Behavior |
|----------|----------|
| No `MODULE.md` | Module is unconstrained — nothing is gated. |
| Malformed YAML frontmatter | The module is left unguarded and an info notification is emitted. |

> The `visible` export whitelist was removed pending a redesign — see [doc/visible.md](doc/visible.md).

## Configuration

The canonical agent-independent location is `.module-gates/config.json` (the whole file is the config, no wrapper key). When it is absent, each bridge falls back to the agents' settings files under a `module-gates` key — pi reads `.pi/settings.json` then `.claude/settings.json`; Claude Code reads `.claude/settings.json` then `.pi/settings.json`. The first existing source wins.

```json
{
  "module-gates": {
    "moduleDescriptorFileName": "MODULE.md",
    "moduleDescriptorReadonly": "file",
    "sourceRoots": ["src/"],
    "outputModuleProseOnBlock": false
  }
}
```

| Option | Default | Description |
|--------|---------|-------------|
| `moduleDescriptorFileName` | `MODULE.md` | File name used for module descriptors (case-insensitive) |
| `moduleDescriptorReadonly` | `"frontmatter"` | `"file"` makes the whole descriptor readonly; `"frontmatter"` locks only the YAML frontmatter (body prose stays editable); `"off"` disables descriptor readonly. `true`/`false` are also accepted for backward compatibility. |
| `sourceRoots` | `["src/"]` | Directories to scan for descriptor files and enforce gates. Pass a single string for one root, or an array for multiple roots (e.g. monorepos with `["packages/app/src/", "packages/lib/src/"]`). Use `[""]` to scan from the project root. Legacy singular `sourceRoot` (string) is still accepted. |
| `disableModuleInterfaceImportGate` | `false` | When `true`, imports will not be forced to be from module interface. |
| `disableSystemPrompt` | `false` | When `true`, skip injecting the module-gates hint into the agent's system prompt. |
| `outputModuleProseOnBlock` | `false` | When `true`, the violating module descriptor's prose is appended to the block message so the agent sees the contract context. Disabled by default to keep the error message concise. |

When no settings file exists or no `module-gates` key is present, defaults apply.

## Troubleshooting
Prompt:
```
Check if PreToolUse hook `module-gates` is triggered and runs expectedly.
```

## License

MIT

## Author
Cause Chung (cuzfrog@gmail.com)
