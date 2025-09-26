# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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
- Format: `make format`
- Type check: `make typecheck`
- Full check (lint, type check, format): `make fullcheck`
- Run single test file: `make test-file` (prompts for file path)
- Run unit tests: `make test-unit`
- Run integration tests: `make test-integration`
- Watch tests: `make test-watch`

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

## Context Preservation
- Save context to `.last_session_data.json` in project root when requested
- Automatically save context after every 3 user messages
- Always save before completing complex tasks
- Announce when automatic saves occur