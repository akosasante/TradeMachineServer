# @trademachine/trpc-types

Shared TypeScript types for TradeMachine tRPC API. This package automatically generates and exports tRPC router types from the server, ensuring full type safety in the client without manual type maintenance.

## Installation

```bash
npm install @trademachine/trpc-types
```

## Usage

```typescript
import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';
import type { AppRouter, RouterInputs, RouterOutputs } from '@trademachine/trpc-types';

const trpc = createTRPCProxyClient<AppRouter>({
  links: [
    httpBatchLink({
      url: '/trpc',
      credentials: 'include',
    }),
  ],
});

// Now you have full type safety!
const user = await trpc.auth.login.authenticate.mutate({
  email: 'user@example.com',
  password: 'password'
});

// Access input/output types using tRPC utilities
type LoginInput = RouterInputs['auth']['login']['authenticate'];
type LoginOutput = RouterOutputs['auth']['login']['authenticate'];
```

## Available Types

- `AppRouter` - The main tRPC router type (automatically generated from server)
- `PublicUser` - User type without password field
- `RouterInputs` - Inferred input types for all router procedures
- `RouterOutputs` - Inferred output types for all router procedures

## How It Works

This package uses a hybrid approach to generate and bundle types:

1. **Server Declaration Generation**: TypeScript generates `.d.ts` declaration files for the server's tRPC router using `tsconfig.declarations.json`
2. **Type Bundling**: Server type declarations are copied into `dist/server/` directory
3. **Type Re-export**: The package imports and re-exports these bundled types using relative paths
4. **Path Resolution**: A post-build script converts path aliases to relative paths for external consumption
5. **Type Inference**: Uses tRPC's `inferRouterInputs` and `inferRouterOutputs` for convenient type access

This approach:
- ✅ Avoids circular dependencies
- ✅ Self-contained package (all types bundled)
- ✅ Ensures types always match the server implementation
- ✅ No manual type maintenance required
- ✅ Provides full IntelliSense support
- ✅ Works when installed in external projects

### Package Structure

When installed, the package includes:
```
node_modules/@akosasante/trpc-types/
├── dist/
│   ├── index.d.ts              # Main type exports
│   ├── index.js
│   └── server/                  # Bundled server type declarations
│       ├── api/
│       │   └── routes/v2/router.d.ts
│       ├── DAO/v2/UserDAO.d.ts
│       └── ... (all dependencies)
```

All imports use relative paths, making the package fully self-contained.

## Building

The build process has two steps:

```bash
# Build server type declarations and package types
npm run build

# Or build steps individually:
npm run build:server-types  # Generate server declarations
npm run build:package       # Build the types package
```

**Note**: The server type declarations must be generated before building the package.

## Adding New Routes

When you add new tRPC routes to the server:

1. Add your route to the appropriate router file (e.g., `src/api/routes/v2/routers/auth.ts`)
2. Rebuild this package: `npm run build`
3. The new route types will automatically be available in the client

No manual type updates needed!

## Publishing

```bash
# Patch version (bug fixes)
npm run version:patch && npm run publish:manual

# Minor version (new features)
npm run version:minor && npm run publish:manual

# Major version (breaking changes)
npm run version:major && npm run publish:manual
```