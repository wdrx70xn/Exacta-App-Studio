---
description: Run unit tests with Vitest
---

# Unit Tests

The project uses **Vitest** for unit testing. Use unit tests for pure business logic and utility functions.

// turbo-all

1. Run all unit tests:

```sh
npm test
```

2. To run tests in watch mode during development:

```sh
npm run test:watch
```

3. To run tests with Vitest UI:

```sh
npm run test:ui
```

## Guidelines

- Tests live in `src/__tests__/` or alongside the files they test.
- Prefer E2E tests when a feature would need heavy mocking to unit test.
- Unless a change is trivial, add a test (preferably E2E for UI features).
