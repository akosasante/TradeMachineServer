# TradeMachineServer Documentation

Project documentation lives here. This file is the entry point — start here, then drill into a subdirectory's own `README.md` for its full index.

> **For AI agents / Claude Code:** before starting non-trivial work (new features, schema/DAO changes, architecture decisions, deployment), check whether relevant context already exists here. Read this index, then the subdirectory `README.md`, then the specific file. See "When to read `docs/`" in [`AGENTS.md`](../AGENTS.md).

## Directories

| Directory | What's in it |
|---|---|
| [`adr/`](./adr/README.md) | **Architecture Decision Records** — numbered, dated records of significant technical decisions and the reasoning behind them. Read these before changing or revisiting an area they cover. |
| [`proposals-and-projects/`](./proposals-and-projects/README.md) | **Proposals, plans, and project write-ups** — design proposals, migration plans, and analyses. More exploratory and longer-lived-draft than ADRs; an ADR is the authoritative record of what was actually decided. |
| [`testing/`](./testing/README.md) | **Testing guide** — how to write and run tests, focused on the Prisma/v2 DAO patterns: unit vs. integration, shared helpers and factories, constructing the extended Prisma client, minimum coverage per DAO, and run commands. |

## How these relate

- A **proposal/project doc** explores a problem space and options (may be in-progress, superseded, or partially adopted).
- An **ADR** records a specific decision that came out of that exploration. When a proposal and an ADR disagree, the ADR wins.

## Adding new docs

- New significant technical decision → add an ADR in [`adr/`](./adr/) (next sequential number) and link it from `adr/README.md`.
- New design proposal, plan, or analysis → add it to [`proposals-and-projects/`](./proposals-and-projects/) and link it from that directory's `README.md`.
- Whenever you add a file to a directory here, **update that directory's `README.md` index** so progressive discovery keeps working.
