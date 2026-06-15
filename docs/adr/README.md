# Architecture Decision Records (ADRs)

Numbered, dated records of significant technical decisions for TradeMachineServer and the reasoning behind them. Read the relevant ADR before changing or revisiting an area it covers; when an ADR and an older proposal disagree, the ADR is authoritative.

## Index

| # | Title | Date | Status |
|---|---|---|---|
| [0001](./0001-user-settings-jsonb-on-user.md) | Store user settings as JSONB on the `user` table | 2026-04-12 | Accepted |
| [0002](./0002-staff-trade-search-postgres-structured.md) | Staff trade search — structured Postgres filters | 2026-04-13 | Accepted |
| [0003](./0003-trade-builder-v2-daos.md) | Trade Request builder — v2 DAO scope (first pass) | 2026-06-15 | Accepted |

## Conventions

- **Filename:** `NNNN-kebab-case-title.md`, where `NNNN` is the next sequential zero-padded number. Numbers are unique — do not reuse.
- **Template** (follow the most recent ADRs, e.g. [0002](./0002-staff-trade-search-postgres-structured.md) / [0003](./0003-trade-builder-v2-daos.md)):
  - `# ADR NNNN: <title>`
  - A header block: `**Date:** YYYY-MM-DD`, `**Status:** Proposed | Accepted | Superseded`, `**Deciders:** <names>`
  - `## Context` → `## Decision` → `## Rationale` (optional) → `## Consequences`
  - Optional closing sections: `## Revisit triggers` / `## Future work`
- When adding an ADR, **add a row to the index table above.**
