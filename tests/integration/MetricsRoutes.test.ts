import { Server } from "http";
import request from "supertest";
import "jest-extended";
import logger from "../../src/bootstrap/logger";
import startServer from "../../src/bootstrap/app";
import { clearPrismaDb } from "./helpers";
import { handleExitInTest, registerCleanupCallback } from "../../src/bootstrap/shutdownHandler";
import initializeDb from "../../src/bootstrap/prisma-db";
import { PrismaClient } from "@prisma/client";
import { EmailPublisher } from "../../src/email/publishers";
import UserDAO from "../../src/DAO/UserDAO";

let app: Server;
let prismaConn: PrismaClient;

async function shutdown() {
    try {
        await handleExitInTest();
    } catch (err) {
        logger.error(`Error while closing redis: ${err}`);
    }
}

beforeAll(async () => {
    logger.debug("~~~~~~METRICS ROUTES BEFORE ALL~~~~~~");
    app = await startServer();
    prismaConn = initializeDb(process.env.DB_LOGS === "true");
    registerCleanupCallback(async () => {
        await prismaConn.$disconnect();
    });
    return app;
}, 15000);

afterAll(async () => {
    logger.debug("~~~~~~METRICS ROUTES AFTER ALL~~~~~~");
    const shutdownResult = await shutdown();
    if (app) {
        app.close(() => {
            logger.debug("CLOSED SERVER");
        });
    }
    return shutdownResult;
});

describe("Metrics API endpoint", () => {
    afterEach(async () => {
        return await clearPrismaDb(prismaConn);
    });

    describe("GET /metrics", () => {
        it("should return metrics data with prometheus format", async () => {
            const metricsResponse = await request(app)
                .get("/metrics")
                .expect(200)
                .expect("Content-Type", /text\/plain/);

            expect(metricsResponse.text).toContain("# HELP process_");
            expect(metricsResponse.text).toContain("# HELP nodejs_");
            expect(metricsResponse.text).toContain("# HELP jobs_waiting");
        });

        it("should track HTTP metrics between requests", async () => {
            const initialMetricsResponse = await request(app).get("/metrics").expect(200);

            const initialHttpRequestCount = getHttpRequestCount(initialMetricsResponse.text);

            await request(app).get("/v2/users");
            await request(app).get("/v2/users");
            await request(app).get("/").expect(404); // Missing endpoint to test error metrics

            const updatedMetricsResponse = await request(app).get("/metrics").expect(200);

            const updatedHttpRequestCount = getHttpRequestCount(updatedMetricsResponse.text);

            expect(updatedHttpRequestCount).toBeGreaterThan(initialHttpRequestCount);
            expect(updatedHttpRequestCount).toBe(5);
        });

        it("should include Prisma metrics after database operations", async () => {
            // Get initial metrics
            const initialMetricsResponse = await request(app).get("/metrics").expect(200);

            // Check if we already have Prisma metrics
            expect(initialMetricsResponse.text).toContain("prisma_client_queries_");

            await request(app).get("/v2/users");

            // Get updated metrics
            const updatedMetricsResponse = await request(app).get("/metrics").expect(200);

            // Check that Prisma metrics are included
            expect(updatedMetricsResponse.text).toContain("prisma_client_queries_");

            const initialQueryCount = getPrismaQueryCount(initialMetricsResponse.text);
            const updatedQueryCount = getPrismaQueryCount(updatedMetricsResponse.text);
            expect(updatedQueryCount).toBeGreaterThan(initialQueryCount);
        });

        it("should include job metrics after job processing", async () => {
            // Get initial metrics
            const initialMetricsResponse = await request(app).get("/metrics").expect(200);

            // Check if job metrics are present
            expect(initialMetricsResponse.text).toContain("jobs_waiting");

            const emailQueue = EmailPublisher.getInstance();
            await prismaConn.user.create({ data: { email: "fake" } });
            const user = await new UserDAO().findUser({ email: "fake" });
            if (user) {
                await emailQueue.queueRegistrationEmail(user);
            }

            // sleep half a second to allow job to be processed
            await new Promise(resolve => setTimeout(resolve, 500));

            // Get updated metrics
            const updatedMetricsResponse = await request(app).get("/metrics").expect(200);

            // Check that job metrics are included
            expect(updatedMetricsResponse.text).toContain("jobs_waiting");

            const initialJobCount = parseInt(
                /jobs_waiting\{queue_name="test_email_queue",job_name="registration_email"\}\s+(\d+)/.exec(
                    initialMetricsResponse.text
                )?.[1] || "0",
                10
            );
            const updatedJobCount = parseInt(
                /jobs_waiting\{queue_name="test_email_queue",job_name="registration_email"\}\s+(\d+)/.exec(
                    updatedMetricsResponse.text
                )?.[1] || "0",
                10
            );
            expect(updatedJobCount).toBeGreaterThan(initialJobCount);
        });
    });
});

/**
 * Helper function to extract the total HTTP request count from metrics output
 */
function getHttpRequestCount(metricsText: string): number {
    const matches = [...metricsText.matchAll(/http_request_duration_seconds_count{[^}]*}\s+(\d+)/g)];
    return matches.reduce((sum, match) => sum + parseInt(match[1], 10), 0);
}

/**
 * Helper function to extract the total Prisma query count from metrics output
 */
function getPrismaQueryCount(metricsText: string): number {
    const match = /prisma_client_queries_total\s+(\d+)/.exec(metricsText);
    return match ? parseInt(match[1], 10) : 0;
}
