import { Server } from "http";
import request from "supertest";
import { hashSync } from "bcryptjs";
import logger from "../../../src/bootstrap/logger";
import startServer from "../../../src/bootstrap/app";
import { clearPrismaDb } from "../helpers";
import initializeDb, { ExtendedPrismaClient } from "../../../src/bootstrap/prisma-db";
import { handleExitInTest, registerCleanupCallback } from "../../../src/bootstrap/shutdownHandler";
import UserDAO from "../../../src/DAO/v2/UserDAO";

let app: Server;
let prisma: ExtendedPrismaClient;
let userDAO: UserDAO;

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
    userDAO = new UserDAO(prisma.user);
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
    const testUser = { email: "test@example.com", password: "testpassword123" };

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

        describe("POST /v2/client.createRedirectToken", () => {
            const makeTrpcRequest = (agent: request.SuperAgentTest, input: any, expectedStatus = 200) => {
                return agent.post("/v2/client.createRedirectToken").send(input).expect(expectedStatus);
            };

            it("should successfully create redirect token for authenticated user with valid redirect host", async () => {
                // Create a user first with hashed password
                const hashedPassword = hashSync(testUser.password, 1);
                await userDAO.createUsers([{ email: testUser.email, password: hashedPassword }]);

                // Create an agent to persist session cookies
                const agent = request.agent(app);

                // Authenticate to create session
                await agent
                    .post("/v2/auth.login.authenticate")
                    .send({
                        email: testUser.email,
                        password: testUser.password,
                    })
                    .expect(200);

                // Now create redirect token with valid input
                const redirectTo = "https://trades.flexfoxfantasy.com/dashboard";
                const origin = "https://staging.trades.akosua.xyz";

                const { body } = await makeTrpcRequest(agent, {
                    redirectTo,
                    origin,
                });

                // Validate response structure
                expect(body.result.data).toMatchObject({
                    token: expect.any(String),
                    redirectTo,
                    expiresIn: 60, // SSO_CONFIG.TRANSFER_TOKEN_TTL_SECONDS
                });

                // Validate token format (64 character hex string)
                expect(body.result.data.token).toMatch(/^[0-9a-f]{64}$/);
                expect(body.result.data.token).toHaveLength(64);
            });

            it("should return UNAUTHORIZED error when user is not authenticated", async () => {
                const redirectTo = "https://trades.flexfoxfantasy.com/dashboard";
                const origin = "https://staging.trades.akosua.xyz";

                const { body } = await request(app)
                    .post("/v2/client.createRedirectToken")
                    .send({
                        redirectTo,
                        origin,
                    })
                    .expect(401);

                expect(body.error).toMatchObject({
                    code: -32001, // tRPC UNAUTHORIZED error code
                    message: "Authentication required",
                });
            });

            it("should return BAD_REQUEST error for invalid redirect host", async () => {
                // Create and authenticate a user first
                const hashedPassword = hashSync(testUser.password, 1);
                await userDAO.createUsers([{ email: testUser.email, password: hashedPassword }]);

                const agent = request.agent(app);
                await agent
                    .post("/v2/auth.login.authenticate")
                    .send({
                        email: testUser.email,
                        password: testUser.password,
                    })
                    .expect(200);

                // Try to create token with invalid redirect host
                const invalidRedirectTo = "https://malicious-site.com/dashboard";
                const origin = "https://staging.trades.akosua.xyz";

                const { body } = await makeTrpcRequest(
                    agent,
                    {
                        redirectTo: invalidRedirectTo,
                        origin,
                    },
                    400
                );

                expect(body.error).toMatchObject({
                    code: -32600, // tRPC INTERNAL_SERVER_ERROR error code
                    message: "Invalid redirect host",
                });
            });

            it("should return BAD_REQUEST error for invalid URL format", async () => {
                // Create and authenticate a user first
                const hashedPassword = hashSync(testUser.password, 1);
                await userDAO.createUsers([{ email: testUser.email, password: hashedPassword }]);

                const agent = request.agent(app);
                await agent
                    .post("/v2/auth.login.authenticate")
                    .send({
                        email: testUser.email,
                        password: testUser.password,
                    })
                    .expect(200);

                // Try to create token with invalid URL format
                const invalidRedirectTo = "not-a-valid-url";
                const origin = "https://staging.trades.akosua.xyz";

                const { body } = await makeTrpcRequest(
                    agent,
                    {
                        redirectTo: invalidRedirectTo,
                        origin,
                    },
                    400
                );

                expect(body.error).toMatchObject({
                    code: -32600, // tRPC PARSE_ERROR error code for validation errors
                });
            });

            it("should work with different allowed redirect hosts", async () => {
                // Create and authenticate a user first
                const hashedPassword = hashSync(testUser.password, 1);
                await userDAO.createUsers([{ email: testUser.email, password: hashedPassword }]);

                const agent = request.agent(app);
                await agent
                    .post("/v2/auth.login.authenticate")
                    .send({
                        email: testUser.email,
                        password: testUser.password,
                    })
                    .expect(200);

                // Test with different allowed hosts from SSO_CONFIG.ALLOWED_REDIRECT_HOSTS
                const allowedHosts = [
                    "https://trades.flexfoxfantasy.com/page",
                    "https://staging.trades.akosua.xyz/dashboard",
                    "https://ffftemp.akosua.xyz/login",
                    "https://ffftemp.netlify.app/home",
                ];

                for (const redirectTo of allowedHosts) {
                    const { body } = await makeTrpcRequest(agent, {
                        redirectTo,
                        origin: "https://staging.trades.akosua.xyz",
                    });

                    expect(body.result.data).toMatchObject({
                        token: expect.any(String),
                        redirectTo,
                        expiresIn: 60,
                    });

                    // Each token should be unique
                    expect(body.result.data.token).toMatch(/^[0-9a-f]{64}$/);
                }
            });
        });
    });
});
