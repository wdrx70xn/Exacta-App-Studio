---
description: Start local development — install deps and run the Electron app
---

# Start Local Development

// turbo-all

1. Install dependencies:

```sh
npm install
```

2. Create the `userData` directory if it doesn't exist (required for SQLite database):

```powershell
if (-not (Test-Path userData)) { mkdir userData }
```

3. Initialize pre-commit hooks (run once after fresh clone):

```sh
npm run init-precommit
```

4. Start the Electron app in development mode:

```sh
npm start
```

> **Note:** If you need to use a custom Dyad Engine URL, use `npm run dev:engine` instead.

## Environment Setup

Copy `.env.example` to `.env` and fill in your API keys:

- `OPENAI_API_KEY` — for OpenAI models
- `ANTHROPIC_API_KEY` — for Anthropic models
- `GOOGLE_API_KEY` — for Google models
- `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` — for GitHub integration
