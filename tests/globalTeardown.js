/**
 * Global teardown that runs ONCE after all test files complete.
 * This ensures shared infrastructure (Redis, Prisma, server) is properly cleaned up
 * without interfering with test execution across multiple files.
 *
 * Note: This file runs in Node's native module system (not Jest's TypeScript environment),
 * so it must require compiled JS files from dist/ instead of TypeScript source files.
 */
module.exports = async function globalTeardown() {
    // Require compiled JS files from dist/ since this runs outside Jest's TypeScript compilation
    const { handleExitInTest } = require("../dist/bootstrap/shutdownHandler");
    const logger = require("../dist/bootstrap/logger").default;

    logger.info("Running global teardown after all tests");
    await handleExitInTest();
    logger.info("Global teardown complete");
};
