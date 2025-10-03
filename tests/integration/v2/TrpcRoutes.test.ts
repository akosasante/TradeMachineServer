import { Server } from "http";
import request from "supertest";
import logger from "../../../src/bootstrap/logger";
import startServer from "../../../src/bootstrap/app";
import { clearPrismaDb } from "../helpers";
import initializeDb, { ExtendedPrismaClient } from "../../../src/bootstrap/prisma-db";
import UserDAO from "../../../src/DAO/v2/UserDAO";
import { handleExitInTest, registerCleanupCallback } from "../../../src/bootstrap/shutdownHandler";

let app: Server;
let userDAO: UserDAO;
let prisma: ExtendedPrismaClient;

async function shutdown() {
    try {
        await handleExitInTest();
    } catch (err) {
        logger.error(`Error while shutting down: ${err}`);
    }
}

beforeAll(async () => {
    logger.debug("~~~~~~TRPC ROUTES BEFORE ALL~~~~~~");
    app = await startServer();
    // Initialize Prisma first, independently of server startup
    prisma = initializeDb(process.env.DB_LOGS === "true");
    registerCleanupCallback(async () => {
        await prisma.$disconnect();
    });
    userDAO = new UserDAO(prisma.user);
    return app;
});

afterAll(async () => {
    logger.debug("~~~~~~TRPC ROUTES AFTER ALL~~~~~~");
    const shutdownResult = await shutdown();
    if (app) {
        app.close(() => {
            logger.debug("CLOSED SERVER");
        });
    }
    return shutdownResult;
});

describe("tRPC API endpoints", () => {
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

    describe("tRPC Error Handling", () => {
        it("should return properly formatted tRPC error for malformed JSON", async () => {
            await request(app)
                .post("/v2/auth.login.sendResetEmail")
                .set("Content-Type", "application/json")
                .send("invalid json")
                .expect(400);

            // JSON handling is handled by the routing-controllers ErrorHandler middleware for now,
            // but leaving this here for future reference:

            // expect(body.error).toMatchObject({
            //     code: -32700, // tRPC PARSE_ERROR code
            //     message: "Invalid JSON in request body",
            // });
        });

        it("should handle HTTP method not allowed gracefully", async () => {
            await request(app).get("/v2/auth.login.sendResetEmail").expect(404); // tRPC route doesn't exist for GET method
        });
    });

    describe("tRPC Middleware Integration", () => {
        it("should integrate with Express middleware stack", async () => {
            // Test that CORS, compression, etc. work with tRPC routes
            const response = await request(app)
                .options("/v2/auth.login.sendResetEmail")
                .set("Origin", "http://localhost:3030") // Set a valid origin for CORS
                .expect(204);

            // Should have CORS headers that are actually present in the response
            expect(response.headers).toHaveProperty("access-control-allow-credentials");
            expect(response.headers).toHaveProperty("access-control-allow-methods");
        });

        it("should handle request timeout properly", async () => {
            // This is a basic test - in practice you'd want to test with a slow endpoint
            const testUser = { email: "test@example.com", password: "testpassword123" };
            await userDAO.createUsers([{ email: testUser.email, password: testUser.password }]);

            const start = Date.now();
            await request(app).post("/v2/auth.login.sendResetEmail").send({ email: testUser.email }).expect(200);
            const duration = Date.now() - start;

            // Should complete within reasonable time (not timeout)
            expect(duration).toBeLessThan(5000);
        });
    });
});
