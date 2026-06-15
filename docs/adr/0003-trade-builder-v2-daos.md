# ADR 0003: Trade Request builder — v2 DAO scope (first pass)

**Date:** 2026-06-15
**Status:** Accepted
**Deciders:** Akosua Asante

## Context

The frontend team is building the new "Trade Request" builder UI on the tRPC v2 stack. They produced several overlapping API wishlists; these were analyzed against the current schema and existing v2 DAOs in [`docs/proposals-and-projects/trade-builder-api-proposal.md`](../proposals-and-projects/trade-builder-api-proposal.md).

Key findings from that analysis:

- The canonical model the frontend wants already exists. Trades are `TradeParticipant` (CREATOR/RECIPIENT) + `TradeItem` line items carrying `senderId`/`recipientId` (fromTeam/toTeam) — not give/get buckets. A "line" maps to an existing `TradeItem` row; `lineId` is its existing `TradeItem.id` UUID (no new field).
- "Draft" is just `Trade.status = DRAFT`. No separate table; the status enum (`DRAFT → REQUESTED → PENDING → ACCEPTED/REJECTED → SUBMITTED`) covers the lifecycle.
- The current v2 `TradeDAO` is **read + accept/decline/submit only**. It has no create, no edit, and no line mutations. That is the main gap.
- Several frontend asks require schema migrations or non-trivial product decisions (roster caps, pick encumbrance, position filtering, commissioner-editable pick-trade date, optimistic concurrency, draft titles).

We operate **single tenant / single league**. There is no `League` model and we are not adding one; no `leagueId` scoping is built into the DAOs.

## Decision

For the June 15, 2026 work we implement **only the unambiguous, zero-migration v2 DAO additions** needed to unblock the builder. Everything requiring a migration or an unresolved product decision is **deferred** (see below). No code is written as part of this ADR — it records the agreed scope.

### In scope (no schema migration)

**`TradeDAO` — builder writes** (each returns the fully hydrated trade via the existing `getTradeById` path):

- `createDraft({ creatorTeamId, participantTeamIds })` — insert `Trade(status=DRAFT)` + participants.
- `updateDraftParticipants(tradeId, participantTeamIds)` — reconcile the participant set.
- `addTradeItem(tradeId, { tradeItemType, tradeItemId, senderId, recipientId })` — one line; relies on the existing `@@unique` constraint to dedupe.
- `updateTradeItem(lineId, { senderId?, recipientId? })` — reroute a line (`lineId` = `TradeItem.id`).
- `removeTradeItem(lineId)` — remove a line.
- `deleteDraft(tradeId, requestingUserId)` — **authz:** caller must be an owner of the creator team AND status must be `DRAFT`. Deleting a trade in any other status remains admin-only (existing legacy rule).
- `listDraftsForUser({ userId / teamIds, status, sort, skip, take })` — thin wrapper over the existing `getTradesByTeam`, scoped to the user's team(s) and `status=DRAFT`.
- `requestTrade(tradeId, ...)` — the "send" transition: `DRAFT → REQUESTED` write, then enqueue notifications via the existing `ObanDAO`.

**Search / lookup:**

- `TeamDAO.searchTeams({ q, excludeTeamIds })` — team picker. Matches ESPN name (`Team.name`) and CSV name / abbreviation (`team.owners[].csvName`; `abbreviation == csvName`). CSV-weighted ranking done in app code. No missing columns.
- `PlayerDAO.searchPlayers` enhancement — add an `ownerTeamIds[]` filter (column `Player.leagueTeamId` already exists and is indexed). **No position filtering** (deferred).
- `DraftPickDAO.searchEligiblePicks({ year, type, round, originalOwnerId, currentOwnerId, skip, take })` — structured, well-indexed pick lookup. The "tradeable right now" date gate **continues to read the existing env var** for this pass; the commissioner-editable Settings-backed date is deferred.

**Validation & review** (one shared `buildTradeSummary(tradeId)` service powering both, so counts are consistent):

- `validateTrade` / `POST .../validate` — **structural + flow only**: exactly one CREATOR, ≥1 recipient, ≥1 line item, per-team `sendsCount`/`receivesCount`, and warnings like `TEAM_RECEIVES_NOTHING`. `canSend = errors.length === 0`.
- `POST .../review` — canonical per-team `sends`/`receives` projection over the hydrated trade + `notifications.willNotifyVia` + the `validate` result. Pure projection over existing data.

**Notifications:**

- A `willNotifyVia` helper that reads each recipient owner's `userSettings` prefs (`emailEnabled` / `discordDmEnabled` + presence of `discordUserId`). All enqueueing reuses the existing `ObanDAO` — no new notification DAO.

### Explicitly deferred

| Deferred item | Why deferred |
|---|---|
| `bulkMutateTradeItems` (lines bulk endpoint) | Nice-to-have, not required for first pass. |
| Roster-cap validation (`ROSTER_LIMIT_EXCEEDED`) | No roster-size concept in the schema at all; large schema project. Commissioners vet manually. |
| Pick / asset "encumbered" (already in a pending trade) | Not modeled; would be a raceable cross-table derivation. Commissioners vet manually. |
| Commissioner-editable pick-trade date in `Settings` | Needs a small migration (`Settings.pickTradeEligibleFrom`). Interim: keep reading the env var. |
| Position filtering / sorting on asset search | `Player.meta` is plain `json` (not `jsonb`) and position lives there with majors/minors shape mismatch; clean fix is a first-class `position` column + backfill + sync change. Not needed now. |
| Optimistic concurrency (`Trade.version`, `expectedVersion`, 409) | Drafts are effectively single-editor; low blast radius. `dateModified` can serve as a weak token later. |
| `Trade.title` (draft titles) | Optional 1-column migration; revisit if product wants named drafts. |
| `Team.csvName` denormalization | Touches sync/display code; using `owners[0].csvName` is correct for now. |
| Per-team `eligibleAssetCount` / `lastTradedAt` in list views | Derivable but not stored; fine to defer / compute on demand. |
| `builderContext` convenience bootstrap procedure | Composable from existing `UserDAO` / `TeamDAO`; optional. |
| `leagueId` scoping anywhere | Single tenant/league; intentionally not built. |

## Rationale

- **Unblocks the builder with zero migrations.** Every in-scope item maps directly onto existing tables, columns, and indexes, so the frontend can build the full create/edit/search/validate/send loop without waiting on schema work.
- **Keeps the canonical model.** Building on `TradeParticipant` + `TradeItem(senderId, recipientId)` means the chosen UX (give/get, per-team panels, or ledger) won't force a contract change later.
- **Defers everything ambiguous.** Roster caps, encumbrance, position search, and the Settings-backed date each need either a migration or a product decision; bundling them now would stall the first pass. Commissioner manual vetting already covers the legality gaps in the interim.
- **Consistency for free.** Driving `/validate` and `/review` off one `buildTradeSummary` guarantees the send/receive counts match across the builder and the confirm screen — a stated frontend requirement.

## Consequences

- The builder can ship create/edit/search/validate/send entirely on v2 DAOs with no migration.
- Validation is **structural only** in this pass. Trades that violate roster limits or include encumbered assets can still be sent; commissioners catch these during vetting. The frontend must not present roster-legality guarantees.
- The pick-eligibility date still requires a redeploy to change (env var) until the deferred `Settings` work lands.
- No multi-editor safety: concurrent edits to the same draft are last-write-wins. Acceptable given single-editor reality.
- Follow-up ADR(s) will be needed if/when the deferred migration items (Settings date, position column, `Trade.version`, `Trade.title`) are picked up.

## Revisit triggers

- Product wants roster-aware or encumbrance-aware validation in the builder (not just commissioner vetting).
- Commissioners need to self-serve the pick-trade date without a redeploy → do the `Settings.pickTradeEligibleFrom` migration.
- Position filtering/sorting becomes a real builder requirement → promote `position` to a first-class column.
- Multi-tab / commissioner co-editing of drafts causes lost autosaves → add optimistic concurrency on `Trade`.
