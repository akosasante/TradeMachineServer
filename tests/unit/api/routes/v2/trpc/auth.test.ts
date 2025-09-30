import { TRPCError}  from "@trpc/server";
import {mockClear, mockDeep} from "jest-mock-extended";
import {authRouter} from "../../../../../../src/api/routes/v2/routers/auth";
import logger from "../../../../../../src/bootstrap/logger";
import {Context, createCallerFactory} from "../../../../../../src/api/routes/v2/trpc";
import {ExtendedPrismaClient} from "../../../../../../src/bootstrap/prisma-db";
import UserDAO, {PublicUser} from "../../../../../../src/DAO/v2/UserDAO";
import ObanDAO from "../../../../../../src/DAO/v2/ObanDAO";
import {Request, Response} from "express";

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

    const createCaller = createCallerFactory(authRouter);

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

    describe("sendResetEmail", () => {
        const mockContext: Context = {
            req: mockReq as unknown as Request,
            res: mockRes as unknown as Response,
            session: undefined,
            prisma: mockPrisma as unknown as ExtendedPrismaClient,
            userDao: mockUserDao as unknown as UserDAO,
        };

        const caller = createCallerFactory(authRouter)(mockContext);

        it("should successfully queue password reset email for existing user", async () => {
            const testEmail = "test@example.com";
            const mockUser = { id: "user-123", email: testEmail };
            const mockUpdatedUser = { ...mockUser, passwordResetExpiresOn: new Date() } as PublicUser;
            // eslint-disable-next-line node/no-unsupported-features/es-builtins
            const mockJob = { id: BigInt(456) };

            mockUserDao.findUserWithPasswordByEmail.mockResolvedValue(mockUser as unknown as ReturnType<UserDAO["findUserWithPasswordByEmail"]>);
            mockUserDao.setPasswordExpires.mockResolvedValue(mockUpdatedUser);
            mockObanDao.enqueuePasswordResetEmail.mockResolvedValue(mockJob as unknown as ReturnType<ObanDAO["enqueuePasswordResetEmail"]>);

            const result = await caller.login.sendResetEmail({ email: testEmail });

            expect(mockUserDao.findUserWithPasswordByEmail).toHaveBeenCalledWith(testEmail);
            expect(mockUserDao.setPasswordExpires).toHaveBeenCalledWith("user-123");
            expect(mockObanDao.enqueuePasswordResetEmail).toHaveBeenCalledWith("user-123", { traceparent: "test-trace" });

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

            mockUserDao.findUserWithPasswordByEmail.mockResolvedValue(mockUser as unknown as ReturnType<UserDAO["findUserWithPasswordByEmail"]>);
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
});
