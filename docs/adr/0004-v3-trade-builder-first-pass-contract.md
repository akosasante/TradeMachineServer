# ADR 0004: V3 trade builder first-pass contract

**Date:** 2026-11-11
**Status:** Accepted
**Deciders:** Akosua Asante

## Context

The V3 trade builder proposal replaces the legacy Vue 2 `/make_trade` stepper with an authenticated V3 flow backed by tRPC and Prisma v2. The broader design includes saved drafts, but the initial first pass intentionally limits scope to building a client-side proposal and sending it. The canonical trade model remains `TradeParticipant` plus directed `TradeItem` rows.

The legacy page fixes the creator to the authenticated user's current team and lets the user choose recipient teams. Assets are assigned a sender and recipient, and the final screen submits the trade. In the legacy client, creation of a `REQUESTED` trade and notification enqueueing are separate API calls. The request endpoint notifies recipient-team owners by email when an email address exists and email is not disabled; it enqueues Discord DMs when the owner's Discord preference is enabled. There is no Slack request notification in that endpoint. Notification work is asynchronous.

The legacy `/make_trade` route has no admin-only route guard. Its admin-only UI control switches among UI variants. The shared legacy trade-create endpoint allows authenticated non-admins to create `DRAFT` or `REQUESTED` records and permits admins to create other initial statuses, but that endpoint does not itself ensure that the selected creator team belongs to the caller. The current tRPC admin router exposes player/team/pick administration and the staff trade list, but no separate admin trade-create procedure. The `pullOldTrades` script is a historical import tool, not an interactive trade builder. The V3 builder will not preserve this weak legacy create authorization: its implementation must require the caller to own the creator team, with any admin impersonation explicitly authorized and auditable rather than implied by an admin bypass.

ADR 0003 records a broader draft-based implementation: create/edit a `DRAFT`, then transition it to `REQUESTED` with `requestTrade`. That remains a valid plan for a later V3 increment with saved drafts. It does not dictate the first-pass flow, which has no server-side draft.

## Decision

### First-pass scope and proposal model

- Saved drafts remain planned for V3, but are excluded from this initial first pass. Unsent proposals live in client state and are not persisted; the legacy draft lifecycle is unchanged.
- Represent a proposal as participants and directed asset transfers (`senderTeamId` → `recipientTeamId`), not UI-specific give/get buckets. This maps directly to `TradeParticipant` and `TradeItem(senderId, recipientId)` and supports transfers between any participating teams, including a recipient sending to another recipient.
- Require the authenticated caller to own the creator team. Admin creation/impersonation is not an implicit exception to this rule and must be designed explicitly if later needed.

### Builder API boundary

- Mount builder procedures under `trades.builder.*`, inside the existing trade router.
- Define search procedures for teams, players, and picks. Preferred recorded ownership affects ranking/grouping only; it does not filter other matches from a typed search.
- Do not add a separate `validate` endpoint in the first pass. The current structural checks (minimum teams/assets, no self-transfer, and no duplicate asset) are client-computable, and ownership warnings derive from the search result's recorded-owner data. `createAndRequest` must still run authoritative server validation before persistence.
- If future server-only checks need previewing, add a validation procedure at the Review step and share its validator with the send path. Never treat a preview result as a send guarantee; always revalidate in the mutation to avoid stale/TOCTOU results.

### Send and notification semantics

- The first-pass send is one `createAndRequest` mutation. It creates the requested trade and schedules the legacy-equivalent recipient notifications. It does not create an intermediate server draft.
- Return the durable `tradeId`; do not return Oban job IDs. Notification fan-out can create multiple email/Discord jobs, and the builder has no delivery-status UI. Job identifiers remain server-side operational details.
- A successful response means the trade reached the requested state and notification work was accepted for enqueueing, not that email or Discord delivery completed.
- Notification enqueue failure after trade persistence is an ambiguous outcome that must be surfaced, logged, and recoverable; implementation must avoid reporting a successful send when notification scheduling failed.
- Do not add idempotency storage or an automatic retry token in this first pass. If the client loses the response, it must not blindly resubmit; provide a recovery path that checks the user's trades / reconciles the outcome before allowing a retry. Revisit idempotency if this limitation proves operationally unsafe.
- Preserve recipient-owner notification preference behavior: email when an address is present and email is enabled; Discord DM when enabled and a Discord destination is configured. Do not add Slack notifications in this builder pass.

## Rationale

- **Stage delivery without abandoning drafts.** A client-only proposal avoids draft CRUD, cleanup, and concurrent-edit concerns in the first release while keeping server-side drafts planned for a later V3 increment.
- **Keep the wire model canonical.** Directed asset transfers preserve multi-team behavior and map cleanly to the existing relational model, while supporting different frontend layouts.
- **Nest the API with trade operations.** `trades.builder.*` makes the relationship and authorization boundary discoverable and keeps the new procedures beside existing trade reads/actions. A top-level router would provide stronger module isolation but split one cohesive trade API.
- **Avoid redundant validation traffic.** The current builder's client-visible checks need no extra server round trip during editing. Authoritative validation remains part of send. Add a preview endpoint only when it can provide meaningful server-only feedback before confirmation.
- **Combine create and request for a no-draft workflow.** One mutation removes an intermediate persisted state and a client round trip compared with ADR 0003's draft-then-request path. The cost is no save/resume and an ambiguous response-loss retry case; the first pass requires explicit recovery UX and does not automatically retry sends.
- **Keep asynchronous job plumbing internal.** A trade ID is the useful durable result. Returning an arbitrary job ID would not represent delivery of multiple independently processed notification jobs.
- **Preserve established notifications without inventing parity.** Email and Discord preferences already define request behavior; no Slack notification is sent by the legacy request endpoint.

## Consequences

- ADR 0003's draft CRUD remains applicable to a later saved-drafts increment; this ADR only selects the initial first-pass flow and does not remove legacy draft behavior.
- `createAndRequest` is the authoritative validation and persistence boundary. Its transaction and notification enqueue semantics must prevent partial or success-shaped failures.
- A response lost after successful creation can leave the client unsure whether the trade exists. The client must reconcile before retrying; durable idempotency is deferred.
- Ownership mismatch warnings and asset ranking do not establish legal ownership. The commissioner workflow remains responsible for review of stale recorded ownership.
- The search and send procedures must not be exposed through admin-only search endpoints to ordinary owners.

## Related decisions

- [ADR 0003: Trade Request builder — v2 DAO scope](./0003-trade-builder-v2-daos.md)
- [ADR 0005: Pagination conventions for tRPC list and search endpoints](./0005-trpc-pagination-conventions.md)
- [Trade Request Builder API proposal](../proposals-and-projects/trade-builder-api-proposal.md)
- [V3 Trade Builder Migration Plan](../proposals-and-projects/v3-trade-builder-plan.md)
