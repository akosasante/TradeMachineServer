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

### Step 1 — Determine the next version

Always check what is already published before bumping, since the version in `package.json`
in the repo may lag behind what is on the registry:

```bash
npm view @akosasante/trpc-types version
# or to see all published versions:
npm view @akosasante/trpc-types versions --json
```

### Step 2 — Bump the version

**Always use `npm version` (never edit `package.json` directly).** This keeps
`package.json` and `package-lock.json` in sync automatically.

```bash
# Specific version (safest — use when you know the exact target)
npm version <new-version> --no-git-tag-version   # e.g. npm version 1.10.0 --no-git-tag-version

# Or use the shorthand scripts:
npm run version:patch   # x.y.Z  — bug fixes / internal changes
npm run version:minor   # x.Y.0  — new tRPC procedures added
npm run version:major   # X.0.0  — breaking type changes
```

> ⚠️ **Never** edit `package.json`'s `version` field with a text editor or `node -e`.
> Doing so leaves `package-lock.json` stale (it retains the old version), causing a
> visible discrepancy. If this happens by accident, re-run
> `npm version <correct-version> --no-git-tag-version` to resync both files.

### Step 3 — Build and publish

```bash
npm run publish:manual
```

This runs `clean → build → npm publish` in one step. The build includes compiling
server type declarations, copying them into `dist/server/`, and fixing path aliases.

### Step 4 — Update the changelog below

After publishing, add an entry to the Changelog section at the bottom of this README.
This is rendered on the [GitHub Packages version page](https://github.com/akosasante/TradeMachineServer/pkgs/npm/trpc-types/versions)
under "About this version", so it serves as the only version-level documentation.

### Step 5 — Commit the version bump and changelog

Commit `package.json`, `package-lock.json`, and this `README.md` to `main` so the
repo reflects the published state.

## Changelog

### 1.16.1

- `trades.listStaff`: rename `playerId` to `playerIds` (array, max 10) for multi-player AND filtering
- `trades.listStaff`: make `pick` sub-fields (`pickType`, `season`, `round`, `originalOwnerId`) individually optional; at least one required (partial pick filter)

### 1.16.0

- Extend `trades.listStaff` input with structured search filters: `dateFrom`, `dateTo`, `dateField`, `playerId`, and `pick` (composite draft pick filter)
- Used by V3 admin trade history page for server-side search/filtering

### 1.15.0

- Add `notifications` router with `get` query and `update` mutation procedure types
- Used by the V3 client notification settings page to read/write user notification preferences

### 1.14.1

- Refactor: admin router DAOs constructed inline (simpler Context interface)

### 1.14.0

- Add `admin` router with full CRUD procedure types for users, teams, players, and draft picks
- Add `admin.sync` sub-router types for enqueuing Oban sync jobs and polling status
- Add `admin.email` sub-router types for sending registration and password-reset emails
- Rebased on main: includes `listStaff`, `userSettings` JSONB, and all prior types

### 1.11.0

- Add `trades.listStaff` procedure types (paginated list of all trades, admin/commissioner only)
- Includes all types from 1.10.3

### 1.10.3

- Add `trades.list` procedure types (team-scoped paginated trade list)
- Add `email.sendMagicLink`, `email.sendViewToken` procedure types

### 1.10.2

- Add magic-link token flow types for trade review

### 1.10.1

- Bump after trade review page server changes (get/accept/decline/submit)

### 1.10.0

- Add `trades` router types: `get`, `accept`, `decline`, `submit` procedures

### 1.9.0

- Add `auth.logoutAllSessions` procedure type

### 1.8.0

- Refactor auth trpc route types after tracing extraction

### 1.7.0

- Full auth controller tRPC conversion types

### 1.5.0

- Package build and publish fixes, path resolution improvements

### 1.0.1 – 1.4.0

- Initial package setup, GitHub Package Registry configuration, scope changes