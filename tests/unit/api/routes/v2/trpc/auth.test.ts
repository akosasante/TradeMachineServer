import { TRPCError } from "@trpc/server";
import { mockClear, mockDeep } from "jest-mock-extended";
import { authRouter } from "../../../../../../src/api/routes/v2/routers/auth";
import logger from "../../../../../../src/bootstrap/logger";
import { Context, createCallerFactory } from "../../../../../../src/api/routes/v2/trpcHelpers";
import { ExtendedPrismaClient } from "../../../../../../src/bootstrap/prisma-db";
import UserDAO, { PublicUser } from "../../../../../../src/DAO/v2/UserDAO";
import ObanDAO from "../../../../../../src/DAO/v2/ObanDAO";
import { Request, Response } from "express";
import { hashSync } from "bcryptjs";

// Mock the tracing utilities
jest.mock("../../../../../../src/utils/tracing", () => ({
    createSpanFromRequest: jest.fn(() => ({
        span: { setAttributes: jest.fn(), addEvent: jest.fn(), setStatus: jest.fn() },
        context: {},
    })),
    finishSpanWithStatusCode: jest.fn(),
    addSpanAttributes: jest.fn(),
    addSpanEvent: jest.fn(),
    extractTraceContext: jest.fn(() => ({ traceparent: "test-trace" })),
}));

// Mock Rollbar
jest.mock("../../../../../../src/bootstrap/rollbar", () => ({
    rollbar: {
        info: jest.fn(),
        error: jest.fn(),
    },
}));

// Mock ObanDAO
jest.mock("../../../../../../src/DAO/v2/ObanDAO");

describe("[TRPC] Auth Router Unit Tests", () => {
    const mockPrisma = mockDeep<ExtendedPrismaClient>();
    const mockUserDao = mockDeep<UserDAO>();
    const mockObanDao = mockDeep<ObanDAO>();
    const mockReq = mockDeep<Request>();
    const mockRes = mockDeep<Response>();

    const createMockContext = (session?: any): Context => ({
        req: mockReq as unknown as Request,
        res: mockRes as unknown as Response,
        session,
        prisma: mockPrisma as unknown as ExtendedPrismaClient,
        userDao: mockUserDao as unknown as UserDAO,
    });

    beforeAll(() => {
        logger.debug("~~~~~~TRPC AUTH ROUTER UNIT TESTS BEGIN~~~~~~");
    });

    afterAll(() => {
        logger.debug("~~~~~~TRPC AUTH ROUTER UNIT TESTS COMPLETE~~~~~~");
    });

    beforeEach(() => {
        // Setup mocks
        mockPrisma.obanJob = mockDeep<any>();
        (ObanDAO as jest.MockedClass<typeof ObanDAO>).mockImplementation(() => mockObanDao);
    });

    afterEach(() => {
        mockClear(mockPrisma);
        mockClear(mockUserDao);
        mockClear(mockObanDao);
        mockClear(mockReq);
        mockClear(mockRes);
        jest.clearAllMocks();
    });

    describe("login.authenticate", () => {
        it("should successfully authenticate user with valid credentials", async () => {
            const hashedPassword = hashSync("password123", 1);
            const mockUser = {
                id: "user-123",
                email: "test@example.com",
                password: hashedPassword,
                isAdmin: () => false,
            } as unknown as PublicUser;

            const mockSession = {
                user: undefined as string | undefined,
                save: jest.fn(cb => cb(null)),
                destroy: jest.fn(),
            };

            const caller = createCallerFactory(authRouter)(createMockContext(mockSession));

            mockUserDao.findUserWithPasswordByEmail.mockResolvedValue(
                mockUser as unknown as ReturnType<UserDAO["findUserWithPasswordByEmail"]>
            );
            mockUserDao.updateUser.mockResolvedValue(mockUser);
            mockUserDao.getUserById.mockResolvedValue(mockUser);

            const result = await caller.login.authenticate({
                email: "test@example.com",
                password: "password123",
            });

            expect(result).toBeDefined();
            expect(result.id).toBe("user-123");
            expect(mockSession.save).toHaveBeenCalled();
        });

        it("should throw UNAUTHORIZED error with invalid credentials", async () => {
            const mockSession = {
                user: undefined as string | undefined,
                save: jest.fn(cb => cb(null)),
                destroy: jest.fn((cb: (err: Error | null) => void) => cb(null)),
            };

            const caller = createCallerFactory(authRouter)(createMockContext(mockSession));

            // Mock no user found
            mockUserDao.findUserWithPasswordByEmail.mockResolvedValue(null);

            await expect(
                caller.login.authenticate({
                    email: "test@example.com",
                    password: "wrongpassword",
                })
            ).rejects.toThrow(TRPCError);

            expect(mockSession.destroy).toHaveBeenCalled();
        });

        it("should validate email format", async () => {
            const caller = createCallerFactory(authRouter)(createMockContext());

            await expect(
                caller.login.authenticate({
                    email: "invalid-email",
                    password: "password123",
                })
            ).rejects.toThrow();
        });

        it("should require password field", async () => {
            const caller = createCallerFactory(authRouter)(createMockContext());

            await expect(
                caller.login.authenticate({
                    email: "test@example.com",
                    password: "",
                })
            ).rejects.toThrow();
        });
    });

    describe("login.sendResetEmail", () => {
        const caller = createCallerFactory(authRouter)(createMockContext());

        it("should successfully queue password reset email for existing user", async () => {
            const testEmail = "test@example.com";
            const mockUser = { id: "user-123", email: testEmail };
            const mockUpdatedUser = { ...mockUser, passwordResetExpiresOn: new Date() } as PublicUser;
            // eslint-disable-next-line node/no-unsupported-features/es-builtins
            const mockJob = { id: BigInt(456) };

            mockUserDao.findUserWithPasswordByEmail.mockResolvedValue(
                mockUser as unknown as ReturnType<UserDAO["findUserWithPasswordByEmail"]>
            );
            mockUserDao.setPasswordExpires.mockResolvedValue(mockUpdatedUser);
            mockObanDao.enqueuePasswordResetEmail.mockResolvedValue(
                mockJob as unknown as ReturnType<ObanDAO["enqueuePasswordResetEmail"]>
            );

            const result = await caller.login.sendResetEmail({ email: testEmail });

            expect(mockUserDao.findUserWithPasswordByEmail).toHaveBeenCalledWith(testEmail);
            expect(mockUserDao.setPasswordExpires).toHaveBeenCalledWith("user-123");
            expect(mockObanDao.enqueuePasswordResetEmail).toHaveBeenCalledWith("user-123", {
                traceparent: "test-trace",
            });

            expect(result).toEqual({
                status: "oban job queued",
                jobId: "456",
                userId: "user-123",
            });
        });

        it("should throw NOT_FOUND error when user does not exist", async () => {
            const testEmail = "nonexistent@example.com";
            mockUserDao.findUserWithPasswordByEmail.mockResolvedValue(null);

            await expect(caller.login.sendResetEmail({ email: testEmail })).rejects.toThrow(
                new TRPCError({
                    code: "NOT_FOUND",
                    message: "No user found with the given email.",
                })
            );

            expect(mockUserDao.findUserWithPasswordByEmail).toHaveBeenCalledWith(testEmail);
            expect(mockUserDao.setPasswordExpires).not.toHaveBeenCalled();
            expect(mockObanDao.enqueuePasswordResetEmail).not.toHaveBeenCalled();
        });

        it("should throw INTERNAL_SERVER_ERROR when obanJob is not available", async () => {
            const testEmail = "test@example.com";
            const mockUser = { id: "user-123", email: testEmail };

            mockUserDao.findUserWithPasswordByEmail.mockResolvedValue(
                mockUser as unknown as ReturnType<UserDAO["findUserWithPasswordByEmail"]>
            );
            mockUserDao.setPasswordExpires.mockResolvedValue(mockUser as unknown as PublicUser);
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            mockPrisma.obanJob = undefined;

            await expect(caller.login.sendResetEmail({ email: testEmail })).rejects.toThrow(
                new TRPCError({
                    code: "INTERNAL_SERVER_ERROR",
                    message: "obanJob not available in Prisma client",
                })
            );

            expect(mockObanDao.enqueuePasswordResetEmail).not.toHaveBeenCalled();
        });

        it("should validate email format", async () => {
            await expect(caller.login.sendResetEmail({ email: "invalid-email" })).rejects.toThrow();
        });

        it("should require email field", async () => {
            await expect(caller.login.sendResetEmail({} as any)).rejects.toThrow();
        });
    });

    describe("sessionCheck", () => {
        it("should return user when session exists", async () => {
            const mockUser = {
                id: "user-123",
                email: "test@example.com",
                isAdmin: () => false,
            } as unknown as PublicUser;

            const mockSession = { user: "user-123" };
            const caller = createCallerFactory(authRouter)(createMockContext(mockSession));

            mockUserDao.getUserById.mockResolvedValue(mockUser);

            const result = await caller.sessionCheck();

            expect(result).toBeDefined();
            expect(result.id).toBe("user-123");
            expect(mockUserDao.getUserById).toHaveBeenCalledWith("user-123");
        });

        it("should throw UNAUTHORIZED error when no session exists", async () => {
            const caller = createCallerFactory(authRouter)(createMockContext());

            await expect(caller.sessionCheck()).rejects.toThrow(
                new TRPCError({
                    code: "UNAUTHORIZED",
                    message: "User not authenticated",
                })
            );
        });

        it("should throw UNAUTHORIZED error when session has no user", async () => {
            const mockSession = { user: undefined };
            const caller = createCallerFactory(authRouter)(createMockContext(mockSession));

            await expect(caller.sessionCheck()).rejects.toThrow(
                new TRPCError({
                    code: "UNAUTHORIZED",
                    message: "User not authenticated",
                })
            );
        });
    });

    describe("logout", () => {
        it("should successfully logout user with active session", async () => {
            const mockSession = {
                user: "user-123",
                destroy: jest.fn((cb: (err: Error | null) => void) => cb(null)),
            };
            const caller = createCallerFactory(authRouter)(createMockContext(mockSession));

            const result = await caller.logout();

            expect(result).toBe(true);
            expect(mockSession.destroy).toHaveBeenCalled();
        });

        it("should return true when no session exists", async () => {
            const caller = createCallerFactory(authRouter)(createMockContext());

            const result = await caller.logout();

            expect(result).toBe(true);
        });

        it("should throw INTERNAL_SERVER_ERROR when session destroy fails", async () => {
            const mockSession = {
                user: "user-123",
                destroy: jest.fn((cb: (err: Error | null) => void) => cb(new Error("Destroy failed"))),
            };
            const caller = createCallerFactory(authRouter)(createMockContext(mockSession));

            await expect(caller.logout()).rejects.toThrow(
                new TRPCError({
                    code: "INTERNAL_SERVER_ERROR",
                    message: "Error destroying session",
                })
            );
        });
    });

    describe("resetPassword", () => {
        it("should successfully reset password with valid token", async () => {
            const futureDate = new Date();
            futureDate.setHours(futureDate.getHours() + 1);
            const validUserId = "550e8400-e29b-41d4-a716-446655440000";

            const mockUser = {
                id: validUserId,
                email: "test@example.com",
                passwordResetToken: "valid-token",
                passwordResetExpiresOn: futureDate,
            } as unknown as PublicUser;

            const caller = createCallerFactory(authRouter)(createMockContext());

            mockUserDao.findUserByPasswordResetToken.mockResolvedValue(mockUser);
            mockUserDao.updateUser.mockResolvedValue(mockUser);

            const result = await caller.resetPassword.applyReset({
                password: "newPassword123",
                confirmPassword: "newPassword123",
                token: "valid-token",
            });

            expect(result).toEqual({
                status: "success",
                message: "Password reset successfully",
            });
            expect(mockUserDao.findUserByPasswordResetToken).toHaveBeenCalledWith("valid-token");
            expect(mockUserDao.updateUser).toHaveBeenCalledWith(validUserId, expect.any(Object));
        });

        it("should throw NOT_FOUND error when token is invalid", async () => {
            const caller = createCallerFactory(authRouter)(createMockContext());

            mockUserDao.findUserByPasswordResetToken.mockResolvedValue(null);

            await expect(
                caller.resetPassword.applyReset({
                    password: "newPassword123",
                    confirmPassword: "newPassword123",
                    token: "invalid-token",
                })
            ).rejects.toThrow(
                new TRPCError({
                    code: "NOT_FOUND",
                    message: "Invalid or expired reset token",
                })
            );

            expect(mockUserDao.findUserByPasswordResetToken).toHaveBeenCalledWith("invalid-token");
        });

        it("should throw FORBIDDEN error when token is expired", async () => {
            const pastDate = new Date();
            pastDate.setHours(pastDate.getHours() - 1);
            const validUserId = "550e8400-e29b-41d4-a716-446655440000";

            const mockUser = {
                id: validUserId,
                email: "test@example.com",
                passwordResetToken: "valid-token",
                passwordResetExpiresOn: pastDate,
            } as unknown as PublicUser;

            const caller = createCallerFactory(authRouter)(createMockContext());

            mockUserDao.findUserByPasswordResetToken.mockResolvedValue(mockUser);

            await expect(
                caller.resetPassword.applyReset({
                    password: "newPassword123",
                    confirmPassword: "newPassword123",
                    token: "valid-token",
                })
            ).rejects.toThrow(
                new TRPCError({
                    code: "FORBIDDEN",
                    message: "Reset token has expired",
                })
            );

            expect(mockUserDao.findUserByPasswordResetToken).toHaveBeenCalledWith("valid-token");
        });

        it("should throw validation error when passwords do not match", async () => {
            const caller = createCallerFactory(authRouter)(createMockContext());

            await expect(
                caller.resetPassword.applyReset({
                    password: "newPassword123",
                    confirmPassword: "differentPassword",
                    token: "valid-token",
                })
            ).rejects.toThrow();
        });

        it("should require all fields", async () => {
            const caller = createCallerFactory(authRouter)(createMockContext());

            await expect(
                caller.resetPassword.applyReset({
                    password: "",
                    confirmPassword: "",
                    token: "",
                })
            ).rejects.toThrow();
        });
    });

    describe("resetPassword.checkToken", () => {
        it("should return valid true when token exists and is not expired", async () => {
            const futureDate = new Date();
            futureDate.setHours(futureDate.getHours() + 1);

            const mockUser = {
                id: "user-123",
                email: "test@example.com",
                passwordResetExpiresOn: futureDate,
            } as unknown as PublicUser;

            const caller = createCallerFactory(authRouter)(createMockContext());

            mockUserDao.findUserByPasswordResetToken.mockResolvedValue(mockUser);

            const result = await caller.resetPassword.checkToken({ token: "valid-token-123" });

            expect(result).toEqual({ valid: true });
            expect(mockUserDao.findUserByPasswordResetToken).toHaveBeenCalledWith("valid-token-123");
        });

        it("should throw FORBIDDEN error when token is expired", async () => {
            const pastDate = new Date();
            pastDate.setHours(pastDate.getHours() - 1);

            const mockUser = {
                id: "user-123",
                email: "test@example.com",
                passwordResetExpiresOn: pastDate,
            } as unknown as PublicUser;

            const caller = createCallerFactory(authRouter)(createMockContext());

            mockUserDao.findUserByPasswordResetToken.mockResolvedValue(mockUser);

            await expect(caller.resetPassword.checkToken({ token: "expired-token" })).rejects.toThrow(
                new TRPCError({
                    code: "FORBIDDEN",
                    message: "Reset token has expired",
                })
            );

            expect(mockUserDao.findUserByPasswordResetToken).toHaveBeenCalledWith("expired-token");
        });

        it("should throw NOT_FOUND error when token does not exist", async () => {
            const caller = createCallerFactory(authRouter)(createMockContext());

            mockUserDao.findUserByPasswordResetToken.mockResolvedValue(null);

            await expect(caller.resetPassword.checkToken({ token: "invalid-token" })).rejects.toThrow(
                new TRPCError({
                    code: "NOT_FOUND",
                    message: "Invalid or expired reset token",
                })
            );

            expect(mockUserDao.findUserByPasswordResetToken).toHaveBeenCalledWith("invalid-token");
        });

        it("should validate token is provided", async () => {
            const caller = createCallerFactory(authRouter)(createMockContext());

            await expect(caller.resetPassword.checkToken({ token: "" })).rejects.toThrow();
        });

        it("should require token field", async () => {
            const caller = createCallerFactory(authRouter)(createMockContext());

            await expect(caller.resetPassword.checkToken({} as any)).rejects.toThrow();
        });
    });

    describe("signup.register", () => {
        it("should successfully register new user", async () => {
            const mockUser = {
                id: "user-123",
                email: "newuser@example.com",
                isAdmin: () => false,
            } as unknown as PublicUser;

            const mockSession = {
                user: undefined as string | undefined,
                save: jest.fn(cb => cb(null)),
            };

            const caller = createCallerFactory(authRouter)(createMockContext(mockSession));

            mockUserDao.findUserWithPasswordByEmail.mockResolvedValue(null);
            mockUserDao.createUsers.mockResolvedValue([mockUser]);
            mockUserDao.getUserById.mockResolvedValue(mockUser);

            const result = await caller.signup.register({
                email: "newuser@example.com",
                password: "password123",
            });

            expect(result).toBeDefined();
            expect(result.id).toBe("user-123");
        });

        it("should throw BAD_REQUEST when email or password is missing", async () => {
            const mockSession = { user: undefined };
            const caller = createCallerFactory(authRouter)(createMockContext(mockSession));

            mockUserDao.findUserWithPasswordByEmail.mockResolvedValue(null);

            await expect(
                caller.signup.register({
                    email: "",
                    password: "",
                })
            ).rejects.toThrow();
        });

        it("should validate email format", async () => {
            const mockSession = { user: undefined };
            const caller = createCallerFactory(authRouter)(createMockContext(mockSession));

            await expect(
                caller.signup.register({
                    email: "invalid-email",
                    password: "password123",
                })
            ).rejects.toThrow();
        });

        it("should require password field", async () => {
            const mockSession = { user: undefined };
            const caller = createCallerFactory(authRouter)(createMockContext(mockSession));

            await expect(
                caller.signup.register({
                    email: "test@example.com",
                    password: "",
                })
            ).rejects.toThrow();
        });
    });

    describe("signup.sendEmail", () => {
        const mockContext: Context = {
            req: mockReq as unknown as Request,
            res: mockRes as unknown as Response,
            session: undefined,
            prisma: mockPrisma as unknown as ExtendedPrismaClient,
            userDao: mockUserDao as unknown as UserDAO,
        };

        const caller = createCallerFactory(authRouter)(mockContext);

        it("should successfully queue registration email for existing user", async () => {
            const testEmail = "test@example.com";
            const mockUser = { id: "user-123", email: testEmail };
            // eslint-disable-next-line node/no-unsupported-features/es-builtins
            const mockJob = { id: BigInt(789) };

            mockUserDao.findUserWithPasswordByEmail.mockResolvedValue(
                mockUser as unknown as ReturnType<UserDAO["findUserWithPasswordByEmail"]>
            );
            mockObanDao.enqueueRegistrationEmail.mockResolvedValue(
                mockJob as unknown as ReturnType<ObanDAO["enqueueRegistrationEmail"]>
            );

            const result = await caller.signup.sendEmail({ email: testEmail });

            expect(mockUserDao.findUserWithPasswordByEmail).toHaveBeenCalledWith(testEmail);
            expect(mockObanDao.enqueueRegistrationEmail).toHaveBeenCalledWith("user-123", {
                traceparent: "test-trace",
            });

            expect(result).toEqual({
                status: "oban job queued",
                jobId: "789",
                userId: "user-123",
            });
        });

        it("should throw NOT_FOUND error when user does not exist", async () => {
            const testEmail = "nonexistent@example.com";
            mockUserDao.findUserWithPasswordByEmail.mockResolvedValue(null);

            await expect(caller.signup.sendEmail({ email: testEmail })).rejects.toThrow(
                new TRPCError({
                    code: "NOT_FOUND",
                    message: "No user found with the given email.",
                })
            );

            expect(mockUserDao.findUserWithPasswordByEmail).toHaveBeenCalledWith(testEmail);
            expect(mockObanDao.enqueueRegistrationEmail).not.toHaveBeenCalled();
        });

        it("should throw INTERNAL_SERVER_ERROR when obanJob is not available", async () => {
            const testEmail = "test@example.com";
            const mockUser = { id: "user-123", email: testEmail };

            mockUserDao.findUserWithPasswordByEmail.mockResolvedValue(
                mockUser as unknown as ReturnType<UserDAO["findUserWithPasswordByEmail"]>
            );
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            mockPrisma.obanJob = undefined;

            await expect(caller.signup.sendEmail({ email: testEmail })).rejects.toThrow(
                new TRPCError({
                    code: "INTERNAL_SERVER_ERROR",
                    message: "obanJob not available in Prisma client",
                })
            );

            expect(mockObanDao.enqueueRegistrationEmail).not.toHaveBeenCalled();
        });

        it("should validate email format", async () => {
            await expect(caller.signup.sendEmail({ email: "invalid-email" })).rejects.toThrow();
        });

        it("should require email field", async () => {
            await expect(caller.signup.sendEmail({} as any)).rejects.toThrow();
        });
    });
});
