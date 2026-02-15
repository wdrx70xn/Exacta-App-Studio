---
description: Codebase context and conventions for AI agents working in this repo
---

# Exacta-App-Studio (Dyad) — Agent Context

## Architecture Overview

This is an **Electron desktop application** — a local, open-source AI app builder (like Lovable/v0/Bolt, but running locally).

| Layer                      | Technology                                          | Key Entry Points                                    |
| -------------------------- | --------------------------------------------------- | --------------------------------------------------- |
| **Main process** (Node.js) | Electron, IPC handlers, SQLite                      | `src/main.ts`, `src/ipc/`                           |
| **Renderer** (browser)     | React 19, TanStack Router/Query, Jotai, Tailwind v4 | `src/renderer.tsx`, `src/pages/`, `src/components/` |
| **Preload** (bridge)       | Electron contextBridge                              | `src/preload.ts`                                    |
| **Workers**                | TypeScript checker worker                           | `workers/tsc/`                                      |
| **Database**               | SQLite + Drizzle ORM                                | `src/db/schema.ts`, `drizzle/`                      |
| **AI Integration**         | Vercel AI SDK (multi-provider)                      | `src/ipc/utils/`, `src/prompts/`                    |
| **Guardian** (Windows)     | .NET 8 service                                      | `native/Dyad.Guardian/`                             |

## Critical Patterns

### IPC Architecture (Contract-Driven)

- **Contracts** in `src/ipc/types/*.ts` — single source of truth (Zod schemas)
- **Three patterns**: invoke/response, events (pub/sub), streams (chunked)
- **Preload allowlist auto-derived** — never manually register channels
- **Handlers throw on failure** — don't return `{ success: false }`
- See `rules/electron-ipc.md` for full details

### React Query Integration

- **All query keys** defined in `src/lib/queryKeys.ts` (centralized factory)
- **Reads** → `useQuery` with domain client + `queryKeys`
- **Writes** → `useMutation` with invalidation on success
- **Jotai sync** → via `useEffect` only when required

### AI Response Processing

- LLM responses use custom `<dyad-*>` XML tags (not formal tool calls in standard mode)
- `src/components/chat/DyadMarkdownParser.tsx` — renders dyad tags in the UI
- `src/ipc/processors/response_processor.ts` — executes dyad tags (write files, add packages, etc.)
- Local agent mode (Pro) uses formal tool calling — see `src/pro/main/ipc/handlers/local_agent/`

### Component Patterns

- **Base UI (not Radix/shadcn)** — Accordion, Tooltip, etc. have different APIs
- **TooltipTrigger**: Use `render` prop for button-like children to avoid nested `<button>`
- **Custom `<dyad-status>` tag**: `state="finished" | "in-progress" | "aborted"`

### TypeScript

- **tsgo** (strict mode) runs on pre-commit — stricter than standard `tsc`
- **ES2020 target**: No `replaceAll` on string type — use `as any` cast
- **Number→string**: Always use `String(value)` conversion

## Directory Map

```
src/
├── main.ts              # Electron main process entry
├── preload.ts           # Preload script (contextBridge)
├── renderer.tsx         # React app entry
├── router.ts            # TanStack Router config
├── components/          # React components (79 top-level + 5 subdirs)
│   ├── chat/            # Chat UI components (66 files)
│   ├── preview_panel/   # App preview panel (26 files)
│   ├── settings/        # Settings components (8 files)
│   └── ui/              # Base UI primitives (31 files)
├── hooks/               # React hooks (63 files)
├── ipc/                 # IPC layer
│   ├── types/           # Contracts + clients (30 files)
│   ├── handlers/        # Main process handlers (51 files)
│   ├── runtime/         # Runtime management (31 files)
│   ├── utils/           # IPC utilities (47 files)
│   └── processors/      # Response processors (5 files)
├── pages/               # Page components (7 pages)
├── prompts/             # System prompts for AI (13 files)
├── pro/                 # Pro features (FSL licensed)
│   └── main/ipc/handlers/local_agent/  # Agent v2 tools
├── db/                  # Drizzle schema + connection
├── atoms/               # Jotai atoms (8 files)
├── lib/                 # Shared utilities (10 files)
├── i18n/                # Internationalization (18 files)
└── routes/              # TanStack route definitions (10 files)

rules/                   # Development rules (9 files)
docs/                    # Architecture docs (7 files)
scaffold/                # New app scaffold template
templates/               # App templates
e2e-tests/               # Playwright E2E tests
worker/                  # Injected client scripts (shim, proxy, etc.)
native/                  # .NET Guardian service (Windows)
```

## Pre-Commit Checklist

Always run before committing:

1. `npm run fmt` — format (oxfmt)
2. `npm run lint` — lint (oxlint)
3. `npm run ts` — typecheck (tsgo, stricter than tsc)

## Rules Reference

Read the relevant `rules/*.md` file when working in these areas:

| Area                | Rule File                          |
| ------------------- | ---------------------------------- |
| IPC endpoints       | `rules/electron-ipc.md`            |
| E2E tests           | `rules/e2e-testing.md`             |
| Git/PRs             | `rules/git-workflow.md`            |
| Base UI components  | `rules/base-ui-components.md`      |
| Database/migrations | `rules/database-drizzle.md`        |
| TypeScript errors   | `rules/typescript-strict-mode.md`  |
| OpenAI reasoning    | `rules/openai-reasoning-models.md` |
| Settings page       | `rules/adding-settings.md`         |
| Chat indicators     | `rules/chat-message-indicators.md` |
