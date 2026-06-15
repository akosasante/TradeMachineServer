# Trade Request Builder — Backend / v2 DAO Proposal

Status: **Proposal / planning only — no code changes yet.**
Audience: TradeMachineServer backend + the frontend team building the new Trade Request builder UI.

## Scope & decisions baked into this doc

These are settled for the first pass and the rest of the doc assumes them:

- **tRPC v2 only.** The new UI talks to the v2 tRPC routers (`src/api/routes/v2/routers/`). We do **not** reach back into the legacy `TradeController` (routing-controllers) for create/edit, even though it technically already supports it. All new builder writes go into v2 `TradeDAO`.
- **Single tenant / single league.** There is no `League` model and we are not adding one. Do **not** build `leagueId` scoping into the DAOs. Ignore every `/leagues/:leagueId/...` path and `leagueId` query param in the frontend mockups — they are dead weight here.
- **Draft = `Trade.status = DRAFT`.** No separate "draft" table. The status enum already covers the lifecycle: `DRAFT → REQUESTED → PENDING → ACCEPTED / REJECTED → SUBMITTED`.
- **Delete permissions:** an owner may delete **their own draft** (a `Trade` in `DRAFT` status that their team created). Deleting a trade in any other status remains **admin-only** (matches the current legacy behavior).
- **Out of scope for v1 (commissioners handle manually during vetting):** "encumbered" assets (already in another pending trade) and roster-cap validation. See §6.
- **No position filtering in v1.** Asset search will not filter/sort by position for the first pass; revisit later if needed. See §5.
- **No optimistic concurrency in v1.** See §7.

## The good news: the canonical model already exists

The frontend's single most important ask — *"model trades as participants plus line items with `fromTeamId`/`toTeamId`, not give/get buckets"* — **is already how the schema works.** No contract change is needed to support V1/V2/V3 UX off one model.

- `TradeParticipant` — `{ teamId, participantType: CREATOR | RECIPIENT }`, unique on `(tradeId, teamId)`.
- `TradeItem` (the "line") — `{ id, tradeItemType: PLAYER | PICK, tradeItemId, senderId (fromTeam), recipientId (toTeam) }`, unique on `(tradeId, tradeItemId, tradeItemType, senderId, recipientId)`.

> **What is `lineId`?** It is **not a new field.** A "line" in the mockups maps 1:1 to a `TradeItem` row, and `lineId` is that row's existing primary key — `TradeItem.id` (a UUID we already generate). The mock's `"line_1"` / `"L7"` are just placeholder display IDs; the real API uses the `TradeItem.id` UUID. No schema change for this.

---

## 1. `TradeDAO` — new functions (the core builder writes)

The current v2 `TradeDAO` is **read + accept/decline/submit only** (`getTradeById`, `getTradesByTeam`, `getTradesPaginated`, `updateAcceptedBy`, `updateDeclinedBy`, `updateSubmitted`). It has **no create, no edit, no line mutations**. That is the main gap. None of the additions below require a schema migration (except the optional `title` column — see §7).

| New function | Backs frontend asks | Notes |
|---|---|---|
| `createDraft({ creatorTeamId, participantTeamIds })` | `POST /trade-drafts` | Insert `Trade(status=DRAFT)` + `TradeParticipant` rows. Return the hydrated trade. |
| `updateDraftParticipants(tradeId, participantTeamIds)` | `PATCH /trade-drafts` | Reconcile the participant set (add/remove). |
| `addTradeItem(tradeId, { tradeItemType, tradeItemId, senderId, recipientId })` | `POST .../lines` | One line. The `@@unique(...)` constraint already dedupes identical lines. |
| `updateTradeItem(lineId, { senderId?, recipientId? })` | `PATCH .../lines/:lineId` | Reroute a line (`lineId` = `TradeItem.id`). |
| `removeTradeItem(lineId)` | `DELETE .../lines/:lineId` | |
| `bulkMutateTradeItems(tradeId, { adds, updates, removes })` | `POST .../lines/bulk` | Nice-to-have; cuts chatty mobile calls. Wrap in a Prisma transaction. |
| `deleteDraft(tradeId, requestingUserId)` | `DELETE /trade-drafts` | New. Authz: caller must be an owner of the creator team **and** status must be `DRAFT`. Any-other-status delete stays admin-only (existing legacy rule). |
| `listDraftsForUser({ userId / teamIds, status, sort, skip, take })` | `GET /trade-drafts` | Thin wrapper over the existing `getTradesByTeam`, scoped to the requesting user's team(s) and `status=DRAFT`. Not a from-scratch build. |

**Every mutation returns the fully hydrated trade.** The frontend explicitly asked for this to avoid refetches, and `getTradeById` already hydrates participants/items/teams/owners — reuse it as the return path for all of the above.

---

## 2. Builder search & lookup

### Teams / owners picker (`GET /trade-builder/teams`)

- **`TeamDAO.getAllTeams()` largely suffices.** It already returns each team's owners including `csvName`. For a single small league, the picker can filter client-side, or we add a thin `searchTeams({ q, excludeTeamIds })` server-side helper.
- **What "search by ESPN name / CSV name" actually maps to (both possible):**
  - **ESPN name** is just `Team.name` (it's the ESPN-synced name). Filtering/weighting on it = a plain `name ILIKE` on the `Team` table. The `name` column is already indexed (`@@index([name])` exists on `Player`; `Team.name` is a normal column — fine for a small league regardless).
  - **CSV name** lives on `User`, not `Team`. All owners of a team should share the same `csvName`, so a team's CSV name = `team.owners[0]?.csvName`. Search = filter teams whose `owners.csvName ILIKE q` (a join/`some` filter on the owners relation). Good enough for v1.
  - **`abbreviation` == `csvName`.** The "abbreviation" the mockups refer to (e.g. `BXB`) is the colloquial short name, which **is** `csvName` — not a separate field. So there is nothing extra to model; abbreviation search and CSV-name search are the same query.
  - So the frontend's "match CSV name (== abbreviation) + ESPN name, CSV weighted highly" ask **is fully achievable** with existing data — a query across `Team.name` + the owners' `csvName`, with weighting applied in app code (or a `CASE`/ordering in SQL). The only piece that needs server-side logic is the weighting; the underlying data is all there.
- **No missing columns for the team picker.** Every field the frontend asked for (ESPN name, CSV name / abbreviation, owner name) is already queryable.
- Possible later (not v1, not required): denormalize `csvName` onto the `Team` table so it's a single real, indexable column instead of an owners-relation join. Purely a convenience/perf optimization — **not committing to that now**, and not needed for correctness.

### Asset search — players (`GET /trade-builder/assets`)

- **`PlayerDAO.searchPlayers({ search, league, skip, take })` exists** (name substring + MAJORS/MINORS + pagination).
- **Enhance:** add an `ownerTeamIds[]` filter — the column already exists (`Player.leagueTeamId`) and is indexed.
- **No position filtering in v1** (decided) — see §5.

### Eligible picks (`GET /trade-builder/eligible-picks`)

- **`DraftPickDAO.getAllPicks({ season, type })` exists** but does **not** filter by `round`, `originalOwnerId`, or `currentOwnerId` — even though the schema and indexes already support all three.
- **New: `searchEligiblePicks({ year, type, round, originalOwnerId, currentOwnerId, skip, take })`** — straightforward and well-indexed (`@@index([currentOwnerId, originalOwnerId])`, `@@index([originalOwnerId])`, etc.). This is the cheap structured lookup the frontend (correctly) prefers over fuzzy pick search.
- The "only return picks tradeable right now" default depends on a date — see §4.

---

## 3. Validation & review (`/validate`, `/review`)

These are two "is this trade okay, and what does it look like?" calls at two different moments. They overlap heavily — implement them off **one** shared `buildTradeSummary(tradeId)` service so the send/receive counts are guaranteed identical across both (exactly the consistency the frontend asked for), then expose a lean slice and a full slice.

### `POST .../validate` — "can I send this yet?" (callable anytime)

A lightweight, repeatable legality check the builder calls *while the user is still editing* — drives the Send button's enabled/disabled state and inline errors/warnings as lines change. The mock includes a `mode` field (e.g. `"pre_review"`) so the same endpoint serves multiple points.

Returns:
```json
{
  "canSend": false,
  "errors": [],
  "warnings": [
    { "code": "TEAM_RECEIVES_NOTHING", "message": "Curveball Crew receives nothing.", "teamId": "team_789" }
  ],
  "flowBalance": [
    { "teamId": "team_123", "sendsCount": 2, "receivesCount": 1 }
  ]
}
```

What we compute in v1 (**structural + flow only**, the legacy `Trade.isValid()` logic surfaced as structured codes):
- `errors` — exactly one `CREATOR` participant; ≥1 recipient; ≥1 line item.
- `warnings` — e.g. `TEAM_RECEIVES_NOTHING` / a team that only sends or only receives, derived from per-team line counts.
- `flowBalance` — per-team `sendsCount` / `receivesCount`, from grouping `TradeItem`s by `senderId` / `recipientId`.
- `canSend` — `errors.length === 0`.

### `POST .../review` — "show me the final review screen" (called once, before send)

Returns the **canonical, human-readable summary** the user confirms on the review/confirm screen: the per-team breakdown of what's sent/received plus a notification preview. This is the frontend's *"server returns canonical summaries from lines"* ask.

Returns:
```json
{
  "draftId": "draft_abc",
  "canSend": true,
  "participants": [ /* team identity: name, csvName, owner */ ],
  "sectionsByTeam": [
    { "teamId": "team_123", "sends": [ /* hydrated assets */ ], "receives": [ /* hydrated assets */ ] }
  ],
  "notifications": { "willNotifyVia": ["email", "discord"] },
  "validation": { "errors": [], "warnings": [] }
}
```

What we compute in v1 (all from existing data — no new fields):
- `sectionsByTeam` — a pure projection over the hydrated trade (`getTradeById` already hydrates items + teams + owners), grouping each line into the sender's `sends` and the recipient's `receives`.
- `notifications.willNotifyVia` — read each recipient owner's `userSettings` prefs (`emailEnabled` / `discordDmEnabled` + presence of `discordUserId`); see §4.
- `validation` — the same result as `/validate`.

In short: **`/review` = `/validate` + the hydrated per-team sections + the notification preview.** `/validate` is the cheap call you can run on every line change; `/review` is the richer one-shot payload for the confirm screen.

### Explicitly NOT in v1

`ROSTER_LIMIT_EXCEEDED`, `PICK_ENCUMBERED` — no schema support; commissioners vet these manually. See §6.

---

## 4. Notifications, the trade window date, and Settings

### Notifications on send — existing DAOs already cover it ✅

- `ObanDAO` has everything: `enqueueTradeAnnouncement`, `enqueueTradeRequestEmail`, `enqueueTradeRequestDm`, plus accept/decline/submit variants.
- `User` carries `discordUserId`, `slackUsername`, and `userSettings` (JSONB) with per-owner prefs (`emailEnabled` / `discordDmEnabled`). So `willNotifyVia` / `notifiedRecipients` are **computable today** — just a helper that reads recipient prefs. No new DAO.
- The `send` action = the status→`REQUESTED` write (new `TradeDAO` work in §1) + existing `ObanDAO` enqueue.

### Pick-trade deadline → move from env var into the `Settings` table (recommended)

Today the "are picks tradeable yet this season" cutoff is a **date in frontend/backend env vars**, and the commissioner often doesn't hand you that date until mid-season — which means a redeploy to change it. The `Settings` table is the right home so commissioners/admins can self-serve:

- The `Settings` model already exists (`tradeWindowStart` / `tradeWindowEnd` are `Time`-only and unused; `downtime` is JSON; `modifiedById` tracks who changed it).
- **Proposal:** add a nullable `pickTradeEligibleFrom` (or per-`PickLeagueLevel` map) to `Settings`, editable via an admin/commissioner-only tRPC procedure. `searchEligiblePicks` reads it and, by default, returns no picks (or flags ineligible) until the date has passed.
- This is a **small, self-contained migration** (one column on an existing table) and a natural fit — unlike roster caps, the data model already supports it. Worth doing because it removes a redeploy-to-change-a-date pain point.
- **Until that lands:** `searchEligiblePicks` can keep reading the env var so the structured endpoint ships without blocking on the Settings work.

---

## 5. Position search — deferred (not in v1)

**Decision: no position filtering or sorting in the first pass.** The notes below are captured for when we revisit it, but no work is planned now.

Facts on the ground:

- We're on **Postgres 16**.
- `Player.meta` is mapped as plain **`json`** (Prisma `Json?`, no `@db.JsonB`) — **not `jsonb`**. Plain `json` can't take a GIN index and has limited operator support.
- Position is **not** stored uniformly: for **minors** it's a string inside `meta`; for **majors** it's derived from a nested ESPN blob (`meta.espnPlayer...defaultPositionId` → mapped) and only surfaced as JSON in the `HydratedMajor` view (`eligiblePositions` / `mainPosition`, cast to `jsonb` in the view). The `HydratedMinor` view exposes `position` as `text`.

Options, worst → best for our case:

1. **Do nothing / filter in app code.** Fine only if result sets are tiny. Can't index, can't sort efficiently.
2. **Expression (functional) index on the extracted value**, e.g. `CREATE INDEX ... ON player ((meta->>'position'))`. The `->>` operator works on `json` too, so this is possible without converting the column — **but** it only helps the *minors* shape; majors store position nested/differently, so one expression won't cover both leagues. Half a solution.
3. **Convert `meta` to `jsonb`** (migration) and add a GIN or expression index. Enables richer JSON querying, but you still have the majors-vs-minors shape mismatch, and you'd be indexing an unstructured blob.
4. **(Recommended) Promote `position` to a first-class `text` column on `Player`, B-tree indexed.** Both sync paths (ESPN majors, Sheets/NocoDB minors) populate it, backfilled once from existing `meta`. This is the clean, fast answer: simple `WHERE position = ?` / `IN (...)`, sortable, one index, no JSON gymnastics, and it sidesteps the two-shapes problem by normalizing at write time. This is the same "probably worth denormalizing" note already in the schema comment on `meta`.

**If/when we do this later:** option 4 (promote `position` to a first-class indexed column) is the clean answer. Avoid option 2 as a "fix" — it silently only works for minors. For now this is deferred entirely.

---

## 6. Deliberately deferred (commissioners handle manually for now)

Per decision, v1 does **not** implement these; commissioners continue to catch them when vetting trades:

- **Encumbrance** ("asset is already in another pending trade"). Not modeled. *Could* be derived by joining `TradeItem` to non-terminal trades, but it's a new cross-table query and easy to race — skip it.
- **Roster caps.** There is **no roster-size concept anywhere in the schema** (no roster table, no cap field). `ROSTER_LIMIT_EXCEEDED` / `rosterAfter` / `rosterCap` are not computable and would require a substantial schema project. Out of scope.

The frontend should **not** design a validation card around roster legality for v1.

---

## 7. Optimistic concurrency — deferred (not in v1)

**Decision: skip for the first pass.** Rationale below, kept for when multi-editor scenarios become real.

**What it would be:** add a `version` integer (or use `dateModified` as a token) to a mutable row; every write sends `expectedVersion`; the server rejects with `409 CONFLICT` if the row changed since the client last read it, instead of silently overwriting (last-write-wins).

**Why you'd want it / when it bites:** the builder autosaves frequently. Two writers on the *same draft* can clobber each other:
- the same owner with the draft open in two tabs / on phone + laptop, or
- a commissioner/admin editing a draft while the owner is also editing.

Without versioning, whoever saves last wins and the other's edits vanish with no warning. With it, the client gets a 409 and can reconcile.

**Which table:** only **`Trade`** (the draft). Line mutations (`TradeItem`) all happen in the context of a draft, so a single version on the parent `Trade` is sufficient — you don't need it on `TradeItem` or `TradeParticipant`.

**Verdict for v1: skip it.** Drafts are overwhelmingly edited by a single owner in one place, and the blast radius of a lost autosave on a not-yet-sent draft is low. If/when multi-tab or commissioner-co-editing becomes real, `Trade.dateModified` already exists and can serve as a weak compare-and-set token without a migration; a dedicated `version` column can come later. Not worth blocking v1.

---

## 8. Per-team `eligibleAssetCount` / `lastTradedAt`

Derivable (aggregate/join) but not stored. Fine to compute on demand for a single team detail view. **Not** something to put in a paginated team-search list without precompute/caching. Acceptable to defer for v1.

---

## 9. What existing v2 DAOs already cover (no new work)

- **Load a draft / proposal:** `TradeDAO.getTradeById` (fully hydrated). ✅
- **List trades for a team / staff:** `getTradesByTeam`, `getTradesPaginated` (status/date/player/pick filters). ✅ — `listDraftsForUser` is a thin wrapper.
- **Accept / decline / submit:** `updateAcceptedBy`, `updateDeclinedBy`, `updateSubmitted` + existing v2 `trade` router procedures. ✅
- **User/team identity for a `/me`-style bootstrap:** `UserDAO.getUserById` / `getAllUsersWithTeams`, `TeamDAO.getTeamById`. ✅ (a `builderContext` convenience procedure is composable from these — optional).
- **Team + owner list (incl. `csvName`):** `TeamDAO.getAllTeams`. ✅
- **Basic player search:** `PlayerDAO.searchPlayers`. ✅ (needs the `ownerTeamIds` enhancement for the full ask).
- **Structured pick list by season/type:** `DraftPickDAO.getAllPicks`. ✅ partially (needs `searchEligiblePicks` for round/owner + date eligibility).
- **All notification enqueueing:** `ObanDAO`. ✅ complete.

---

## 10. Recommended first-pass order

1. **`TradeDAO` builder writes:** `createDraft`, `addTradeItem`, `updateTradeItem`, `removeTradeItem`, `updateDraftParticipants`, `listDraftsForUser`, `deleteDraft` (owner-can-delete-own-draft authz). *(zero migration)*
2. **`DraftPickDAO.searchEligiblePicks`** (structured, indexed). *(zero migration)*
3. **`PlayerDAO.searchPlayers`** enhancement: add `ownerTeamIds`. *(zero migration)*
4. **`validateTrade`** (structural + flow balance only). *(zero migration)*
5. **`send`:** status→`REQUESTED` write + existing `ObanDAO` enqueue + `willNotifyVia` helper. *(zero migration)*
6. **Settings-driven pick-trade date** (small migration on `Settings` + admin/commissioner procedure). Until then, read the env var.

Optional / later (explicitly **not** v1): a single `title` column on `Trade` for draft titles (small migration), `csvName` onto `Team`, `position` as a first-class column (§5), optimistic-concurrency `version` (§7).

---

## Migration summary

| Change | Size | When |
|---|---|---|
| (none for builder CRUD, search, validate, send) | — | v1 — these are pure DAO additions |
| `Settings.pickTradeEligibleFrom` | small (1 col, existing table) | recommended v1 follow-up; removes redeploy-to-change-a-date pain |
| `Trade.title` | small (1 col) | optional v1 if draft titles are wanted |
| `Player.position` first-class column + backfill + sync change | medium | **deferred — not v1** (§5) |
| `Team.csvName` denormalization | medium (touches sync/display) | future, not committed |
| `Trade.version` (optimistic concurrency) | small, but needs client contract | **deferred — not v1** (§7) |
| Roster caps / encumbrance modeling | large | out of scope; commissioners vet manually (§6) |
