## Git

- Do not use `gh`. use `./scripts/gh-bot.mjs` so you will have your identity `abao-bot`.
- When file changes in `src/` and `skills/`, update version in `package.json`. Follow Semantic Versioning conventions.
- Keep your PR comments concise and clear. Reply in a review thread.
- Tag version must align with package version, tag should only be on `main`. By pushing a tag, npm release will be triggered automatically.

### branching
- Main branch: `main`
- Feature branches: `<task_id>_<short-description>`, e.g., `ISSUE-2_config-loader`
- User branches: `dev_*`, `fix_`.

### PR title - semantic-pull-request format:
<type>([optional task_id]): <description>
```yaml
types:
  - feat
  - fix
  - docs
  - style
  - refactor
  - perf
  - test
  - chore
  - ci
```

### PR Squash commit message
- Do not contain any individual commits. Use the github template.
