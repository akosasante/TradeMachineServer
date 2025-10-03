import { Server } from "http";
import request from "supertest";
import logger from "../../../src/bootstrap/logger";
import startServer from "../../../src/bootstrap/app";
import { clearPrismaDb } from "../helpers";
import initializeDb, { ExtendedPrismaClient } from "../../../src/bootstrap/prisma-db";
import { handleExitInTest, registerCleanupCallback } from "../../../src/bootstrap/shutdownHandler";

let app: Server;
let prisma: ExtendedPrismaClient;

async function shutdown() {
    try {
        await handleExitInTest();
    } catch (err) {
        logger.error(`Error while shutting down: ${err}`);
    }
}

beforeAll(async () => {
    logger.debug("~~~~~~TrPC Client ROUTES BEFORE ALL~~~~~~");
    app = await startServer();
    // Initialize Prisma first, independently of server startup
    prisma = initializeDb(process.env.DB_LOGS === "true");
    registerCleanupCallback(async () => {
        await prisma.$disconnect();
    });
    return app;
});

afterAll(async () => {
    logger.debug("~~~~~~TRPC Client ROUTES AFTER ALL~~~~~~");
    const shutdownResult = await shutdown();
    if (app) {
        app.close(() => {
            logger.debug("CLOSED SERVER");
        });
    }
    return shutdownResult;
});

describe("Client API endpoints", () => {
    afterEach(async () => {
        return await clearPrismaDb(prisma);
    });

    describe("Client Router", () => {
        describe("GET /v2/client.getIP", () => {
            const makeTrpcRequest = (headers: Record<string, string> = {}, expectedStatus = 200) => {
                return request(app).get("/v2/client.getIP").set(headers).expect(expectedStatus);
            };

            it("should return IP from x-forwarded-for header", async () => {
                const { body } = await makeTrpcRequest({
                    "x-forwarded-for": "203.0.113.1",
                });

                expect(body.result.data).toMatchObject({
                    ip: "203.0.113.1",
                });
            });

            it("should return first IP from x-forwarded-for with multiple IPs", async () => {
                const { body } = await makeTrpcRequest({
                    "x-forwarded-for": "203.0.113.1, 198.51.100.1, 192.0.2.1",
                });

                expect(body.result.data).toMatchObject({
                    ip: "203.0.113.1",
                });
            });

            it("should return IP from x-real-ip header when x-forwarded-for is missing", async () => {
                const { body } = await makeTrpcRequest({
                    "x-real-ip": "198.51.100.1",
                });

                expect(body.result.data).toMatchObject({
                    ip: "198.51.100.1",
                });
            });

            it("should return direct connection IP when proxy headers are missing", async () => {
                const { body } = await makeTrpcRequest();

                expect(body.result.data).toHaveProperty("ip");
                expect(body.result.data.ip).toBeTruthy();
                // We can't assert exact IP since it depends on test environment
                expect(typeof body.result.data.ip).toBe("string");
            });

            it("should prefer x-forwarded-for over x-real-ip", async () => {
                const { body } = await makeTrpcRequest({
                    "x-forwarded-for": "203.0.113.1",
                    "x-real-ip": "198.51.100.1",
                });

                expect(body.result.data).toMatchObject({
                    ip: "203.0.113.1",
                });
            });
        });
    });
});
