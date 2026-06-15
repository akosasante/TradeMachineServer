# Testing Guide — Prisma (v2) DAOs

How we write and run tests for the Prisma-based v2 DAOs (`src/DAO/v2/`). Read this before adding a new DAO class or DAO method so your tests match the house style without reverse-engineering existing ones.

> Scope: this guide is about the **v2 / Prisma** DAOs. The legacy TypeORM DAOs in `src/DAO/` follow older patterns; new work should be Prisma + the v2 DAO pattern (see the repo-root `AGENTS.md`).

---

## 1. Where things live

| Thing | Path |
|---|---|
| v2 DAOs under test | `src/DAO/v2/*.ts` |
| v2 DAO **unit** tests | `tests/unit/DAO/v2/*.test.ts` |
| Shared unit-test helpers | `tests/unit/DAO/v2/daoTestHelpers.ts` |
| Data factories | `tests/factories/*.ts` |
| Integration tests | `tests/integration/**/*.test.ts` |
| Integration helpers (login, request, DB reset) | `tests/integration/helpers.ts` |
| Extended Prisma client | `src/bootstrap/prisma-db.ts` |
| Jest config | `jest.config.js` (testMatch: `*.test.ts` / `*.spec.ts`) |

---

## 2. Unit vs. integration — pick the right one

We test DAOs at **both** layers, and they have opposite rules:

| | Unit (`tests/unit/DAO/v2/`) | Integration (`tests/integration/`) |
|---|---|---|
| Prisma | **Mocked** (`jest-mock-extended`) | **Real** Postgres connection |
| Mocks | Mock the Prisma delegate (one layer down) | **No mocks** — exercise the real query |
| Asserts | The DAO passes the right `where`/`include`/`data` to Prisma | The DAO returns the right rows from a real DB |
| Needs Docker/DB | **No** | **Yes** (Postgres + the `test` schema) |
| Speed | Fast | Slower, run serially (`--runInBand`) |

Rule of thumb (also in `AGENTS.md`): **mock one layer down from the code under test.** For a DAO that means mocking the Prisma model delegate. For a controller, mock the DAO. Integration tests mock nothing.

A new DAO method should get **unit** coverage at minimum; add an integration test when the query is non-trivial (relation filters, raw SQL, pagination, ordering) and you want to prove it against a real database.

---

## 3. Running tests

### Unit tests — no Docker needed

```bash
# all unit tests
make test-unit

# a single file
make test-file        # prompts for the path
# or directly:
NODE_ENV=test ORM_CONFIG=local-test npx jest --config ./jest.config.js \
  --detectOpenHandles --bail --forceExit --testPathPattern="tests/unit/DAO/v2/UserDAO"

# a single test by name (regex), optionally combined with --testPathPattern
NODE_ENV=test ORM_CONFIG=local-test npx jest --config ./jest.config.js \
  --detectOpenHandles --bail --forceExit --testNamePattern="should strip the password"

# watch mode
make test-watch
```

### Integration tests — require Postgres + the `test` schema

One-time / when infra isn't running:

```bash
# 1. Start shared Postgres + Redis (from repo root or via make)
make docker-infrastructure-up

# 2. Create/upgrade the `test` schema (run once, and again after ANY new Prisma migration)
make prisma-migrate-test
#   - sources tests/.env (DATABASE_URL with ?schema=test) and runs `prisma migrate deploy`
#   - use `make prisma-push-test` instead to force-reset a corrupted/out-of-sync test schema
```

Then:

```bash
make test-integration
# integration tests MUST run serially; the make target already adds --runInBand.
# Running directly:
NODE_ENV=test ORM_CONFIG=local-test npx jest --config ./jest.config.js \
  --detectOpenHandles --runInBand --bail --forceExit --testPathPattern="tests/integration/v2/TrpcRoutes"
```

### Everything / coverage

```bash
make fullcheck   # lint + format + typecheck (run before committing)
NODE_ENV=test ORM_CONFIG=local-test npx jest --config ./jest.config.js \
  --detectOpenHandles --bail --forceExit --coverage
```

Notes:
- `--runInBand` is **required** for integration tests (shared DB → parallel runs corrupt each other). Unit tests run in parallel fine.
- Set `DB_LOGS=true` to see Prisma query logging in integration tests.

---

## 4. How to import the (extended) Prisma client

We do **not** use a bare `PrismaClient`. The app runs an **extended** client (`src/bootstrap/prisma-db.ts`) that adds computed result fields (e.g. `user.isAdmin()`). Always type/construct against that.

- Type: `import { ExtendedPrismaClient } from "../../bootstrap/prisma-db";`
- Real instance (integration / scripts): `import initializeDb from "../../bootstrap/prisma-db"; const prisma = initializeDb();`
- In tRPC procedures, the client is on context: `ctx.prisma` (already extended).

**DAOs take a single model delegate, not the whole client.** Controllers/routers construct them as `new UserDAO(prisma.user)`, `new ObanDAO(ctx.prisma.obanJob)`, etc. Your tests must mirror that — mock or pass the **delegate** (`prisma.user`), not the whole client.

---

## 5. Canonical Prisma DAO **unit** test

This is the shape every `tests/unit/DAO/v2/*.test.ts` follows. Copy it.

```ts
import { mockDeep, mockClear } from "jest-mock-extended";
import TeamDAO, { teamInclude } from "../../../../src/DAO/v2/TeamDAO";
import { ExtendedPrismaClient } from "../../../../src/bootstrap/prisma-db";
import { TeamFactory } from "../../../factories/TeamFactory";
import { daoTestLifecycle, expectDaoRequiresPrismaClient } from "./daoTestHelpers";
import { TeamStatus } from "@prisma/client";

// Alias the factory's Prisma-shaped builder; the wrapper arrow avoids the
// jest/unbound-method lint warning that a bare `= TeamFactory.x` reference triggers.
const makeTeam = (...args: Parameters<typeof TeamFactory.getPrismaTeamWithOwners>) =>
    TeamFactory.getPrismaTeamWithOwners(...args);

describe("[PRISMA] TeamDAO", () => {
    // Mock the DELEGATE, not the whole client. Type it via ExtendedPrismaClient["<model>"].
    const prisma = mockDeep<ExtendedPrismaClient["team"]>();
    const dao = new TeamDAO(prisma as unknown as ExtendedPrismaClient["team"]);

    daoTestLifecycle("TEAM");          // the ~~~~~~PRISMA TEAM DAO TESTS BEGIN/COMPLETE~~~~~~ banners
    afterEach(() => mockClear(prisma)); // reset mock between tests

    expectDaoRequiresPrismaClient(TeamDAO, "TeamDAO"); // the constructor guard test

    describe("getAllTeams", () => {
        it("returns teams ordered by name with owners included", async () => {
            const teams = [makeTeam({ name: "Alpha" }), makeTeam({ name: "Beta" })];
            prisma.findMany.mockResolvedValueOnce(teams as any);

            const result = await dao.getAllTeams();

            // Assert the DAO called Prisma correctly. Reuse the include constant
            // EXPORTED FROM THE DAO so the expectation can't drift from the query.
            expect(prisma.findMany).toHaveBeenCalledWith({
                orderBy: { name: "asc" },
                include: teamInclude,
            });
            expect(result).toHaveLength(2);
        });
    });
});
```

Key points:
- **Mock the delegate** with `mockDeep<ExtendedPrismaClient["<model>"]>()`; construct the DAO with it.
- **`mockClear` in `afterEach`** so call assertions don't leak between tests.
- **Mock data comes from a factory** (`getPrisma*` variants return the DAO's exact return type), not hand-rolled object literals.
- **Assert against the DAO's exported `include`/`select` constant** (e.g. `teamInclude`, `draftPickInclude`, `playerOwnerTeamInclude`) rather than re-typing the literal. If a DAO doesn't export its include yet and you're adding tests for it, export it (one `export` keyword) and import it.
- Mocked return values are used as identity — their exact field set doesn't affect `toHaveBeenCalledWith`, which checks the args the DAO passed *in*.

## 5b. Canonical Prisma DAO **integration** test

```ts
import { clearPrismaDb } from "../helpers";
import initializeDb, { ExtendedPrismaClient } from "../../../src/bootstrap/prisma-db";
import UserDAO from "../../../src/DAO/v2/UserDAO";
import { UserFactory } from "../../factories/UserFactory";

let prisma: ExtendedPrismaClient;
let userDAO: UserDAO;

beforeAll(() => {
    prisma = initializeDb(process.env.DB_LOGS === "true"); // REAL connection to the `test` schema
    userDAO = new UserDAO(prisma.user);                    // construct with the real delegate
});
afterAll(async () => {
    await prisma.$disconnect();
});
afterEach(async () => {
    await clearPrismaDb(prisma); // TRUNCATEs all tables between tests (see note below)
});

it("persists and reads back a user", async () => {
    const [created] = await userDAO.createUsers([UserFactory.getPrismaUser({ email: "a@b.com" })]);
    const found = await userDAO.getUserById(created.id);
    expect(found.email).toBe("a@b.com");
});
```

- **No mocks.** Use the real client and real factories; assert on real rows.
- `clearPrismaDb(prisma)` truncates tables between tests. It intentionally **skips** `oban_jobs`, `typeorm_metadata`, `_prisma_migrations`, and `query-result-cache`. If your test creates Oban jobs, clean them up yourself.
- The `test` schema must exist and be migrated first (`make prisma-migrate-test`).

---

## 6. Minimum tests for any new DAO

When you add a **new DAO class**, include:
1. **Constructor guard** — `expectDaoRequiresPrismaClient(YourDAO, "YourDAO")`. (The DAO constructor must throw if given no delegate; all v2 DAOs do.)
2. The `daoTestLifecycle("YOUR ENTITY")` banners.
3. At least one test per public method (see below).

When you add a **new DAO method**, cover:
1. **Happy path** — correct `where` / `include` / `data` / `orderBy` passed to Prisma, and the result is returned/shaped correctly.
2. **Each optional filter / branch** — one test per conditional (e.g. "filters by X when provided", "omits X when empty", connect-vs-disconnect, defaults applied when args omitted).
3. **Empty / not-found** behavior where the method can short-circuit (e.g. resolve-to-empty returning `{ items: [], total: 0 }` without hitting `findMany`).
4. **Pagination & ordering** if the method paginates (`skip`/`take`, `orderBy` direction, and the `count` call).
5. Add an **integration test** if the query is non-trivial (relation `some`/`every`, raw SQL, multi-table) — prove it against a real DB, not just the mock.

---

## 7. Available helpers & factories (look here before hand-rolling)

**Unit-test helpers — `tests/unit/DAO/v2/daoTestHelpers.ts`:**
- `daoTestLifecycle(name: string)` — registers the begin/complete debug banners.
- `expectDaoRequiresPrismaClient(DaoClass, daoName)` — the standard constructor-guard `describe`/`it`.

**Factories — `tests/factories/`** (prefer these over inline literals). Each entity exposes Prisma-shaped builders that return the DAO's own return type and accept an `overrides` object:
- `UserFactory.getPrismaUser(overrides?)`
- `PlayerFactory.getPrismaPlayer(overrides?)` and `getPrismaPlayerWithTeam(overrides?)`
- `TeamFactory.getPrismaTeamWithOwners(overrides?)`
- `DraftPickFactory.getPrismaPickWithTeams(overrides?)`
- `TradeFactory.getPrismaTrade(overrides?)`
- `ObanJobFactory.getMockJob(id?, state?)`
- (legacy TypeORM-model builders like `UserFactory.getUser()` also exist — use the `getPrisma*` ones for v2 DAO tests.)

**DAO-exported query shapes** (import in tests instead of re-typing the literal):
- `teamInclude` (`TeamDAO`), `draftPickInclude` (`DraftPickDAO`), `playerOwnerTeamInclude` (`PlayerDAO`).

If a builder/shape you need doesn't exist yet, **add it to the factory / export it from the DAO** rather than hand-rolling it inline — that's how the next person finds it.

---

## 8. Best practices & things to avoid

**Do**
- Mock exactly one layer down (delegate for DAO tests; DAO for controller tests).
- Reset mocks in `afterEach` (`mockClear`).
- Use factories + DAO-exported include constants so a query-shape change updates one place.
- Keep `[PRISMA] <DAO>` describe titles and `daoTestLifecycle` banners consistent — they make local log output navigable.
- Type mocks as `ExtendedPrismaClient["<model>"]`, matching how the DAO is really constructed.

**Avoid**
- ❌ Hand-rolling mock entities inline when a factory exists (or could). Drift and duplication.
- ❌ Re-declaring a DAO's `include`/`select` literal in the test — import the exported constant.
- ❌ Mocking a bare `PrismaClient` — you'll miss the extension (`isAdmin`, etc.). Use `ExtendedPrismaClient`.
- ❌ Running integration tests in parallel — always `--runInBand` (the make target does this).
- ❌ Adding mocks to integration tests — they must hit the real DB.
- ❌ Deleting a failing test. If you truly can't fix it, comment it out with an `eslint-disable` and a clear TODO explaining why and how to restore it (see `AGENTS.md`).
- ❌ Forgetting `make prisma-migrate-test` after adding a Prisma migration — integration tests will fail against a stale `test` schema.

---

## 9. Quick checklist for a new DAO

- [ ] DAO constructor throws without a delegate; `expectDaoRequiresPrismaClient` test added.
- [ ] `daoTestLifecycle("<ENTITY>")` + `[PRISMA] <DAO>` describe.
- [ ] A `getPrisma<Entity>...` factory exists (add one if not) and is used for mock data.
- [ ] Any reused `include`/`select` is a constant exported from the DAO and asserted via that import.
- [ ] Every public method: happy path + each branch + empty/not-found + pagination/order where relevant.
- [ ] Integration test added for non-trivial queries.
- [ ] `make fullcheck` passes; unit tests green (and integration green if added).
