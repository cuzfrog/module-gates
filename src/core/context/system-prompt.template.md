## Module gates (boundary enforcement)
This project uses `{{descriptorFileName}}`(case-insensitive) files to declare readonly and no-new-exports rules that you should follow.
If you cannot comply, reconsider your design or raise to the user with tradeoffs if necessary.
Each `{{descriptorFileName}}` gates its branching point in the tree.

- Violations will be blocked: the affected changes are not applied and you are notified.
{{#if descriptorReadonly}}- {{descriptorReadonly}}{{/if}}
{{#if moduleInterfaceImportGate}}- {{moduleInterfaceImportGate}}{{/if}}

See @cuzfrog/module-gates#README.md for configurations.

### Glossary
- `module`: a directory containing code, all files in its recursive subdirectories are internal files of the module;
- `external files`: files not in the module directory or subdirectories;
- `module interface`: the file representing the module surface, e.g. `index.ts` in Typescript, `mod.rs` in Rust;
- `readonly`: files are managed by user;
- `no-new-exports`: files cannot add new exports, but the body is still editable; the export surface is closed;
