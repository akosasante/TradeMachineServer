import { handleExitInTest } from "../src/bootstrap/shutdownHandler.js";
import logger from "../src/bootstrap/logger.js";

/**
 * Global teardown that runs ONCE after all test files complete.
 * This ensures shared infrastructure (Redis, Prisma, server) is properly cleaned up
 * without interfering with test execution across multiple files.
 */
export default async function globalTeardown() {
    logger.info("Running global teardown after all tests");
    await handleExitInTest();
    logger.info("Global teardown complete");
}