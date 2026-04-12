# ADR 0001: Store user settings as JSONB on the `user` table

## Status

Accepted

## Context

TradeMachine is adding per-user notification preferences (trade action Discord DMs, trade workflow emails). More user settings are expected in the short term beyond these two initial toggles.

The existing `settings` table (`@@map("settings")` in Prisma) is league-wide (trade window / downtime) and should **not** be repurposed for per-user preferences.

We need flexibility to add new settings keys without running a Prisma/Postgres migration each time.

### Alternatives considered

1. **Two boolean columns on `user`** — Strong DB types and constraints, but requires a migration per new setting; doesn't scale as the settings surface grows.
2. **Separate `UserSettings` table (1:1) with JSONB** — Similar flexibility but adds a join and "does this row exist?" lifecycle management.
3. **EAV table (`user_id`, `settings_key`, `settings_value`)** — Maximum flexibility but painful cross-field constraints, casting, and heavier queries; overkill for notification toggles.

## Decision

Add a single JSONB column `userSettings` on the `user` table (Prisma `Json` type, Postgres `jsonb`).

### Document shape (schemaVersion 1)

```json
{
  "schemaVersion": 1,
  "settingsUpdatedAt": "2026-04-12T01:23:45.678Z",
  "notifications": {
    "tradeActionDiscordDm": true,
    "tradeActionEmail": true
  }
}
```

### Key design rules

1. **`schemaVersion`** (integer, starts at 1) — Writers set or preserve this on every update. Readers treat missing/null as 1. Future versions can branch normalization or reject unknown versions.

2. **`settingsUpdatedAt`** (ISO 8601 UTC string) — Records when the settings blob last changed, inside the blob itself. Set by the server on every successful write. Independent of (but typically written together with) the `User` row's `dateModified`. Missing/null means "never saved via the settings API" — do **not** synthesize a timestamp.

3. **Defaults live only in application code** — The DB column default is `'{}'::jsonb` (empty object); all interpretation happens through a shared `normalizeUserSettings()` function.

4. **Asymmetric null/missing semantics** for the initial two notification toggles (explicit product choice):
   - `notifications.tradeActionEmail`: absent or JSON null → **true** (emails stay on unless explicitly disabled).
   - `notifications.tradeActionDiscordDm`: absent or JSON null → **false** (Discord DMs stay off until explicitly enabled).

   Implication: empty `{}` or `{ "notifications": {} }` yields **email on, Discord off** — satisfies the "at least one channel on" invariant without a backfill of existing rows.

5. **"At least one channel on" invariant** — Enforced **only in tRPC application code** (and V3 UI guardrails). No Postgres `CHECK` constraint for this pair in this phase. Direct SQL or future writers could store an illegal pair; this is an accepted tradeoff.

6. **Dual implementation** — TypeScript (zod schema + `normalizeUserSettings()`) and Elixir (`normalize_user_settings/1`) both implement the same normalization rules. Keep them in sync manually for now; optionally add a shared JSON Schema document later.

## Consequences

### Positive

- New settings keys can be added without a Prisma migration (just update zod schema + normalization).
- Existing user rows work with zero backfill (empty/null → defaults).
- In-blob `settingsUpdatedAt` provides a fine-grained audit trail for preference changes.
- `schemaVersion` enables future shape migration without table-level migrations.

### Negative / Accepted tradeoffs

- **No native DB constraint** on the "at least one channel on" rule — invalid combinations can be written via direct SQL or any writer that bypasses tRPC validation.
- **Weaker static typing** at the Postgres level vs. dedicated boolean columns; all type safety comes from zod in TS and pattern matching in Elixir.
- **Dual normalization implementations** (TS + Elixir) can drift; requires discipline or a shared schema doc.
- **No index** on JSONB paths unless needed for queries — if analytics or querying by a specific flag at scale is needed later, consider GIN indexes or extracting to typed columns.

## Revisit triggers

Consider revisiting this approach when any of the following arise:

- Need **DB-enforced invariants** (e.g. add a Postgres `CHECK` on JSONB paths, or promote critical flags to typed columns).
- Need **reporting/analytics** on specific settings flags at scale (JSONB path queries may be slower than indexed columns).
- **Multiple writers** outside tRPC that must obey the same validation rules (argues for a DB constraint or centralized write service).
- **Partial update write skew** becomes a concern (concurrent modifications to different JSONB keys without row-level locking).
- The number of settings grows large enough that a **dedicated `user_settings` table** would provide cleaner domain separation.
