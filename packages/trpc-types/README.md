# @trademachine/trpc-types

Shared TypeScript types for TradeMachine tRPC API. This package exports the tRPC router types so the client can have full type safety.

## Installation

```bash
npm install @trademachine/trpc-types
```

## Usage

```typescript
import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';
import type { AppRouter } from '@trademachine/trpc-types';

const trpc = createTRPCProxyClient<AppRouter>({
  links: [
    httpBatchLink({
      url: '/trpc',
      credentials: 'include',
    }),
  ],
});

// Now you have full type safety!
const user = await trpc.auth.login.mutate({
  email: 'user@example.com',
  password: 'password'
});
```

## Available Types

- `AppRouter` - The main tRPC router type
- `PublicUser` - User type without password field
- More types will be added as needed

## Building

```bash
npm run build
```

## Publishing

```bash
npm publish
```