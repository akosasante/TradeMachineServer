# ADR 0001: Staff trade search — structured Postgres filters

**Date:** 2026-04-13
**Status:** Accepted
**Deciders:** Akosua Asante

## Context

The admin/commissioner trade history page needs multi-axis search so staff can find trades by date range, player involvement, draft pick involvement, and status. The page already has server-side pagination and status filtering via the `trades.listStaff` tRPC procedure backed by Prisma.

The trade data model is **fully normalized**: `trade` → `trade_item` (polymorphic player or pick) → `player` / `draft_pick`, and `trade` → `trade_participant` → `team`. Player and team names are stored in their own tables and referenced by UUID.

We evaluated several approaches:

| Approach | Operational cost | Fuzzy / substring | Fit for normalized schema |
|---|---|---|---|
| Structured Prisma `where` + joins | None (existing stack) | No | Excellent |
| `ILIKE` on player/team names | Low (no extension) | Partial (substring) | Moderate (leading wildcards bypass B-tree) |
| PostgreSQL `tsvector` / `tsquery` | Medium (migration, raw SQL, index maintenance) | Stemming/prefix | Good for denormalized docs, awkward for proper nouns |
| `pg_trgm` trigram extension | Medium (CREATE EXTENSION, GIN index) | Fuzzy + substring | Good for names |
| Elasticsearch / OpenSearch / Meilisearch | High (new infra, sync pipeline, hosting) | Full relevance | Overkill for staff-only traffic |

## Decision

Use **structured relational filters in Postgres** via Prisma's `where` clause composition:

- **Status:** existing `{ in: [...] }` filter (unchanged).
- **Date range:** `dateFrom` / `dateTo` on a configurable column (`dateCreated`, `submittedAt`, `acceptedOnDate`, or `declinedAt`).
- **Player:** `playerId` UUID matched against `tradeItems.some { tradeItemType: PLAYER, tradeItemId }`.
- **Draft pick:** composite `{ pickType, season, round, originalOwnerId }` resolved to a `draft_pick.id` via `findFirst`, then matched against `tradeItems.some { tradeItemType: PICK, tradeItemId }`. When no matching pick exists, the search returns an empty result set rather than an error.

Player discovery uses the existing `admin.players.search` tRPC procedure (case-insensitive `contains` via Prisma) for an autocomplete dropdown. The user selects a player, and the UUID is sent as `playerId` to `listStaff`. No free-text name search is performed against the trade list itself.

## Rationale

- **Zero operational cost.** No new infrastructure, extensions, or index types. The existing Prisma client, Postgres instance, and tRPC transport handle everything.
- **Fits the normalized schema.** The filter axes map directly to existing FK relationships and indexed columns. Prisma's `some` relation filter compiles to efficient `EXISTS` subqueries.
- **Staff-only traffic.** The admin trade history page serves a handful of commissioners and admins, not a general user population. Query complexity and latency requirements are modest.
- **Incremental delivery.** Each filter axis (status, date, player, pick) is independently useful and testable. No big-bang migration or data pipeline required.

## Consequences

- **Possible slow queries on unindexed filter combinations.** If `EXPLAIN` reveals sequential scans on hot queries (e.g. filtering by `acceptedOnDate` range across many trades), we should add targeted composite indexes. The existing indexes cover `status + dateCreated`, `tradeItemType`, and `senderId + recipientId`.
- **No fuzzy or substring search on the trade list itself.** Admins must use the autocomplete to find a player by name, then filter. They cannot type "Tr" into a search box and see all trades involving players whose names start with "Tr." This is an acceptable tradeoff for v1.
- **Monitoring.** We should track query duration for `trades.listStaff` via existing OpenTelemetry spans (`trpc.trades.listStaff`) and revisit if P95 latency degrades after the new filters ship.

## Caching

- **Client LRU + TTL cache** (in-memory, ~30 entries, ~45 s TTL) keyed by serialized `listStaff` input. The goal is deduping rapid repeat requests during debounced filter changes and smooth back/forward navigation — not a durable cache.
- **Why not server-side or HTTP cache first:** the V3 client uses a vanilla `createTRPCProxyClient` (no TanStack Query). Authenticated batched POST requests do not lend themselves to simple `Cache-Control` without careful key design and invalidation. A Redis/memory cache on the server could help multi-admin scenarios but adds staleness and invalidation work for volatile trade lists. Deferred until metrics justify it.
- **Why not "DB caching":** PostgreSQL's shared buffer pool already caches hot data pages automatically. This feature does not require materialized views or a separate cache layer for v1.
- **Prisma vs TypeORM:** Prisma Client does not offer a built-in query result cache analogous to TypeORM's optional result cache (which supported Redis or in-memory). Prisma sends queries to the database on every call unless the application wraps calls explicitly or uses Prisma Accelerate (a separate hosted product). This ADR documents the decision so future readers do not assume an ORM toggle exists.

## Future work

- **Fuzzy / full-text player name search** directly in the trade list (without requiring autocomplete selection first). This could use `pg_trgm` with a GIN index on `player.name` joined through `trade_item`, or a lightweight `tsvector` index over a denormalized per-trade text blob. Revisit if admins report friction with the autocomplete-first flow.
- **Server-side caching** (Redis or in-memory with short TTL) if metrics show repeated identical queries or high DB load from staff searches.
- **Team name filter** as a direct input (not just as part of pick filter). Currently team filtering is implicit via the pick's `originalOwnerId` or by inspecting `tradeParticipants` — a dedicated "team involved" filter could be added.
