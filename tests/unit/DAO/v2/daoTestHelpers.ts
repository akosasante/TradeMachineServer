import logger from "../../../../src/bootstrap/logger";

// Note: `jest/no-export` is disabled per-export below. This is a shared helper
// module (not a test suite); its exports are consumed by the *.test.ts files here.

/**
 * Shared helpers for the v2 DAO unit tests.
 *
 * These are imported by the `*.test.ts` files in this directory; the jest globals
 * (`beforeAll`/`afterAll`/`describe`/`it`/`expect`) are referenced lazily so they
 * resolve at call time inside a test run. This file is not itself a test suite
 * (it does not match jest's `testMatch`).
 */

/**
 * Registers the `~~~~~~PRISMA <NAME> DAO TESTS BEGIN/COMPLETE~~~~~~` debug banners
 * that make local test output easy to follow. Replaces the hand-written
 * beforeAll/afterAll pair in each DAO test file.
 *
 * @param name Upper-case entity label, e.g. "USER", "DRAFTPICK", "SYNC JOB EXECUTION".
 */
// eslint-disable-next-line jest/no-export
export function daoTestLifecycle(name: string): void {
    beforeAll(() => {
        logger.debug(`~~~~~~PRISMA ${name} DAO TESTS BEGIN~~~~~~`);
    });
    afterAll(() => {
        logger.debug(`~~~~~~PRISMA ${name} DAO TESTS COMPLETE~~~~~~`);
    });
}

/**
 * Asserts a DAO throws the standard guard error when constructed without a
 * PrismaClient model instance. Registers its own `describe`/`it` block.
 *
 * @param DaoClass The DAO class under test.
 * @param daoName  The class name as it appears in the thrown error message.
 */
// eslint-disable-next-line jest/no-export
export function expectDaoRequiresPrismaClient(
    DaoClass: new (prismaModel: undefined) => unknown,
    daoName: string
): void {
    describe("constructor", () => {
        it("should throw when initialized without a prisma client", () => {
            expect(() => new DaoClass(undefined)).toThrow(
                `${daoName} must be initialized with a PrismaClient model instance!`
            );
        });
    });
}
