/**
 * Jest setup file that runs in the same process as tests (via setupFilesAfterEnv).
 * This ensures cleanup callbacks are executed on the same module instances that tests used,
 * solving the module isolation issue that occurred with globalTeardown.js.
 *
 * Since integration tests run with --runInBand (sequential, single process),
 * this cleanup runs after each test file but safely shares state across all files.
 */
import { handleExitInTest } from "../src/bootstrap/shutdownHandler";
import { clearJobMetricsIntervals } from "../src/scheduled_jobs/metrics";
import logger from "../src/bootstrap/logger";

afterAll(async () => {
    logger.info("Running test cleanup (setupAfterEnv)");
    clearJobMetricsIntervals();
    await handleExitInTest();
    logger.info("Test cleanup complete");
});
