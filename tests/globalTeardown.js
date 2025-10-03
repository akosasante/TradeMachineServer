/**
 * Global teardown that runs ONCE after all test files complete.
 * This ensures shared infrastructure (Redis, Prisma, server) is properly cleaned up
 * without interfering with test execution across multiple files.
 */
module.exports = async function globalTeardown() {
    // Import using require since this runs in Node's module system
    const { handleExitInTest } = require("../src/bootstrap/shutdownHandler");
    const logger = require("../src/bootstrap/logger").default;

    logger.info("Running global teardown after all tests");
    await handleExitInTest();
    logger.info("Global teardown complete");
};
