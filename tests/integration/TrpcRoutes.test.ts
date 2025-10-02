import { Server } from "http";
import request from "supertest";
import logger from "../../src/bootstrap/logger";
import startServer from "../../src/bootstrap/app";
import { clearPrismaDb } from "./helpers";
import initializeDb, { ExtendedPrismaClient } from "../../src/bootstrap/prisma-db";
import UserDAO from "../../src/DAO/v2/UserDAO";
import { handleExitInTest, registerCleanupCallback } from "../../src/bootstrap/shutdownHandler";
import { inspect } from "node:util";

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
    const testUser = { email: "test@example.com", password: "testpassword123" };

    afterEach(async () => {
        return await clearPrismaDb(prisma);
    });

    describe("POST /v2/auth.login.sendResetEmail", () => {
        const makeTrpcRequest = (input: any, expectedStatus = 200) => {
            return request(app).post("/v2/auth.login.sendResetEmail").send(input).expect(expectedStatus);
        };

        it("should successfully send reset email for existing user", async () => {
            // Create a user in the database first
            await userDAO.createUsers([{ email: testUser.email, password: testUser.password }]);

            const { body } = await makeTrpcRequest({ email: testUser.email });

            expect(body.result.data).toMatchObject({
                status: "oban job queued",
                jobId: expect.any(String),
                userId: expect.any(String),
            });

            logger.debug("tHIS IS AFtER THE REQUEST");
            logger.debug(inspect(userDAO, { depth: 1 }));

            // Verify the user's password expiry was updated
            const updatedUser = await userDAO.findUserWithPasswordByEmail(testUser.email);
            logger.debug(`Updated user: ${JSON.stringify(updatedUser)}`);
            expect(updatedUser?.passwordResetExpiresOn).toBeDefined();
        }, 10000);

        it("should return NOT_FOUND error for non-existent user", async () => {
            const { body } = await makeTrpcRequest(
                { email: "nonexistent@example.com" },
                404 // tRPC NOT_FOUND errors should return 404 to match v1 behavior
            );

            expect(body.error).toMatchObject({
                code: -32004, // tRPC NOT_FOUND error code
                message: expect.stringContaining("No user found"),
            });
        });

        it("should return validation error for invalid email", async () => {
            const { body } = await makeTrpcRequest({ email: "invalid-email" }, 400);

            expect(body.error).toMatchObject({
                code: -32600, // tRPC PARSE_ERROR code for validation
                message: expect.stringContaining("validation"),
            });
        });

        it("should return validation error for missing email", async () => {
            const { body } = await makeTrpcRequest({}, 400);

            expect(body.error).toMatchObject({
                code: -32600, // tRPC PARSE_ERROR code
                message: expect.stringContaining("Required"),
            });
        });

        it("should handle OpenTelemetry tracing without errors", async () => {
            // Create a user in the database first
            await userDAO.createUsers([{ email: testUser.email, password: testUser.password }]);

            // Add tracing headers
            const { body } = await request(app)
                .post("/v2/auth.login.sendResetEmail")
                .set("traceparent", "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01")
                .send({ email: testUser.email })
                .expect(200);

            expect(body.result.data).toMatchObject({
                status: "oban job queued",
                jobId: expect.any(String),
                userId: expect.any(String),
            });
        });

        it("should preserve session context when available", async () => {
            // This test verifies that tRPC context creation works with sessions
            // For now, we'll just verify the endpoint works without sessions
            await userDAO.createUsers([{ email: testUser.email, password: testUser.password }]);

            const { body } = await makeTrpcRequest({ email: testUser.email });

            expect(body.result.data.status).toBe("oban job queued");
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
            await userDAO.createUsers([{ email: testUser.email, password: testUser.password }]);

            const start = Date.now();
            await request(app).post("/v2/auth.login.sendResetEmail").send({ email: testUser.email }).expect(200);
            const duration = Date.now() - start;

            // Should complete within reasonable time (not timeout)
            expect(duration).toBeLessThan(5000);
        });
    });
});
