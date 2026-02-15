---
description: Add a new local agent tool (tool definition, registration, XML rendering, testing)
---

# Add a New Local Agent Tool

The local agent uses formal model tool calling. Tools are defined as functions with Zod schemas and rendered in the chat UI as custom `<dyad-*>` XML tags.

## Steps

### 1. Create Tool File

Create a new file in `src/pro/main/ipc/handlers/local_agent/tools/`:

```ts
// src/pro/main/ipc/handlers/local_agent/tools/my_tool.ts
import { z } from "zod";
import { tool } from "ai";

export const myTool = tool({
  description: "What this tool does",
  parameters: z.object({
    param1: z.string().describe("Description of param1"),
  }),
  execute: async ({ param1 }) => {
    // Tool implementation
    return { result: "..." };
  },
});
```

Look at existing tools in the same directory for reference patterns.

### 2. Register in Tool Definitions

Import and include the tool in `src/pro/main/ipc/handlers/local_agent/tool_definitions.ts`:

```ts
import { myTool } from "./tools/my_tool";

export const allTools = {
  // ... existing tools
  myTool,
};
```

### 3. Add XML Tag Rendering

Define how to render the custom XML tag (e.g., `<dyad-$my-tool-name>`) in `src/components/chat/DyadMarkdownParser.tsx`. This typically involves creating a new React component.

### 4. Add E2E Test

- Create a test in `e2e-tests/local_agent*.spec.ts`
- Define a tool call fixture at `e2e-tests/fixtures/engine/` to simulate the tool call
- Run with:

```powershell
$env:PLAYWRIGHT_HTML_OPEN="never"; npx playwright test e2e-tests/local_agent_my_tool.spec.ts
```

## Agent Architecture Reference

- **Core agent loop**: `src/pro/main/ipc/handlers/local_agent/local_agent_handler.ts` — keeps calling the LLM until it stops making tool calls or hits the max turn limit.
- **All tool definitions**: `src/pro/main/ipc/handlers/local_agent/tool_definitions.ts`
