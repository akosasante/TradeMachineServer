/**
 * DEPRECATED: This file is no longer used.
 *
 * The cleanup logic has been moved to tests/setupAfterEnv.ts which runs via
 * setupFilesAfterEnv in jest.config.js. This solves the module isolation issue
 * where this file (running in a separate Node process) would load different
 * module instances than the tests used, causing cleanup callbacks to be empty.
 *
 * This file is kept for reference. You can safely delete it.
 *
 * ---
 * Original description:
 * Global teardown that runs ONCE after all test files complete.
 * This ensures shared infrastructure (Redis, Prisma, server) is properly cleaned up
 * without interfering with test execution across multiple files.
 *
 * Note: This file runs in Node's native module system (not Jest's TypeScript environment),
 * so it must require compiled JS files from dist/ instead of TypeScript source files.
 */
module.exports = async function globalTeardown() {
    // No-op: cleanup is now handled by tests/setupAfterEnv.ts
};
