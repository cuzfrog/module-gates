# `visible` — removed, pending redesign

The `visible` export-whitelist feature was removed from the codebase to be redesigned and re-implemented later. This document records the old semantics so nothing is lost.

## What it was

A per-module whitelist of exports declared in the descriptor frontmatter:

```yaml
visible:
  - greet            # bare string: equivalent to `path: ./greet`
  - sub/mod1/Foo     # path form: name extracted from the last path segment
```

or with an explicit modifier requirement:

```yaml
visible:
  - path: my_function
    modifier: pub(crate)   # optional, demanded an exact match
```

## Semantics

| Scenario | Behavior |
|----------|----------|
| `visible` key absent | Module unconstrained — exports not gated (`null` internally). |
| `visible: []` | Module fully closed — no new exports may be added; editing existing exports still allowed. |
| Export not in the list | Write blocked (export gate). |
| Modifier mismatch | Write blocked when the entry declared a `modifier` and the export's modifier differed. |

A descriptor only enforced exports within its immediate directory.

### Complement pass

When a parent module listed a path-based entry pointing into a child module (e.g. `sub/Helper`), the child module's `visible` list was automatically complemented with that name, so the child could not lock out what the parent exposed.

### Validation

At index time, `visible` entries referencing symbols that existed nowhere in the module produced an info-level "dangling entry" notification.

### Scope boundary

`visible` gated *writes* (adding/modifying exports). The planned import-side gating — external files importing only symbols a module declared visible — was never implemented.

## Why it was removed

The whitelist model interacted poorly with agent workflows and needs a redesign. Removing it simplifies the core while the remaining gates (`readonly`, `no-new-exports`, module-interface-import) stay in place.

## Re-adding it

The architecture keeps gates composable: each gate is a pure check over `(filePath, before, after, index, cwd)` returning a denial, and `runGates` composes them in sequence. The language checker registry (`getNewExports` per language, still used by the `no-new-exports` gate) survives intact. Re-adding means:

1. New fields on `ModuleFrontmatter` / `ModuleContract`.
2. A new gate file under `gates/`, wired into `runGates`.
3. (Optional) index-time validation of entries, reported as diagnostics.
