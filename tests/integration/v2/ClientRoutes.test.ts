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

        describe("POST /v2/client.exchangeRedirectToken", () => {
            const makeTrpcRequest = (input: any, headers: Record<string, string> = {}, expectedStatus = 200) => {
                return request(app)
                    .post("/v2/client.exchangeRedirectToken")
                    .set(headers)
                    .send(input)
                    .expect(expectedStatus);
            };

            it("should successfully exchange a valid token and create new session", async () => {
                // Create a user first with hashed password
                const hashedPassword = hashSync(testUser.password, 1);
                await userDAO.createUsers([{ email: testUser.email, password: hashedPassword }]);

                // Create first session and generate token (simulate old client)
                const agent1 = request.agent(app);
                await agent1
                    .post("/v2/auth.login.authenticate")
                    .send({
                        email: testUser.email,
                        password: testUser.password,
                    })
                    .expect(200);

                // Create redirect token
                const { body: tokenResponse } = await agent1
                    .post("/v2/client.createRedirectToken")
                    .send({
                        redirectTo: "https://ffftemp.akosua.xyz/dashboard",
                        origin: "https://staging.trades.akosua.xyz",
                    })
                    .expect(200);

                // Exchange token (simulate new client)
                const { body } = await makeTrpcRequest(
                    {
                        token: tokenResponse.result.data.token,
                    },
                    {
                        Origin: "https://ffftemp.akosua.xyz",
                    }
                );

                // Validate response structure
                expect(body.result.data).toMatchObject({
                    success: true,
                    user: expect.objectContaining({
                        id: expect.any(String),
                        email: testUser.email,
                        role: expect.any(String),
                    }),
                });

                // Verify user object has expected structure and doesn't expose sensitive data
                expect(body.result.data.user).toHaveProperty("id");
                expect(body.result.data.user).toHaveProperty("email", testUser.email);
                expect(body.result.data.user).toHaveProperty("role");
                expect(body.result.data.user).not.toHaveProperty("password");

                // passwordResetToken should be null/falsy for security (field might be present but empty)
                expect(body.result.data.user.passwordResetToken).toBeFalsy();
            });

            it("should create session mapping between original and new sessions", async () => {
                // Create a user first with hashed password
                const hashedPassword = hashSync(testUser.password, 1);
                await userDAO.createUsers([{ email: testUser.email, password: hashedPassword }]);

                // Create first session and generate token
                const agent1 = request.agent(app);
                await agent1
                    .post("/v2/auth.login.authenticate")
                    .send({
                        email: testUser.email,
                        password: testUser.password,
                    })
                    .expect(200);

                // Create redirect token
                const { body: tokenResponse } = await agent1
                    .post("/v2/client.createRedirectToken")
                    .send({
                        redirectTo: "https://ffftemp.akosua.xyz/dashboard",
                        origin: "https://staging.trades.akosua.xyz",
                    })
                    .expect(200);

                // Exchange token with new agent (simulate new client)
                const agent2 = request.agent(app);
                await agent2
                    .post("/v2/client.exchangeRedirectToken")
                    .set("Origin", "https://ffftemp.akosua.xyz")
                    .send({
                        token: tokenResponse.result.data.token,
                    })
                    .expect(200);

                // Verify both sessions are valid and authenticated
                await agent1.get("/v2/auth.sessionCheck").expect(200);
                await agent2.get("/v2/auth.sessionCheck").expect(200);

                // Verify session mapping works by logging out from first session
                await agent1.post("/v2/auth.logout").send({}).expect(200);

                // Both sessions should now be invalid
                const check1 = await agent1.get("/v2/auth.sessionCheck").expect(401);
                const check2 = await agent2.get("/v2/auth.sessionCheck").expect(401);
                expect(check1.status).toBe(401);
                expect(check2.status).toBe(401);
            });

            it("should return BAD_REQUEST error for invalid token format", async () => {
                const { body } = await makeTrpcRequest(
                    {
                        token: "invalid-token-format",
                    },
                    {
                        Origin: "https://ffftemp.akosua.xyz",
                    },
                    400
                );

                expect(body.error).toMatchObject({
                    code: -32600, // tRPC PARSE_ERROR for validation errors
                });
            });

            it("should return BAD_REQUEST error for non-existent or expired token", async () => {
                // Use a valid format but non-existent token
                const fakeToken = "a".repeat(64); // 64 character hex string

                const { body } = await makeTrpcRequest(
                    {
                        token: fakeToken,
                    },
                    {
                        Origin: "https://ffftemp.akosua.xyz",
                    },
                    400
                );

                expect(body.error).toMatchObject({
                    code: -32600, // tRPC BAD_REQUEST
                    message: "Invalid or expired token",
                });
            });

            it("should return BAD_REQUEST error for invalid request host", async () => {
                // Create a user and token first
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

                const { body: tokenResponse } = await agent
                    .post("/v2/client.createRedirectToken")
                    .send({
                        redirectTo: "https://ffftemp.akosua.xyz/dashboard",
                        origin: "https://staging.trades.akosua.xyz",
                    })
                    .expect(200);

                // Try to exchange token from invalid host
                const { body } = await makeTrpcRequest(
                    {
                        token: tokenResponse.result.data.token,
                    },
                    {
                        Origin: "https://malicious-site.com",
                    },
                    400
                );

                expect(body.error).toMatchObject({
                    code: -32600, // tRPC BAD_REQUEST
                    message: "Invalid request host",
                });
            });

            it("should return BAD_REQUEST error when original session has expired", async () => {
                // Create a user first
                const hashedPassword = hashSync(testUser.password, 1);
                await userDAO.createUsers([{ email: testUser.email, password: hashedPassword }]);

                // Create session and token
                const agent = request.agent(app);
                await agent
                    .post("/v2/auth.login.authenticate")
                    .send({
                        email: testUser.email,
                        password: testUser.password,
                    })
                    .expect(200);

                const { body: tokenResponse } = await agent
                    .post("/v2/client.createRedirectToken")
                    .send({
                        redirectTo: "https://ffftemp.akosua.xyz/dashboard",
                        origin: "https://staging.trades.akosua.xyz",
                    })
                    .expect(200);

                // Manually logout to invalidate the original session
                await agent.post("/v2/auth.logout").send({}).expect(200);

                // Try to exchange token - should fail because original session is gone
                const { body } = await makeTrpcRequest(
                    {
                        token: tokenResponse.result.data.token,
                    },
                    {
                        Origin: "https://ffftemp.akosua.xyz",
                    },
                    400
                );

                expect(body.error).toMatchObject({
                    code: -32600, // tRPC BAD_REQUEST
                    message: "Original session not found or expired",
                });
            });

            it("should work with all allowed request hosts", async () => {
                const hashedPassword = hashSync(testUser.password, 1);
                await userDAO.createUsers([{ email: testUser.email, password: hashedPassword }]);

                // Test with different allowed hosts from SSO_CONFIG.ALLOWED_REDIRECT_HOSTS
                const allowedOrigins = [
                    "https://ffftemp.akosua.xyz",
                    "https://ffftemp.netlify.app",
                    "https://trades.flexfoxfantasy.com",
                    "https://staging.trades.akosua.xyz",
                ];

                for (const origin of allowedOrigins) {
                    // Create fresh session and token for each test
                    const agent = request.agent(app);
                    await agent
                        .post("/v2/auth.login.authenticate")
                        .send({
                            email: testUser.email,
                            password: testUser.password,
                        })
                        .expect(200);

                    const { body: tokenResponse } = await agent
                        .post("/v2/client.createRedirectToken")
                        .send({
                            redirectTo: `${origin}/dashboard`,
                            origin: "https://staging.trades.akosua.xyz",
                        })
                        .expect(200);

                    // Exchange token from the specified origin
                    const { body } = await makeTrpcRequest(
                        {
                            token: tokenResponse.result.data.token,
                        },
                        {
                            Origin: origin,
                        }
                    );

                    expect(body.result.data).toMatchObject({
                        success: true,
                        user: expect.objectContaining({
                            email: testUser.email,
                        }),
                    });
                }
            });

            it("should consume token only once (single-use verification)", async () => {
                // Create a user first
                const hashedPassword = hashSync(testUser.password, 1);
                await userDAO.createUsers([{ email: testUser.email, password: hashedPassword }]);

                // Create session and token
                const agent = request.agent(app);
                await agent
                    .post("/v2/auth.login.authenticate")
                    .send({
                        email: testUser.email,
                        password: testUser.password,
                    })
                    .expect(200);

                const { body: tokenResponse } = await agent
                    .post("/v2/client.createRedirectToken")
                    .send({
                        redirectTo: "https://ffftemp.akosua.xyz/dashboard",
                        origin: "https://staging.trades.akosua.xyz",
                    })
                    .expect(200);

                const token = tokenResponse.result.data.token;

                // First exchange should succeed
                await makeTrpcRequest({ token }, { Origin: "https://ffftemp.akosua.xyz" });

                // Second exchange with same token should fail
                const { body } = await makeTrpcRequest({ token }, { Origin: "https://ffftemp.akosua.xyz" }, 400);

                expect(body.error).toMatchObject({
                    code: -32600, // tRPC BAD_REQUEST
                    message: "Invalid or expired token",
                });
            });
        });

        describe("POST /v2/auth.logout", () => {
            const makeTrpcRequest = (agent: request.SuperAgentTest, expectedStatus = 200) => {
                return agent.post("/v2/auth.logout").send({}).expect(expectedStatus);
            };

            it("should successfully logout all user sessions", async () => {
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

                // Call logout - should destroy all sessions for this user
                const { body } = await makeTrpcRequest(agent);

                // Validate response structure - logout returns boolean true
                expect(body.result.data).toBe(true);

                // Verify session is now invalid
                await agent.get("/v2/auth.sessionCheck").expect(401);
            });

            it("should return success even when user is not authenticated", async () => {
                // logout is publicProcedure, so it should succeed even without auth
                const { body } = await request(app).post("/v2/auth.logout").send({}).expect(200);
                expect(body.result.data).toBe(true);
            });

            it("should destroy sessions across domains (session mapping scenario)", async () => {
                // Create a user first with hashed password
                const hashedPassword = hashSync(testUser.password, 1);
                await userDAO.createUsers([{ email: testUser.email, password: hashedPassword }]);

                // Create first session (simulate old client)
                const agent1 = request.agent(app);
                await agent1
                    .post("/v2/auth.login.authenticate")
                    .send({
                        email: testUser.email,
                        password: testUser.password,
                    })
                    .expect(200);

                // Create redirect token from first session
                const { body: tokenResponse } = await agent1
                    .post("/v2/client.createRedirectToken")
                    .send({
                        redirectTo: "https://ffftemp.akosua.xyz/dashboard",
                        origin: "https://staging.trades.akosua.xyz",
                    })
                    .expect(200);

                // Create second session by exchanging token (simulate new client)
                const agent2 = request.agent(app);
                await agent2
                    .post("/v2/client.exchangeRedirectToken")
                    .set("Origin", "https://ffftemp.akosua.xyz")
                    .send({
                        token: tokenResponse.result.data.token,
                    })
                    .expect(200);

                // Verify both agents are authenticated before logout
                await agent1.get("/v2/auth.sessionCheck").expect(200);
                await agent2.get("/v2/auth.sessionCheck").expect(200);

                // Logout from first session (old client) - should destroy both sessions
                await makeTrpcRequest(agent1);

                // Verify both sessions are now invalid
                const check1 = await agent1.get("/v2/auth.sessionCheck").expect(401);
                const check2 = await agent2.get("/v2/auth.sessionCheck").expect(401);
                expect(check1.status).toBe(401);
                expect(check2.status).toBe(401);
            });

            it("should handle logout when only one session exists", async () => {
                // Create a user first with hashed password
                const hashedPassword = hashSync(testUser.password, 1);
                await userDAO.createUsers([{ email: testUser.email, password: hashedPassword }]);

                // Create an agent to persist session cookies
                const agent = request.agent(app);

                // Authenticate to create session (without any token exchange)
                await agent
                    .post("/v2/auth.login.authenticate")
                    .send({
                        email: testUser.email,
                        password: testUser.password,
                    })
                    .expect(200);

                // Call logout
                const { body } = await makeTrpcRequest(agent);

                // Should return true
                expect(body.result.data).toBe(true);

                // Verify session is now invalid
                await agent.get("/v2/auth.sessionCheck").expect(401);
            });
        });
    });
});
