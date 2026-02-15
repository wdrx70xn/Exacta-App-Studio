---
description: Run all pre-commit quality checks (formatting, linting, type-checking)
---

# Pre-Commit Quality Checks

Run ALL THREE checks before committing. Fix issues before proceeding.

// turbo-all

1. Run the formatter (oxfmt):

```sh
npm run fmt
```

2. Run the linter (oxlint). This also auto-fixes simple issues:

```sh
npm run lint
```

3. If lint errors remain after step 2, run aggressive auto-fix:

```sh
npm run lint:fix
```

4. Run TypeScript strict type-checking (tsgo — stricter than standard tsc):

```sh
npm run ts
```

## Common tsgo Gotchas

- **Number → string**: `tsgo` rejects passing `number` where `string | null | undefined` is expected. Always wrap with `String(value)`.
- **ES2020 target**: `String.prototype.replaceAll` is not available. Use `(str as any).replaceAll(...)` or a `.split().join()` pattern.
- After running `npm run fmt` or `npm run lint:fix`, re-stage changed files before committing.
