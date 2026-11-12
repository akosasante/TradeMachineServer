# ADR 0005: Pagination conventions for tRPC list and search endpoints

**Date:** 2026-11-11
**Status:** Accepted
**Deciders:** Akosua Asante

## Context

TradeMachineServer tRPC endpoints already use more than one pagination vocabulary:

- `trades.list` and `trades.listStaff` accept zero-based `page` and `pageSize`, and return those values with a total count. This supports numbered table navigation.
- `admin.players.search` accepts `skip` and `take` and returns a total. This is a DAO-style offset query, also suitable for a search result picker that loads more results.

The V3 trade builder needs paginated player and pick search for an asset picker. Other future endpoints may need numbered pages, incremental loading, or stable continuation through large, changing datasets. Forcing all endpoints into one shape would make some consumers less clear and would not solve offset drift in mutable datasets.

## Decision

Choose pagination based on consumer interaction and data characteristics. This ADR guides new endpoints; it does not require existing endpoints to change.

### Numbered pages: `page` / `pageSize`

Use for interfaces that expose numbered pages, allow direct page navigation, or need a clear “page N of M” model, especially data tables. Define `page` as zero-based and `pageSize` as a positive bounded count. When the interface needs page navigation, return `page`, `pageSize`, and `total`.

### Offset windows: `skip` / `take`

Use for DAO-style lookup and incremental “load more” / infinite-scroll consumers that do not navigate directly to an arbitrary page. `skip` is a nonnegative row offset; `take` is a positive, explicitly bounded number of rows. Return `total` only when the consumer needs an end indicator or total count. Do not use `offset` as an alternate input name for `skip`.

Offset pagination can skip or repeat rows when the underlying result set changes between requests. New queries must therefore have deterministic ordering, with a unique tie-breaker after user-facing sort keys.

### Cursor continuation

Consider cursor pagination when a result set is large or changes frequently and stable continuation matters more than jumping to arbitrary pages. It avoids many offset-drift problems but requires a stable indexed sort key, opaque continuation state, more involved query logic, and a UI that can consume a cursor rather than jump to page N. Do not add cursor pagination by default or solely as a speculative optimization.

### Shared requirements

- Every paginated input must have a nonnegative starting position and a positive, bounded page/window size.
- Set explicit defaults and maximums in each Zod schema; choose limits based on query cost and consumer needs.
- Define deterministic sort order, including a unique tie-breaker, for every paginated result.
- Include total/result metadata only when the consumer needs it; avoid an expensive count query solely to satisfy convention.
- Keep terminology and response metadata consistent within a given endpoint. Do not combine page and offset terms for the same pagination model.
- Revisit the strategy when dataset growth, query plans, sort stability, or UI navigation requirements materially change.

## Existing patterns and application to the builder

The current trade-list procedures use `page`/`pageSize`, with a default page size of 20 and a maximum of 50. The admin player search uses `skip`/`take`, with a maximum `take` of 200. These existing shapes remain unchanged.

The first-pass builder's player and pick asset picker uses incremental loading rather than numbered pages. Its new search procedures will use `skip`/`take`, explicit bounded defaults, deterministic ordering, and a total count if the UI needs to determine whether more results remain. Team selection is expected to be a small searchable list; use offset pagination only if its size warrants paging. If asset-search volume or mutation-related offset drift becomes material, evaluate cursor pagination based on actual query plans and UX.

## Rationale

- Naming reflects the consumer: page numbers for direct navigation, row offsets for incremental windows, cursors for continuation.
- Separate conventions make client intent clearer while preserving the database query's ability to reuse a shared DAO implementation.
- Explicit bounds and stable ordering protect query cost and prevent inconsistent paging.
- Cursor complexity is justified by measured scale or volatility, not by uniformity alone.

## Consequences

- New endpoint authors have a consistent decision process without a forced migration of `admin.players.search` or trade lists.
- Builder search follows the existing offset-search precedent while adopting explicit limits and stable order.
- Offset pagination remains susceptible to changes between calls; consumers requiring stable continuation must use a cursor strategy.

## Related decisions

- [ADR 0004: V3 trade builder first-pass contract](./0004-v3-trade-builder-first-pass-contract.md)
- [V3 Trade Builder Migration Plan](../proposals-and-projects/v3-trade-builder-plan.md)
