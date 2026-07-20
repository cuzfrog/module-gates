# Context Rules

## Code Structure
- `src/` - extention source
- `test/` - unit tests
- `.tasks/` - local development plan directory, e.g. `.tasks/ISSUE-2/` for Github issue #2.

## Glossary
Given the example code structure:
```txt
src/
   file1.ts
   file2.ts
   sub1/
      file3.ts
   sub2/
      file4.ts
```
- Module: a directory. `src/` is a module, `src/sub1/` is a module.
- Siblings: files in the same directory. `src/file1.ts` and `src/file2.ts` are siblings.
- Children: files in a sub-directory. `src/sub1/file3.ts` and `src/sub2/file4.ts` are children of module `src`.
- External: files in external modules. `file1.ts` is an external file from module `sub1`. `file4.ts` is an external file from module `sub1`.
- Internal: files in the same module. `file1.ts` is an internal file of module `src`, `file3.ts` is an internal file of module `sub1` and module `src`.

Also refer to @README.md

## Conversational Style

- Keep answers short and concise
- No emojis in commits, issues, PR comments, or code
- When the user asks a question, answer it first before making edits or running implementation commands.
- When writing text, think from the reader's perspective, write only what they need to know.
- When writing to README, be concise.
- If you want to ask user, simply print the questions, there's no such a ask_user tool.

## Code Conventions

- No `any` types, No enums, No inline imports, No Classes
- Use only erasable TypeScript syntax compatible with Node strip-only mode in TypeScript. Do not use constructor parameter properties, `enum`, `namespace`/`module`, `import =`, `export =`, or other TypeScript constructs that require JavaScript emit. Use explicit fields and constructor assignments instead of parameter properties.
- Public types, contract, methods, higher-level abstractions should be at the top of the files, private implementation details should be at the bottom. If a private function only is used in the same file, it should be below its callers. See below section `Single file layout`.
- Do not add comments except it's a consequential information and the code itself cannot tell.

### Test
- use mocks for unit test. A file `my-function.ts`'s test file `my-function.test.ts` should only test `my-function.ts`.

### Single file layout (ordered from top to bottom)
1. imports
2. domain types
3. 1 public interface
4. constructor method
5. concrete implementation
6. private functions

### Git
- When involving git operations, refer to @doc/AGENTS_GIT.md.
- Use `scripts/gh-bot.mjs` instead of `gh` to assume your identity.

## Coding Principles
- Read files in full before making wide-ranging changes, before editing files you have not already fully inspected, and when the user asks you to investigate or audit something. Do not rely only on search snippets for broad changes. Given a change, do not first attempt to insert into current code base. First look at it from a higher perspective, discover refactor opportunities.
- Check node_modules for external API type definitions instead of guessing
- NEVER remove or downgrade code to fix type errors from outdated dependencies; upgrade the dependency instead
- Naming must reflect the abstraction level. If a newly introduced function violates this, considering renaming the existing function to maintain correct abstraction levels.
- Avoid "helper" functions, they are where code is coupled out of class hierarchy. "helper" functions are functions that are outside the abstraction hierarchy, containing domain logic, serving the only purpose of code reuse. They are different from "utility/support" functions that are purely technical without complex domain logic. Utility functions do not have a position in the abstraction hierarchy.
- A function's parameters should be data it consumes, parameters should not be its dependencies. A high-order function should only be used for transformation instead of procedural processing. Context and config types are exempted from this rule.
- A responsibility should belong to an earlier performer. E.g. if type `Config` can parse the configuration into ready-to-use types, it shouldn't pass raw strings to its clients. A producer should produce the best output for its consumers.
- A module should be easily testable with mocked dependencies. Unit tests should be done with mocks without creating actual dependency or causing any side effects.
- Logic should be put in pure functions as much as possible. Any side effects, e.g. IO, should be at the edge layers with minimal logic. This makes the code easier to test.

### SOLID principles:
- **Single Responsibility Principle**: A function, class, or module should have one, and only one, reason to change.
- **Open/Closed Principle**: Hide implementations behind interfaces. So that modifications happen without the client code needing to know.
- **Liskov Substitution Principle**: Switching implementation should not violate the interface's contract, including implicit ones like side effects and error handling.
- **Interface Segregation Principle**: A client should not be forced to depend on interfaces it does not use.
- **Dependency Inversion Principle**: High-level modules should not depend on low-level modules. Abstractions should not depend on detailed implementations.

## Things to avoid
- do not `find` from the root dir, it's slow and unnecessary. Use `pwd` to figure out where you are.
- do not assume a tool is available unless you are told, search before calling if you are not sure.


## File Edit Checklist
Pre-action:
- Before adding utility functions/logic, check `src/core/utils/` for reuse.

Post-action:
- After file edit (semantic or logic change), run: `npm run test`
