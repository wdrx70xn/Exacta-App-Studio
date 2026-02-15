---
description: Add a new IPC endpoint (contract, handler, client, React hook)
---

# Add a New IPC Endpoint

This project uses a **contract-driven IPC architecture**. Contracts are the single source of truth for channel names, input/output schemas (Zod), and auto-generated clients.

## Three IPC Patterns

1. **Invoke/response** (`defineContract` + `createClient`) — Standard request-response
2. **Events** (`defineEvent` + `createEventClient`) — Main→renderer pub/sub push
3. **Streams** (`defineStream` + `createStreamClient`) — Chunked streaming data

## Steps

### 1. Define Contract

Add contracts in the relevant `src/ipc/types/<domain>.ts` file:

```ts
import { defineContract } from "../contracts/core";
import { z } from "zod";

const contracts = {
  myEndpoint: defineContract({
    channel: "my-domain:my-endpoint",
    input: z.object({ appId: z.string() }),
    output: z.object({ data: z.string() }),
  }),
};
```

### 2. Export Client

In the same `src/ipc/types/<domain>.ts` file:

```ts
export const myDomainClient = createClient(contracts);
```

### 3. Re-export from Index

In `src/ipc/types/index.ts`, re-export the contract, client, and types.

### 4. Register Handler

Create or update `src/ipc/handlers/<domain>_handlers.ts`:

```ts
import { createTypedHandler } from "./base";

export function registerMyDomainHandlers() {
  createTypedHandler(contracts.myEndpoint, async (input) => {
    // Handler logic — throw Error on failure, don't return { success: false }
    return { data: "result" };
  });
}
```

### 5. Register in IPC Host

Import and call the registration function in `src/ipc/ipc_host.ts`:

```ts
import { registerMyDomainHandlers } from "./handlers/my_domain_handlers";
registerMyDomainHandlers();
```

### 6. Add React Query Key

In `src/lib/queryKeys.ts`, add entries to the appropriate domain:

```ts
myDomain: {
  all: ["myDomain"] as const,
  detail: (params: { appId: string }) => ["myDomain", "detail", params] as const,
},
```

### 7. Create React Hook

In `src/hooks/useMyData.ts`:

```ts
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { myDomainClient } from "@/ipc/types";

export function useMyData(appId: string) {
  return useQuery({
    queryKey: queryKeys.myDomain.detail({ appId }),
    queryFn: () => myDomainClient.myEndpoint({ appId }),
  });
}
```

## Key Rules

- **Preload allowlist is auto-derived** — no manual channel registration needed.
- **Handlers should throw** on failure, not return `{ success: false }`.
- **Stream clients**: `.start()` returns `void` — use a `Set` or ref-lock to prevent duplicates.
- **Mutations**: Use `useMutation`, call domain client, invalidate related query keys on success.
- **Sync with Jotai atoms** via `useEffect` only if required.
