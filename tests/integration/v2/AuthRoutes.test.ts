import { Server } from "http";
import request from "supertest";
import { hashSync } from "bcryptjs";
import logger from "../../../src/bootstrap/logger";
import startServer from "../../../src/bootstrap/app";
import { clearPrismaDb } from "../helpers";
import initializeDb, { ExtendedPrismaClient } from "../../../src/bootstrap/prisma-db";
import UserDAO from "../../../src/DAO/v2/UserDAO";
import { handleExitInTest } from "../../../src/bootstrap/shutdownHandler";

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
    logger.debug("~~~~~~TRPC AUTH ROUTES BEFORE ALL~~~~~~");
    app = await startServer();
    prisma = initializeDb(process.env.DB_LOGS === "true");
    userDAO = new UserDAO(prisma.user);
    return app;
});

afterAll(async () => {
    logger.debug("~~~~~~TRPC AUTH ROUTES AFTER ALL~~~~~~");
    const shutdownResult = await shutdown();
    if (app) {
        app.close(() => {
            logger.debug("CLOSED SERVER");
        });
    }
    return shutdownResult;
});

describe("tRPC Auth endpoints", () => {
    const testUser = { email: "test@example.com", password: "testpassword123" };

    afterEach(async () => {
        return await clearPrismaDb(prisma);
    });

    describe("POST /v2/auth.login.authenticate", () => {
        const makeTrpcRequest = (input: any, expectedStatus = 200) => {
            return request(app).post("/v2/auth.login.authenticate").send(input).expect(expectedStatus);
        };

        it("should successfully authenticate user with valid credentials", async () => {
            // Create a user first with hashed password
            const hashedPassword = hashSync(testUser.password, 1);
            const createdUsers = await userDAO.createUsers([{ email: testUser.email, password: hashedPassword }]);
            const userId = createdUsers[0].id;

            const { body } = await makeTrpcRequest({
                email: testUser.email,
                password: testUser.password,
            });

            expect(body.result.data).toMatchObject({
                id: userId,
                email: testUser.email,
            });
        });

        it("should return UNAUTHORIZED error for invalid credentials", async () => {
            // Create a user first with hashed password
            const hashedPassword = hashSync(testUser.password, 1);
            await userDAO.createUsers([{ email: testUser.email, password: hashedPassword }]);

            const { body } = await makeTrpcRequest(
                {
                    email: testUser.email,
                    password: "wrongpassword",
                },
                401
            );

            expect(body.error).toMatchObject({
                code: -32001, // tRPC UNAUTHORIZED error code
                message: expect.stringContaining("Incorrect password"),
            });
        });

        it("should return UNAUTHORIZED error for non-existent user", async () => {
            const { body } = await makeTrpcRequest(
                {
                    email: "nonexistent@example.com",
                    password: "somepassword",
                },
                401
            );

            expect(body.error).toMatchObject({
                code: -32001, // tRPC UNAUTHORIZED error code
                message: expect.stringContaining("no user found"),
            });
        });

        it("should return validation error for invalid email", async () => {
            const { body } = await makeTrpcRequest({ email: "invalid-email", password: "testpassword" }, 400);

            expect(body.error).toMatchObject({
                code: -32600, // tRPC PARSE_ERROR code for validation
                message: expect.stringContaining("Please provide a valid email address"),
            });
        });

        it("should return validation error for missing password", async () => {
            const { body } = await makeTrpcRequest({ email: testUser.email, password: "" }, 400);

            expect(body.error).toMatchObject({
                code: -32600, // tRPC PARSE_ERROR code
                message: expect.stringContaining("Password is required"),
            });
        });
    });

    describe("POST /v2/auth.login.sendResetEmail", () => {
        const makeTrpcRequest = (input: any, expectedStatus = 200) => {
            return request(app).post("/v2/auth.login.sendResetEmail").send(input).expect(expectedStatus);
        };

        it("should successfully send reset email for existing user", async () => {
            // Create a user in the database first
            const [returnedUser] = await userDAO.createUsers([{ email: testUser.email, password: testUser.password }]);
            expect(returnedUser?.passwordResetExpiresOn).toBeNull();
            expect(returnedUser?.passwordResetToken).toBeNull();

            const { body } = await makeTrpcRequest({ email: testUser.email });

            expect(body.result.data).toMatchObject({
                status: "oban job queued",
                jobId: expect.any(String),
                userId: expect.any(String),
            });

            // Verify the user's password expiry was updated
            const updatedUser = await userDAO.findUserWithPasswordByEmail(testUser.email);
            expect(updatedUser?.passwordResetExpiresOn).toBeDefined();
            expect(updatedUser?.passwordResetToken).toBeDefined();
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
                message: expect.stringContaining("Please provide a valid email address"),
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
    });

    describe("POST /v2/auth.signup.register", () => {
        const makeTrpcRequest = (input: any, expectedStatus = 200) => {
            return request(app).post("/v2/auth.signup.register").send(input).expect(expectedStatus);
        };

        it("should successfully register new user", async () => {
            const newUser = { email: "newuser@example.com", password: "newpassword123" };

            const { body } = await makeTrpcRequest(newUser);

            expect(body.result.data).toMatchObject({
                id: expect.any(String),
                email: newUser.email,
            });

            // Verify the user was created in the database with hashed password
            const createdUser = await userDAO.findUserWithPasswordByEmail(newUser.email);
            expect(createdUser).toBeDefined();
            expect(createdUser?.email).toBe(newUser.email);
            // Password should be hashed, not plain text
            expect(createdUser?.password).not.toBe(newUser.password);
        });

        it("should return validation error for invalid email", async () => {
            const { body } = await makeTrpcRequest({ email: "invalid-email", password: "testpassword" }, 400);

            expect(body.error).toMatchObject({
                code: -32600, // tRPC PARSE_ERROR code for validation
                message: expect.stringContaining("Please provide a valid email address"),
            });
        });

        it("should return validation error for missing password", async () => {
            const { body } = await makeTrpcRequest({ email: "newuser@example.com", password: "" }, 400);

            expect(body.error).toMatchObject({
                code: -32600, // tRPC PARSE_ERROR code
                message: expect.stringContaining("Password is required"),
            });
        });

        it("should return validation error for missing email", async () => {
            const { body } = await makeTrpcRequest({ email: "", password: "testpassword" }, 400);

            expect(body.error).toMatchObject({
                code: -32600, // tRPC PARSE_ERROR code
                message: expect.stringContaining("Please provide a valid email addres"),
            });
        });
    });

    describe("POST /v2/auth.signup.sendEmail", () => {
        const makeTrpcRequest = (input: any, expectedStatus = 200) => {
            return request(app).post("/v2/auth.signup.sendEmail").send(input).expect(expectedStatus);
        };

        it("should successfully queue registration email for existing user", async () => {
            // Create a user in the database first
            await userDAO.createUsers([{ email: testUser.email, password: testUser.password }]);

            const { body } = await makeTrpcRequest({ email: testUser.email });

            expect(body.result.data).toMatchObject({
                status: "oban job queued",
                jobId: expect.any(String),
                userId: expect.any(String),
            });
        }, 10000);

        it("should return NOT_FOUND error for non-existent user", async () => {
            const { body } = await makeTrpcRequest({ email: "nonexistent@example.com" }, 404);

            expect(body.error).toMatchObject({
                code: -32004, // tRPC NOT_FOUND error code
                message: expect.stringContaining("No user found"),
            });
        });

        it("should return validation error for invalid email", async () => {
            const { body } = await makeTrpcRequest({ email: "invalid-email" }, 400);

            expect(body.error).toMatchObject({
                code: -32600, // tRPC PARSE_ERROR code for validation
                message: expect.stringContaining("Please provide a valid email address"),
            });
        });

        it("should return validation error for missing email", async () => {
            const { body } = await makeTrpcRequest({}, 400);

            expect(body.error).toMatchObject({
                code: -32600, // tRPC PARSE_ERROR code
                message: expect.stringContaining("Required"),
            });
        });
    });

    describe("POST /v2/auth.resetPassword.applyReset", () => {
        const makeTrpcRequest = (input: any, expectedStatus = 200) => {
            return request(app).post("/v2/auth.resetPassword.applyReset").send(input).expect(expectedStatus);
        };

        it("should successfully reset password with valid token", async () => {
            // Create a user with a valid reset token and expiry
            const futureDate = new Date();
            futureDate.setHours(futureDate.getHours() + 1);
            const hashedPassword = hashSync(testUser.password, 1);

            const createdUsers = await userDAO.createUsers([{ email: testUser.email, password: hashedPassword }]);
            const userId = createdUsers[0].id;

            // Set password reset token and expiry
            const resetToken = "valid-reset-token-123";
            await userDAO.updateUser(userId, {
                passwordResetToken: resetToken,
                passwordResetExpiresOn: futureDate,
            });

            const { body } = await makeTrpcRequest({
                password: "newPassword123",
                confirmPassword: "newPassword123",
                token: resetToken,
            });

            expect(body.result.data).toMatchObject({
                status: "success",
                message: "Password reset successfully",
            });

            // Verify the password was updated
            const updatedUser = await userDAO.findUserWithPasswordByEmail(testUser.email);

            expect(updatedUser?.password).not.toBe(hashedPassword);
            expect(updatedUser?.passwordResetToken).toBeNull();
            expect(updatedUser?.passwordResetExpiresOn).toBeNull();
        });

        it("should return NOT_FOUND error when token does not exist", async () => {
            const { body } = await makeTrpcRequest(
                {
                    password: "newPassword123",
                    confirmPassword: "newPassword123",
                    token: "non-existent-token",
                },
                404
            );

            expect(body.error).toMatchObject({
                code: -32004, // tRPC NOT_FOUND error code
                message: expect.stringContaining("Invalid or expired reset token"),
            });
        });

        it("should return NOT_FOUND error when token does not match", async () => {
            const futureDate = new Date();
            futureDate.setHours(futureDate.getHours() + 1);
            const hashedPassword = hashSync(testUser.password, 1);

            const createdUsers = await userDAO.createUsers([{ email: testUser.email, password: hashedPassword }]);
            const userId = createdUsers[0].id;

            // Set a different token
            await userDAO.updateUser(userId, {
                passwordResetToken: "correct-token",
                passwordResetExpiresOn: futureDate,
            });

            const { body } = await makeTrpcRequest(
                {
                    password: "newPassword123",
                    confirmPassword: "newPassword123",
                    token: "wrong-token",
                },
                404
            );

            expect(body.error).toMatchObject({
                code: -32004, // tRPC NOT_FOUND error code
                message: expect.stringContaining("Invalid or expired reset token"),
            });
        });

        it("should return FORBIDDEN error when token is expired", async () => {
            const pastDate = new Date();
            pastDate.setHours(pastDate.getHours() - 1);
            const hashedPassword = hashSync(testUser.password, 1);

            const createdUsers = await userDAO.createUsers([{ email: testUser.email, password: hashedPassword }]);
            const userId = createdUsers[0].id;

            const resetToken = "valid-token";
            await userDAO.updateUser(userId, {
                passwordResetToken: resetToken,
                passwordResetExpiresOn: pastDate,
            });

            const { body } = await makeTrpcRequest(
                {
                    password: "newPassword123",
                    confirmPassword: "newPassword123",
                    token: resetToken,
                },
                403
            );

            expect(body.error).toMatchObject({
                code: -32003, // tRPC FORBIDDEN error code
                message: expect.stringContaining("expired"),
            });
        });

        it("should return validation error when passwords do not match", async () => {
            const { body } = await makeTrpcRequest(
                {
                    password: "newPassword123",
                    confirmPassword: "differentPassword",
                    token: "valid-token",
                },
                400
            );

            expect(body.error).toMatchObject({
                code: -32600, // tRPC PARSE_ERROR code for validation
                message: expect.stringContaining("Passwords do not match"),
            });
        });

        it("should return validation error for missing required fields", async () => {
            const { body } = await makeTrpcRequest(
                {
                    password: "",
                    confirmPassword: "",
                    token: "",
                },
                400
            );

            expect(body.error).toMatchObject({
                code: -32600, // tRPC PARSE_ERROR code
                message: expect.stringContaining("required"),
            });
        });
    });

    describe("POST /v2/auth.resetPassword.checkToken", () => {
        const makeTrpcRequest = (input: any, expectedStatus = 200) => {
            return request(app).post("/v2/auth.resetPassword.checkToken").send(input).expect(expectedStatus);
        };

        it("should return valid true when token exists", async () => {
            // Create a user with a reset token
            const hashedPassword = hashSync(testUser.password, 1);
            const createdUsers = await userDAO.createUsers([{ email: testUser.email, password: hashedPassword }]);
            const userId = createdUsers[0].id;

            // Set password reset token
            const resetToken = "valid-token-abc123";
            await userDAO.updateUser(userId, {
                passwordResetToken: resetToken,
            });

            const { body } = await makeTrpcRequest({ token: resetToken });

            expect(body.result.data).toEqual({ valid: true });
        });

        it("should return NOT_FOUND error when token does not exist", async () => {
            const { body } = await makeTrpcRequest({ token: "non-existent-token" }, 404);

            expect(body.error).toMatchObject({
                code: -32004, // tRPC NOT_FOUND error code
                message: expect.stringContaining("Invalid or expired reset token"),
            });
        });

        it("should return validation error for missing token", async () => {
            const { body } = await makeTrpcRequest({}, 400);

            expect(body.error).toMatchObject({
                code: -32600, // tRPC PARSE_ERROR code
                message: expect.stringContaining("Required"),
            });
        });

        it("should return validation error for empty token", async () => {
            const { body } = await makeTrpcRequest({ token: "" }, 400);

            expect(body.error).toMatchObject({
                code: -32600, // tRPC PARSE_ERROR code
                message: expect.stringContaining("required"),
            });
        });
    });

    describe("GET /v2/auth.sessionCheck", () => {
        const makeTrpcRequest = (agent: request.SuperAgentTest, expectedStatus = 200) => {
            return agent.get("/v2/auth.sessionCheck").expect(expectedStatus);
        };

        it("should return user when session exists", async () => {
            // First create and authenticate a user to establish a session
            const hashedPassword = hashSync(testUser.password, 1);
            const createdUsers = await userDAO.createUsers([{ email: testUser.email, password: hashedPassword }]);
            const userId = createdUsers[0].id;

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

            // Now check session
            const { body } = await makeTrpcRequest(agent);

            expect(body.result.data).toMatchObject({
                id: userId,
                email: testUser.email,
            });
        });

        it("should return UNAUTHORIZED error when no session exists", async () => {
            const { body } = await request(app).get("/v2/auth.sessionCheck").expect(401);

            expect(body.error).toMatchObject({
                code: -32001, // tRPC UNAUTHORIZED error code
                message: expect.stringContaining("not authenticated"),
            });
        });
    });

    describe("POST /v2/auth.logout", () => {
        const makeTrpcRequest = (agent: request.SuperAgentTest, expectedStatus = 200) => {
            return agent.post("/v2/auth.logout").send({}).expect(expectedStatus);
        };

        it("should successfully logout user with active session", async () => {
            // First create and authenticate a user to establish a session
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

            // Now logout
            const { body } = await makeTrpcRequest(agent);

            expect(body.result.data).toBe(true);

            // Verify session is destroyed by checking session
            const { body: sessionCheckBody } = await agent.get("/v2/auth.sessionCheck").expect(401);

            expect(sessionCheckBody.error).toMatchObject({
                code: -32001, // tRPC UNAUTHORIZED error code
                message: expect.stringContaining("not authenticated"),
            });
        });

        it("should return success when no session exists", async () => {
            const { body } = await request(app).post("/v2/auth.logout").send({}).expect(200);

            expect(body.result.data).toBe(true);
        });
    });
});
