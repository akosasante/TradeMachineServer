# Agent Instructions for Claude Code or Other AI Assistants

This file provides guidance to AI Assistants when working with code in this repository.

## Development Environment Setup

### Modern Docker Development (Recommended)
- **Prerequisites**:
  1. Start shared infrastructure: `make docker-infrastructure-up`
  2. Ensure .env file exists in project root
- **Commands**:
  - Full Docker setup: `make docker-full-setup`
  - Start dev environment: `make docker-dev-up`
  - View logs: `make docker-dev-logs`
  - Stop environment: `make docker-dev-down`
  - Rebuild environment: `make docker-dev-rebuild`

### Local Development
- Modern dev server (tsx hot reload): `make dev-tsx`
- Traditional dev server: `make dev-server`
- Debug server with tsx: `make debug-tsx`
- Debug server traditional: `make debug-server`

### Build/Test Commands
- Build: `make build`
- Lint: `make lint`
- Format: `make format` (runs Prettier via ESLint)
- Type check: `make typecheck`
- Full check (lint, format, typecheck): `make fullcheck`
- **Set up test database**: `make prisma-migrate-test` (required once before running integration tests, and again after any new Prisma migrations — see "Test Database Setup" below)
- Run single test file: `NODE_ENV=test ORM_CONFIG=local-test npx jest --config ./jest.config.js --detectOpenHandles --bail --forceExit --testPathPattern=<path-to-test-file>`
- Run single test by name: `NODE_ENV=test ORM_CONFIG=local-test npx jest --config ./jest.config.js --detectOpenHandles --bail --forceExit --testNamePattern="<name-or-regex>"` (can also be combined with --testPathPattern)
- Run unit tests: `NODE_ENV=test ORM_CONFIG=local-test npx jest --config ./jest.config.js --detectOpenHandles --bail --forceExit --testNamePattern=unit/`
- Run integration tests: `NODE_ENV=test ORM_CONFIG=local-test npx jest --config ./jest.config.js --detectOpenHandles --runInBand --bail --forceExit --testNamePattern=integration/` (always add `--runInBand` for integration tests to avoid DB conflicts)
- Watch tests: `NODE_ENV=test ORM_CONFIG=local-test npx jest --config ./jest.config.js --detectOpenHandles --bail --forceExit --watch`
- Test coverage: `NODE_ENV=test ORM_CONFIG=local-test npx jest --config ./jest.config.js --detectOpenHandles --bail --forceExit --coverage`
- When writing tests for new code, prefer using Prisma and the DAO v2 pattern. Integration tests should use NO mocks. Unit tests can use mocks as needed. We generally mock one layer down from the code being tested (e.g. mock DAO methods when testing controllers); or only mock the DAO methods that would hit the database.
- Never delete tests unless explicitly asked to. If a test is consistently failing and you're having trouble fixing it, then comment it out (and add an eslint-disable comment) and leave a clear TODO comment explaining why it was disabled and what needs to be done to fix it.

### Test Database Setup
Integration tests run against a separate PostgreSQL schema called `test` so they don't interfere with development data. The test code does **not** create the schema or run migrations — it assumes the schema already exists with the correct table structure.

- **`make prisma-migrate-test`**: Sources `tests/.env` (which sets `DATABASE_URL` with `?schema=test`) and runs `prisma migrate deploy` against the `test` schema. Run this once before running integration tests for the first time, and again whenever new Prisma migrations are added.
- **`make prisma-push-test`**: Same idea but runs `prisma db push --accept-data-loss` instead. More aggressive — useful if the test schema is out of sync or corrupted and you want to force-reset it to match the Prisma schema without applying migrations incrementally.
- At test runtime, `afterEach` hooks call `clearPrismaDb()` (in `tests/integration/helpers.ts`) to truncate all tables between tests. Factories in `tests/factories/` create fresh test data as needed.
- TypeORM connects to the `test` schema via `ORM_CONFIG=local-test` (defined in `ormconfig.js`). Prisma connects via the `DATABASE_URL` in `tests/.env`.

## Modern Development Environment

### Docker Infrastructure
- **Shared Infrastructure**: PostgreSQL (port 5438) and Redis (port 6379) run in shared docker-compose.shared.yml
- **Development Container**: Uses tsx hot reloading for fastest development iteration
- **Production Testing**: Optional production build testing with --profile production
- **Hot Reloading**: Source code volumes with node_modules performance optimizations

### Development Tools
- **tsx**: Modern TypeScript execution with hot reloading (replaces tsc compilation)
- **Docker**: Containerized development environment with shared infrastructure
- **Health Checks**: Built-in container health monitoring
- **Volume Optimization**: Named volumes for node_modules, cached bind mounts for source

### Docker Troubleshooting
When new npm dependencies aren't being picked up in Docker containers:

1. **Check for cached node_modules volume**: `docker volume ls | grep node_modules`
2. **Remove specific node_modules volume** (recommended):
   ```bash
   docker volume rm trademachineserver_node_modules_volume
   ```
3. **Or remove all unused volumes** (more aggressive):
   ```bash
   docker volume prune -f
   ```
4. **Then rebuild**: `make docker-dev-rebuild`

**Root cause**: Docker caches node_modules in named volumes for performance. When package.json changes, the cached volume doesn't automatically update.

## Key Libraries
- **Express**: Web framework for API routes and middleware
- **routing-controllers**: Decorator-based controller framework for Express
- **TypeORM/Prisma**: Dual ORM approach (legacy/new) for PostgreSQL
- **Bull**: Redis-based job queue for emails and scheduled tasks
- **Redis**: Session storage and job queue backend
- **nodemailer**: Email sending with SendInBlue transport
- **@slack/webhook**: Slack notifications for trade events
- **Winston**: Logging throughout the application
- **Rollbar**: Error tracking and monitoring
- **bcryptjs**: Password hashing for authentication

## Distributed Tracing

### Overview
The application implements comprehensive distributed tracing using OpenTelemetry to provide end-to-end observability across the entire stack, from frontend Faro traces → Node.js backend → Elixir Oban jobs.

### Architecture
- **OpenTelemetry SDK**: Full instrumentation with automatic HTTP, Express, and Redis tracing
- **OTLP Export**: Traces exported to Alloy via HTTP/protobuf protocol
- **W3C Trace Context**: Standards-compliant trace propagation across service boundaries
- **Cross-Service Tracing**: Trace context passed to Oban jobs for Elixir continuation

### Key Components

#### Telemetry Initialization (`/src/bootstrap/telemetry.ts`)
- NodeSDK with automatic instrumentations for HTTP, Express, and Redis operations
- Configurable logging levels via `OTEL_LOG_LEVEL` environment variable
- Resource identification with service name and version
- OTLP exporters for traces and metrics

#### Tracing Utilities (`/src/utils/tracing.ts`)
- `createSpanFromRequest()`: Creates spans with W3C trace context extraction
- `finishSpanWithResponse()`: Completes spans with HTTP status and error handling
- `addSpanAttributes()`: Adds custom business logic attributes to active spans
- `addSpanEvent()`: Records events on active spans for detailed observability
- `extractTraceContext()`: Extracts W3C traceparent/tracestate for cross-service propagation

#### Instrumentation Coverage
- **HTTP Requests**: Automatic request/response tracing with route information
- **Express Routes**: Route-level spans with middleware integration
- **Redis Operations**: Bull queue jobs and session storage operations
- **PostgreSQL**: Prisma query operations and connection pooling
- **Custom Business Logic**: Manual spans for critical application workflows
- **Cross-Service**: Trace context propagation to Oban jobs via job arguments

### Implementation Examples

#### Controller Tracing Pattern
```typescript
@Post("/endpoint")
public async myEndpoint(@Req() request: Request, @Res() response: Response): Promise<Response> {
    const { span, context: traceContext } = createSpanFromRequest("operation.name", request);

    return await context.with(traceContext, async () => {
        addSpanAttributes({
            "custom.attribute": "value",
            "business.context": userId
        });

        addSpanEvent("operation.start");

        // Business logic here...

        addSpanEvent("operation.complete");
        finishSpanWithResponse(span, response);
        return response.json(result);
    });
}
```

#### Cross-Service Trace Propagation
```typescript
// Extract trace context for passing to external services
const currentTraceContext = extractTraceContext();
const job = await obanDao.enqueueJob(data, currentTraceContext || undefined);
```

### Environment Configuration
```bash
# Service identification
OTEL_SERVICE_NAME=trademachine-server
OTEL_SERVICE_VERSION=2.0.1

# OTLP export configuration
OTEL_EXPORTER_OTLP_ENDPOINT=http://alloy:4318
OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf
OTEL_EXPORTER_OTLP_TIMEOUT=30000
OTEL_EXPORTER_OTLP_COMPRESSION=gzip

# Trace sampling (1.0 = 100%, 0.1 = 10%)
OTEL_TRACES_SAMPLER=traceidratio
OTEL_TRACES_SAMPLER_ARG=1.0

# Debug logging (INFO for production, DEBUG for troubleshooting)
OTEL_LOG_LEVEL=INFO
```

### Server Environment Variables (TradeMachineServer)

- **ADMIN_OVERRIDE**:
  - When set to `"true"`, allows any authenticated user to bypass trade status validation
    in the legacy REST API and perform arbitrary trade status transitions.
  - Intended only for local recovery or emergency maintenance scenarios.
  - MUST remain unset or `"false"` in staging and production.
  - Documented in `.env.prod.template` and `.env.staging.template` under “Safety / Admin Overrides”.

### Monitoring Integration
- **Grafana**: View traces in the Grafana dashboard via Tempo data source
- **Alloy**: Collects and forwards traces to Tempo for storage and querying
- **Automatic Correlation**: HTTP requests automatically correlated with business logic spans
- **Error Tracking**: Failed spans include exception details and stack traces

### Implementation Notes
- Tracing is initialized early in server startup (before other modules)
- Business logic tracing implemented for authentication endpoints (`/auth/login`, `/auth/login/sendResetEmailOban`)
- Trace context seamlessly propagated from frontend requests to background jobs
- Performance impact minimized with efficient sampling and batched exports
- Debug logging configurable for development vs production environments

## Code Style Guidelines
- **Formatting**: Use double quotes, semicolons, camelCase (variables/methods), PascalCase (types/classes)
- **Types**: Strict typing enabled, avoid using `any` when possible
- **Error Handling**: Use explicit error handling with `@typescript-eslint/no-floating-promises`
- **Imports**: Sort imports, avoid wildcard imports 
- **Naming**: camelCase for variables, PascalCase for types/classes/interfaces
- **Database**: PostgreSQL database with dual ORM approach:
  - **Legacy**: TypeORM in `/src/models/` with Entity decorators extending BaseModel
  - **New Code**: Prisma in `/prisma/schema.prisma` with DAOs in `/src/DAO/v2/`
  - **Prisma Client Extensions**: Uses ExtendedPrismaClient with custom methods like `isAdmin()` for enhanced data objects
  - All new code should use Prisma client and DAO patterns
- **Testing**: Jest for unit/integration tests, keep tests in corresponding folders
- **Documentation**: JSDoc comments for functions and classes

## Adding New tRPC Routers

When adding a new tRPC sub-router (e.g. `notifications`, `settings`, etc.), there are **two** places you must register it:

1. **`src/api/routes/v2/router.ts`** — import and add to the `appRouter` object.
2. **`src/bootstrap/app.ts`** — add the new router's dot-prefix to the path allowlist in the `/v2` Express middleware. This is the conditional `if` block that checks `req.path.includes("routerName.")`. If you skip this step, the new tRPC route will 404 because the request falls through to `routing-controllers` instead of the tRPC middleware.

Forgetting step 2 is a common mistake — the server starts fine and existing routes work, but the new router's endpoints all return 404.

## Code Architecture
- **API Routes**: Use decorator-based routing with `routing-controllers` library
  - Controllers in `/src/api/routes/` with JSON response format
  - Method-level decorators for HTTP verbs (`@Get()`, `@Post()`, etc.)
  - Parameter decorators for request data (`@Body()`, `@Param()`, etc.)

- **Data Access Pattern**:
  - Controllers inject DAOs via constructor for data operations
  - DAOs abstract database operations from controllers
  - Legacy DAOs use TypeORM repositories in `/src/DAO/`
  - New code uses ExtendedPrismaClient in `/src/DAO/v2/` with enhanced capabilities

- **Authentication**: Session-based with Redis storage
  - Protected routes use `@Authorized()` decorator with roles
  - Auth middleware in `/src/api/middlewares/AuthenticationHandler.ts`
  - Password hashing with bcryptjs

- **Project Structure**:
  - `/src/api/`: Controllers, routes, and API middleware
  - `/src/DAO/`: Data access objects (TypeORM and Prisma v2)
  - `/src/models/`: TypeORM entity definitions and business logic
  - `/src/bootstrap/`: Application initialization and configuration
  - `/src/authentication/`: Auth strategies and utilities
  - Service directories for email, Slack, ESPN API, etc.

## Redis Usage
- **Session Management**:
  - Redis stores user sessions via `connect-redis` and `express-session`
  - 7-day session lifetime with secure, HTTP-only cookies
  - Environment-specific session prefixes

- **Email Queue**:
  - Bull queue library with Redis backend in `/src/email/`
  - Publishers (`publishers.ts`) queue emails, consumers (`consumers.ts`) process them
  - Supports various email types: registration, password reset, trade notifications
  - Exponential backoff for retries (3 attempts, 30-second base delay)

- **Scheduled Jobs**:
  - Recurring jobs using Bull's repeat feature with cron syntax
  - ESPN updates: Daily at 2:22AM ET (`/src/scheduled_jobs/espnScheduledUpdate.ts`)
  - MLB minor league updates: Daily at 3:22AM ET (`/src/scheduled_jobs/mlbMinorsScheduledUpdate.ts`)
  - Job status events (completed, failed, stalled) trigger appropriate logging

- **Slack Notifications**:
  - Similar to email system using Bull/Redis in `/src/slack/`
  - Handles trade announcements to Slack channels

## Publishing `@akosasante/trpc-types`

The shared tRPC types package lives in `packages/trpc-types/`. Follow this workflow
whenever a new tRPC procedure is added and the package needs to be republished.

### 1. Check the current published version first

```bash
npm view @akosasante/trpc-types version
# to see all published versions:
npm view @akosasante/trpc-types versions --json
```

The `package.json` in the repo may lag behind what is on the registry (e.g. the repo
says `1.8.0` but `1.9.0` is already published). Always check before bumping.

### 2. Bump via `npm version` — NEVER edit package.json directly

```bash
cd packages/trpc-types

# If you know the exact target version:
npm version <new-version> --no-git-tag-version

# Or relative bump:
npm run version:patch   # bug fixes / internal changes
npm run version:minor   # new tRPC procedures
npm run version:major   # breaking type changes
```

> ⚠️ Never use a text editor, `node -e`, or `sed` to change the version field.
> `npm version` updates **both** `package.json` and `package-lock.json` atomically.
> A direct file edit leaves `package-lock.json` stale, creating a visible mismatch
> between the two files (and confusing future readers).

### 3. Build and publish

```bash
npm run publish:manual   # runs: clean → build → npm publish
```

### 4. Update the changelog in the README

After publishing, **always** add an entry to the `## Changelog` section in
`packages/trpc-types/README.md`. This is rendered on the GitHub Packages version
page and is the only place version history is documented. Include a brief list of
what procedures or types were added/changed.

### 5. Commit everything to `main`

Commit all three files so the repo reflects the published state:

```bash
git add packages/trpc-types/package.json packages/trpc-types/package-lock.json packages/trpc-types/README.md
git commit -m "chore(trpc-types): publish @akosasante/trpc-types@<version>"
```

## Git Worktree Setup

When creating git worktrees for this repository — whether native `git worktree add` in the parent folder or Cursor-managed worktrees — the following steps are **required** before the worktree is usable:

1. **Copy `.env`** from the main repo root into the worktree root.
2. **Copy `tests/.env`** from the main repo's `tests/` directory into the worktree's `tests/` directory.
3. **Run `npm install`** inside the worktree so it gets its own `node_modules`.
4. **Update `BASE_DIR`** in the worktree's `.env` to point to the worktree's absolute path (not the main repo). The `ormconfig.js` uses `$BASE_DIR` to resolve TypeORM entity/migration/subscriber globs; if it still points to the main repo, the dev server will crash with a TypeORM decorator error (`Cannot read properties of undefined (reading 'constructor')`) due to cross-repo module resolution.

Example (adjust the worktree path accordingly):
```bash
# After creating the worktree:
cp /path/to/main/TradeMachineServer/.env        /path/to/worktree/.env
cp /path/to/main/TradeMachineServer/tests/.env   /path/to/worktree/tests/.env
cd /path/to/worktree && npm install
# Then edit .env and set BASE_DIR to the worktree's absolute path
sed -i '' "s|^BASE_DIR=.*|BASE_DIR=$(pwd)|" .env
```

## Context Preservation
- Save context to `.last_session_data.json` in project root when requested
- Automatically save context after every 3 user messages
- Always save before completing complex tasks
- Announce when automatic saves occur