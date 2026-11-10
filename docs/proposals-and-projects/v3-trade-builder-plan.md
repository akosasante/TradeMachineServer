# V3 Trade Builder Migration Plan

**Status:** Planning
**Created:** 2026-11-09
**Repos:** NewTradeMachineClient, TradeMachineServer, TradeMachineEx (verification only)

Replace the legacy Vue 2 `/make_trade` stepper with a V3 builder in NewTradeMachineClient, backed by tRPC `/v2` procedures and Prisma v2 DAOs. The builder uses two destination-focused columns ("what each team gets"), a shared asset picker, and a Build → Review → Send flow. There are no saved drafts in the first version.

This is a living plan to follow across sessions. Detailed implementation plans for each phase will be added as we go. Related: [ADR 0003](../adr/0003-trade-builder-v2-daos.md), [trade-builder-api-proposal.md](./trade-builder-api-proposal.md), [ADR 0002](../adr/0002-staff-trade-search-postgres-structured.md).

## Decisions so far

- **Layout:** each panel shows what one team receives. On desktop, your team is on the left and the right panel switches between the other participants (tabs when there are few short names, a dropdown otherwise). On mobile, one panel shows at a time, with a team selector that includes your team.
- **Multi-team transfers:** any participant can send to any other participant (e.g. Team B → Team C in a trade you build). The destination-focused layout handles this naturally; Review shows every team's gets and sends.
- **Asset picker:** an expandable section inside the column on desktop and a full-screen sheet on mobile. It switches between **Players** and **Picks**; there is no "All" mode.
- **Searching players:** search by name (debounced 200–300 ms) and filter by MLB/MiLB.
- **Searching picks:** structured filters (season, type, round). Picks are listed before any filter is chosen.
- **Ownership:** the recorded owner (`currentOwner` / `leagueTeamId`) decides what is shown first, but never limits search results. Both our DB and ESPN can be stale while trades are pending, so:
  - Empty search: browse the selected source team's recorded assets.
  - Typed search / chosen filters: search all assets; results grouped "Recorded on Team B" then "Other matches".
  - Adding an asset recorded on another team shows a confirmation, and the warning stays visible on the asset and in Review. It does not block sending.
- **What blocks sending:** the same asset added twice, a team sending to itself, no assets, or fewer than two teams.
- **No drafts:** the proposal lives only in the client (Pinia) until Send. Send makes one server call that creates and requests the trade together. Leaving with unsent changes shows a warning; losing the proposal on page refresh is acceptable for now.
- **Search engine:** existing Postgres case-insensitive search via Prisma. No Elasticsearch, client-side search index, or `pg_trgm` until measurements show a need.
- **No live ESPN calls** while building a trade.
- **Still deferred** (per ADR 0003): position filters, roster limits, flagging assets already in pending trades, configurable pick-trade date.

## Process

This follows our usual migration process, with one change: **define the tRPC contract first** (Phase 0), so store wiring and MSW mocks are built against the real request/response types instead of guessed ones.

1. Contract: zod schemas + stubbed tRPC procedures, publish `@akosasante/trpc-types`.
2. Break the screen into reusable components; component tests + Storybook.
3. Connect to the Pinia store / API (mocked).
4. MSW mock routes + Playwright e2e tests.
5. Real DAOs behind the endpoints.
6. Notification queue publishing (TradeMachineEx changes if needed).

## Screens

### Desktop: Build

```text
┌───────────────────────────────────────────────────────────────────────────┐
│ New trade                     Teams: [Your Team] [Team B] [Team C] [+ Add]│
│ ① Build ─── ② Review                                                      │
├────────────────────────────────────┬──────────────────────────────────────┤
│ YOUR TEAM GETS        Receives 2   │ [Team B ▾] or [Team B | Team C]      │
│                       Sends 3      │ TEAM B GETS          Receives 2      │
│ From Team B                        │                      Sends 1         │
│   Player A   MLB · NYY        [×]  │ From Your Team                       │
│ From Team C                        │   Player C   MiLB · TOR         [×]  │
│   2027 MLB Rd 1 (orig. C)     [×]  │   Player D   MLB · BOS  ⚠       [×]  │
│                                    │   ⚠ Recorded owner: Team C           │
│ [+ Add assets]                     │ [− Close picker]                     │
│                                    │ ┌──────────────────────────────────┐ │
│                                    │ │ From: [Your Team ▾]              │ │
│                                    │ │ [ Players | Picks ]              │ │
│                                    │ │ [Search player name…] [Level ▾]  │ │
│                                    │ │ Recorded on Your Team            │ │
│                                    │ │   Player E   MLB · SEA     [+]   │ │
│                                    │ │   Player C   MiLB · TOR  Added   │ │
│                                    │ │ Other matches                    │ │
│                                    │ │   Player F   MLB · LAD     [+]   │ │
│                                    │ │   (Recorded: Team C)             │ │
│                                    │ │ [Load more]                      │ │
│                                    │ └──────────────────────────────────┘ │
├────────────────────────────────────┴──────────────────────────────────────┤
│ 1 warning                                              [Review trade →]   │
└───────────────────────────────────────────────────────────────────────────┘
```

### Asset picker: Picks mode

```text
│ From: [Your Team ▾]                  │
│ [ Players | Picks ]                  │
│ [Season ▾] [MLB/MiLB ▾] [Round ▾]    │
│ Recorded on Your Team                │
│ 2027 MLB · Round 1                   │
│   Originally Team C            [+]   │
│ 2027 MLB · Round 2                   │
│   Originally Your Team         [+]   │
│ Other matches                        │
│ 2027 MLB · Round 1                   │
│   Originally Team D            [+]   │
│   (Recorded: Team D)                 │
```

### Mobile: Build

```text
┌──────────────────────────────┐
│ New trade         ① Build    │
│ Teams: You, B, C   [Edit]    │
│ Receiving team               │
│ [Your Team · 2 assets     ▾] │
│ From Team B                  │
│   Player A  MLB · NYY  [×]   │
│ From Team C                  │
│   2027 MLB Rd 1        [×]   │
│ [+ Add assets]               │
├──────────────────────────────┤
│ 1 warning      [Review →]    │
└──────────────────────────────┘
```

### Mobile: Asset sheet

```text
┌──────────────────────────────┐
│ [Close]   Add to Team B      │
│ From: [Your Team ▾]          │
│ [ Players | Picks ]          │
│ [Search player name…]        │
│ [Level ▾]                    │
│ Recorded on Your Team        │
│   Player E  MLB · SEA  [+]   │
│   Player C  MiLB   Added     │
│ Other matches                │
│   Player F  MLB · LAD  [+]   │
│   Recorded: Team C           │
├──────────────────────────────┤
│        Done · 2 added        │
└──────────────────────────────┘
```

The keyboard does not open automatically when the sheet opens, so users can browse or switch to Picks first. Pick filters wrap to two rows on narrow screens.

### Review (all screen sizes, stacked)

```text
┌──────────────────────────────────────────────┐
│ ① Build ─── ② Review                         │
│ YOUR TEAM                                    │
│   Gets:  Player A (from B)                   │
│          2027 MLB Rd 1 (from C)              │
│   Sends: Player C → B, Player D → B          │
│ TEAM B                                       │
│   Gets:  Player C, Player D (from You)       │
│   Sends: Player A → You, Player G → C        │
│   ⚠ Player D recorded owner: Team C          │
│ TEAM C                                       │
│   Gets:  Player G (from B)                   │
│   Sends: 2027 MLB Rd 1 → You                 │
│ Notifications: Team B owners via email +     │
│ Discord; Team C owners via email             │
│ [← Back to build]             [Send trade]   │
└──────────────────────────────────────────────┘
```

## Phases

### Phase 0: Specification and contract (blocks everything else)

- [ ] Audit the legacy `/make_trade` flow in TradeMachineClient for behavior to keep: who can start a trade, how recipient teams are chosen, what happens after sending, which notifications go out.
- [ ] Write ADR 0004 recording: no drafts, single create-and-request call on Send, non-blocking ownership warnings, searches not limited to recorded owners. It supersedes the draft-related parts of ADR 0003. Update the ADR index.
- [ ] Define zod input/output schemas (location: nested `trades.builder.*` router, pending open question 1):
  - `searchTeams` — team picker; reuses `TeamDAO.searchTeams`.
  - `searchPlayers` — `{ q?, level?, preferredOwnerTeamId?, skip, take }` → rows with recorded owner and an `ownedByPreferred` flag.
  - `searchPicks` — `{ season?, type?, round?, preferredOwnerTeamId?, skip, take }` → rows with current and original owner and an `ownedByPreferred` flag.
  - `validate` — proposed trade → `{ errors[], warnings[], perTeam }`.
  - `createAndRequest` — proposed trade → `{ tradeId }`.
  - Proposed trade shape: `{ participants[], items[{ type, assetId, senderTeamId, recipientTeamId }] }`.
- [ ] Stub the procedures with correctly typed fixtures.
- [ ] Build, bump, and publish `@akosasante/trpc-types`; update its changelog (see "Publishing `@akosasante/trpc-types`" in TradeMachineServer `AGENTS.md`).

### Phase 1: Components (after Phase 0 contract; parallel with Phase 2)

Each component gets Storybook stories and component tests (see NewTradeMachineClient `ai-docs/TESTING_PATTERNS.md`). Reuse existing V3 components where possible: team chips, select/dropdown, asset rows from Trade Review, buttons, badges.

- [ ] `TradeBuilderLayout` — step header, sticky footer, desktop/mobile layout switching.
- [ ] `TradeParticipantsBar` — team chips + team-picker popover (desktop) / sheet (mobile); confirm when removing a team that has assets.
- [ ] `ReceivingTeamPanel` — assets grouped by sending team, receives/sends counts, remove buttons, warning badges.
- [ ] `RightPanelTeamSwitcher` — tabs or dropdown, with asset counts per team (including zero).
- [ ] `AssetPicker` — source-team selector + Players/Picks switch; preserves each mode's search/filters while open.
  - [ ] `PlayerSearchPane` — name search, level filter, owner-grouped results, load more.
  - [ ] `PickSearchPane` — season/type/round filters and pick list.
  - [ ] `AssetResultRow` — Add / Added / "already going to Team C" states, recorded-owner note.
- [ ] `OwnershipMismatchDialog` — confirmation when adding an asset recorded on another team.
- [ ] `TradeReviewSummary` — every team's gets/sends, warnings, notification preview. Check what can be reused from the existing Trade Review page.
- [ ] `MobileReceivingTeamSelector`, `AssetPickerSheet`.

### Phase 2: State and data (after Phase 0 contract; parallel with Phase 1)

- [ ] `useTradeBuilderStore` (Pinia): participants, items, selected right-hand team; derived per-team counts, structural errors, ownership warnings. Actions: add/remove team, add/remove/move asset, reset. Duplicate assets must be impossible.
- [ ] `useAssetSearch` composable: debounce, ignore stale responses, short-lived LRU cache (~30 entries, ~45 s TTL, as in ADR 0002), pagination. Unit tested.
- [ ] Unsaved-changes guard: router leave guard + `beforeunload` warning.

### Phase 3: Views, mocks, and e2e (after Phases 1 and 2)

- [ ] `/trades/new` route with Build and Review steps sharing the store. Gated by `v3UiBeta`; others fall back to legacy `/make_trade`.
- [ ] MSW handlers in `src/mocks` for every builder procedure, including large result sets, ownership mismatches, and validation errors.
- [ ] Playwright tests:
  - [ ] Two-team trade, start to send.
  - [ ] Three-team trade including a Team B → Team C transfer.
  - [ ] Adding an asset with an ownership mismatch.
  - [ ] Duplicate asset prevented.
  - [ ] Mobile-viewport run of the main path.
  - [ ] Leaving with unsent changes.

### Phase 4: Server implementation (after Phase 0; can overlap Phases 1–3)

- [ ] Search: extend `PlayerDAO.searchPlayers` and `DraftPickDAO.searchEligiblePicks` so the preferred owner's assets rank first without filtering others out (ordering expression, or two queries: preferred owner, then everyone else).
- [ ] Validation: extend `tradeValidator` to validate a proposed (unsaved) trade; structural errors and ownership warnings computed in one place, shared by `validate` and `createAndRequest`.
- [ ] `createAndRequest`: one DB transaction creating participants + items and setting status `REQUESTED`. Check whether the existing `TradeDAO` builder methods (`createDraft`, `addTradeItem`, `requestTrade`) accept a transaction client; adapt if not.
- [ ] Authorization: requesting user must own the creator team; all participating teams must be active.
- [ ] Replace Phase 0 stubs; DAO unit + integration tests per `docs/testing/README.md`. Republish trpc-types only if types change.

### Phase 5: Notifications (after Phase 4 `createAndRequest`)

- [ ] After the transaction commits, enqueue the same trade-request notifications as the legacy flow: Oban email + Discord DM via `ObanDAO`, gated by `userSettings`. No Slack/Bull jobs for builder-created trades.
- [ ] Verify TradeMachineEx `EmailWorker` (`trade_request`) and `DiscordWorker` (`trade_request_dm`) handle multi-team trades. No Ex changes expected; add Ex tests only if email/DM content should mention ownership warnings.

### Phase 6: Rollout

- [ ] Point "New trade" links on the V3 dashboard and My Trades to `/trades/new` for beta users.
- [ ] Watch tracing spans/logs for builder procedures (search latency, send failures).
- [ ] Make V3 the default; keep `/make_trade` as fallback for one cycle, then remove.

## Backend vs frontend work

| Area | Frontend (NewTradeMachineClient) | Backend (TradeMachineServer) | TradeMachineEx |
|---|---|---|---|
| Contract | Consume published types | zod schemas, stub procedures, publish types package | — |
| UI | Components, stories, component tests, views, route | — | — |
| State | Pinia store, search composable, cache | — | — |
| Mocks / e2e | MSW handlers, Playwright | — | — |
| Search | Debounce, paging, grouped display | Owner-first ranking, filters, paging | — |
| Validation | Instant client-side checks | Authoritative check before saving | — |
| Persistence | — | Single transaction: create + request | — |
| Notifications | Notification preview in Review | Enqueue Oban jobs, respect user settings | Probably none; verify |

## Relevant files

- `TradeMachineServer/src/api/routes/v2/routers/trade.ts` — add builder procedures or mount a sub-router.
- `TradeMachineServer/src/DAO/v2/TradeDAO.ts` — builder write methods to reuse/adapt.
- `TradeMachineServer/src/DAO/v2/PlayerDAO.ts`, `DraftPickDAO.ts`, `TeamDAO.ts` — search.
- `TradeMachineServer/src/services/tradeBuilder/tradeValidator.ts`, `notificationPrefs.ts`.
- `TradeMachineServer/src/DAO/v2/ObanDAO.ts` — notification enqueueing.
- `TradeMachineServer/packages/trpc-types/` — version bump + changelog.
- `NewTradeMachineClient/src/{components,stores,composables,views,router,mocks}/`, `NewTradeMachineClient/e2e/`.
- `NewTradeMachineClient/ai-docs/TESTING_PATTERNS.md` — Storybook/Pinia conventions.
- `TradeMachineClient` (Vue 2) make-trade screens — reference for the behavior audit.
- Design explorations: `new builder experiments/` on the `backup/2026-11-05` branch of the TradeMachine (Infra) backup repo (V1 three-column and V2 stepper prototypes).

## Verification

1. Each phase ends with its tests passing: component tests and stories (1), store/composable unit tests (2), Playwright with MSW (3), server unit + integration tests (4), Oban job assertions in integration tests (5).
2. Contract check: the client type-checks against the published `@akosasante/trpc-types` version.
3. Search performance: check query plans for representative player searches with and without a preferred owner. Consider `pg_trgm` only if consistently slow.
4. Manual staging check: send a three-team trade with an ownership mismatch; confirm email, Discord DM, and how it renders on the existing Trade Review page.

## Open questions

1. **Procedure location:** nested `trades.builder.*` vs a separate `tradeBuilder` router. Leaning nested, to keep trade authorization in one place.
2. **Slack parity:** should V3-created trades trigger anything Slack-related? Recommendation: Oban only, matching the migration direction.
