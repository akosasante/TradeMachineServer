import { mockClear, mockDeep } from "jest-mock-extended";
import { clientRouter } from "../../../../../../src/api/routes/v2/routers/client";
import logger from "../../../../../../src/bootstrap/logger";
import { Context, createCallerFactory } from "../../../../../../src/api/routes/v2/utils/trpcHelpers";
import { ExtendedPrismaClient } from "../../../../../../src/bootstrap/prisma-db";
import UserDAO, { PublicUser } from "../../../../../../src/DAO/v2/UserDAO";
import { Request, Response } from "express";
import { TRPCError } from "@trpc/server";
import * as ssoTokens from "../../../../../../src/api/routes/v2/utils/ssoTokens";
import { Session } from "express-session";
import { UserRole } from "@prisma/client";

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

// Mock metrics using mockDeep
jest.mock("../../../../../../src/bootstrap/metrics", () => ({
    activeUserMetric: mockDeep(),
    transferTokenExchangedMetric: mockDeep(),
    transferTokenFailedMetric: mockDeep(),
    transferTokenGeneratedMetric: mockDeep(),
    metricsMiddleware: jest.fn((_req, _res, next) => next()), // Mock as pass-through middleware
    metricsRegistry: mockDeep(),
}));

// Mock the SSO tokens utility using mockDeep
jest.mock("../../../../../../src/api/routes/v2/utils/ssoTokens", () => ({
    ...jest.requireActual("../../../../../../src/api/routes/v2/utils/ssoTokens"),
    createTransferToken: jest.fn(),
    consumeTransferToken: jest.fn(),
    loadOriginalSession: jest.fn(),
}));

describe("[TRPC] Client Router Unit Tests", () => {
    const mockPrisma = mockDeep<ExtendedPrismaClient>();
    const mockUserDao = mockDeep<UserDAO>();
    const mockReq = mockDeep<Request>();
    const mockRes = mockDeep<Response>();

    // Type-safe mocked SSO token functions
    const mockSsoTokens = ssoTokens as jest.Mocked<typeof ssoTokens>;

    const createMockContext = (
        headers: Record<string, string | string[]> = {},
        sessionData?: Partial<Session & { user?: string }>,
        hostname?: string
    ): Context => {
        // Always create a Session object, even if no sessionData provided
        // This ensures ctx.req.session exists for procedures that need to regenerate sessions
        const session: Session & { user?: string } = {
            id: "test-session-id",
            cookie: {
                originalMaxAge: 86400000,
                expires: new Date(Date.now() + 86400000),
                secure: false,
                httpOnly: true,
                path: "/",
                sameSite: "lax" as const,
            },
            regenerate: jest.fn(callback => callback(null)),
            destroy: jest.fn(callback => callback(null)),
            reload: jest.fn(callback => callback(null)),
            save: jest.fn(callback => callback?.(null)),
            touch: jest.fn(() => session),
            resetMaxAge: jest.fn(() => session),
            // Merge any provided session data
            ...sessionData,
        } as Session & { user?: string };

        const req = {
            ...mockReq,
            headers,
            connection: { remoteAddress: "192.168.1.100" },
            socket: { remoteAddress: "192.168.1.100" },
            sessionID: "test-session-id",
            hostname: hostname || "trades.flexfoxfantasy.com",
            session, // This is ctx.req.session for the exchange procedure
            header: jest.fn((name: string) => {
                if (name === "Origin") {
                    return `https://${hostname || "trades.flexfoxfantasy.com"}`;
                }
                return headers[name.toLowerCase()];
            }),
        } as unknown as Request;

        return {
            req,
            res: mockRes as unknown as Response,
            session: sessionData ? session : undefined, // Only set ctx.session if user provided session data (for auth)
            prisma: mockPrisma as unknown as ExtendedPrismaClient,
            userDao: mockUserDao as unknown as UserDAO,
        };
    };

    const mockUser: PublicUser = {
        id: "123",
        dateCreated: new Date(),
        dateModified: new Date(),
        email: "test@example.com",
        displayName: "Test User",
        slackUsername: "testuser",
        role: UserRole.ADMIN,
        lastLoggedIn: new Date(),
        passwordResetExpiresOn: null,
        passwordResetToken: null,
        status: "ACTIVE",
        csvName: null,
        espnMember: null,
        teamId: null,
        isAdmin: () => true, // Computed property that returns a function
    };

    beforeAll(() => {
        logger.debug("~~~~~~TRPC CLIENT ROUTER UNIT TESTS BEGIN~~~~~~");
    });

    afterAll(() => {
        logger.debug("~~~~~~TRPC CLIENT ROUTER UNIT TESTS COMPLETE~~~~~~");
    });

    afterEach(() => {
        mockClear(mockPrisma);
        mockClear(mockUserDao);
        mockClear(mockReq);
        mockClear(mockRes);
        jest.clearAllMocks();
    });

    describe("getIP", () => {
        it("should extract IP from x-forwarded-for header (single IP)", async () => {
            const caller = createCallerFactory(clientRouter)(
                createMockContext({
                    "x-forwarded-for": "203.0.113.1",
                })
            );

            const result = await caller.getIP();

            expect(result).toEqual({
                ip: "203.0.113.1",
            });
        });

        it("should extract first IP from x-forwarded-for header (multiple IPs)", async () => {
            const caller = createCallerFactory(clientRouter)(
                createMockContext({
                    "x-forwarded-for": "203.0.113.1, 198.51.100.1, 192.0.2.1",
                })
            );

            const result = await caller.getIP();

            expect(result).toEqual({
                ip: "203.0.113.1",
            });
        });

        it("should handle x-forwarded-for as array", async () => {
            const caller = createCallerFactory(clientRouter)(
                createMockContext({
                    "x-forwarded-for": ["203.0.113.1", "198.51.100.1"],
                })
            );

            const result = await caller.getIP();

            expect(result).toEqual({
                ip: "203.0.113.1",
            });
        });

        it("should extract IP from x-real-ip header when x-forwarded-for is missing", async () => {
            const caller = createCallerFactory(clientRouter)(
                createMockContext({
                    "x-real-ip": "198.51.100.1",
                })
            );

            const result = await caller.getIP();

            expect(result).toEqual({
                ip: "198.51.100.1",
            });
        });

        it("should handle x-real-ip as array", async () => {
            const caller = createCallerFactory(clientRouter)(
                createMockContext({
                    "x-real-ip": ["198.51.100.1"],
                })
            );

            const result = await caller.getIP();

            expect(result).toEqual({
                ip: "198.51.100.1",
            });
        });

        it("should fallback to direct connection when proxy headers are missing", async () => {
            const caller = createCallerFactory(clientRouter)(createMockContext({}));

            const result = await caller.getIP();

            expect(result).toEqual({
                ip: "192.168.1.100",
            });
        });

        it("should normalize IPv6-mapped IPv4 addresses", async () => {
            const mockContext = createMockContext({});
            mockContext.req.connection = { remoteAddress: "::ffff:192.168.1.100" } as any;

            const caller = createCallerFactory(clientRouter)(mockContext);

            const result = await caller.getIP();

            expect(result).toEqual({
                ip: "192.168.1.100",
            });
        });

        it("should return 'unknown' when no IP information is available", async () => {
            const mockContext = createMockContext({});
            mockContext.req.connection = undefined as any;
            mockContext.req.socket = undefined as any;

            const caller = createCallerFactory(clientRouter)(mockContext);

            const result = await caller.getIP();

            expect(result).toEqual({
                ip: "unknown",
            });
        });

        it("should prefer x-forwarded-for over x-real-ip", async () => {
            const caller = createCallerFactory(clientRouter)(
                createMockContext({
                    "x-forwarded-for": "203.0.113.1",
                    "x-real-ip": "198.51.100.1",
                })
            );

            const result = await caller.getIP();

            expect(result).toEqual({
                ip: "203.0.113.1",
            });
        });

        it("should prefer x-real-ip over direct connection", async () => {
            const caller = createCallerFactory(clientRouter)(
                createMockContext({
                    "x-real-ip": "198.51.100.1",
                })
            );

            const result = await caller.getIP();

            expect(result).toEqual({
                ip: "198.51.100.1",
            });
        });

        it("should trim whitespace from x-forwarded-for IP", async () => {
            const caller = createCallerFactory(clientRouter)(
                createMockContext({
                    "x-forwarded-for": " 203.0.113.1 , 198.51.100.1 ",
                })
            );

            const result = await caller.getIP();

            expect(result).toEqual({
                ip: "203.0.113.1",
            });
        });
    });

    describe("createRedirectToken", () => {
        beforeEach(() => {
            // Mock getUserById for the protectedProcedure authentication
            mockUserDao.getUserById.mockResolvedValue(mockUser);
        });

        it("should create a redirect token for authenticated user", async () => {
            const mockToken = "a".repeat(64);
            mockSsoTokens.createTransferToken.mockResolvedValue(mockToken);

            const caller = createCallerFactory(clientRouter)(createMockContext({}, { user: "123" }));

            const result = await caller.createRedirectToken({
                redirectTo: "https://ffftemp.akosua.xyz/dashboard",
                origin: "https://trades.flexfoxfantasy.com",
            });

            expect(result).toEqual({
                token: mockToken,
                redirectTo: "https://ffftemp.akosua.xyz/dashboard",
                expiresIn: 60,
            });

            expect(mockSsoTokens.createTransferToken).toHaveBeenCalledWith({
                sessionId: "test-session-id",
                userId: "123",
            });
        });

        it("should reject invalid redirect host", async () => {
            const caller = createCallerFactory(clientRouter)(createMockContext({}, { user: "123" }));

            await expect(
                caller.createRedirectToken({
                    redirectTo: "https://malicious-site.com/dashboard",
                    origin: "https://trades.flexfoxfantasy.com",
                })
            ).rejects.toThrow(TRPCError);
        });

        it("should reject unauthenticated requests", async () => {
            const caller = createCallerFactory(clientRouter)(createMockContext());

            await expect(
                caller.createRedirectToken({
                    redirectTo: "https://ffftemp.akosua.xyz/dashboard",
                    origin: "https://trades.flexfoxfantasy.com",
                })
            ).rejects.toThrow(TRPCError);
        });

        it("should accept all allowed redirect hosts", async () => {
            const mockToken = "a".repeat(64);
            mockSsoTokens.createTransferToken.mockResolvedValue(mockToken);

            const allowedHosts = [
                "https://trades.flexfoxfantasy.com",
                "https://staging.trades.akosua.xyz",
                "https://ffftemp.akosua.xyz",
                "https://ffftemp.netlify.app",
            ];

            for (const host of allowedHosts) {
                const caller = createCallerFactory(clientRouter)(createMockContext({}, { user: "123" }));

                const result = await caller.createRedirectToken({
                    redirectTo: `${host}/dashboard`,
                    origin: "https://trades.flexfoxfantasy.com",
                });

                expect(result.token).toBe(mockToken);
            }
        });

        it("should validate input format", async () => {
            const caller = createCallerFactory(clientRouter)(createMockContext({}, { user: "123" }));

            // Invalid URL format
            await expect(
                caller.createRedirectToken({
                    redirectTo: "not-a-url",
                    origin: "https://trades.flexfoxfantasy.com",
                })
            ).rejects.toThrow();

            // Invalid origin format
            await expect(
                caller.createRedirectToken({
                    redirectTo: "https://ffftemp.akosua.xyz/dashboard",
                    origin: "not-a-url",
                })
            ).rejects.toThrow();
        });
    });

    describe("exchangeRedirectToken", () => {
        const validToken = "a".repeat(64);
        const validTokenPayload = {
            sessionId: "original-session-id",
            userId: "123",
        };
        const mockOriginalSession = {
            cookie: {
                originalMaxAge: 86400000,
                expires: new Date("2025-12-31"),
                secure: false,
                httpOnly: true,
                path: "/",
                sameSite: "lax" as const,
            },
            user: "123",
        };

        beforeEach(() => {
            mockUserDao.getUserById.mockResolvedValue(mockUser);
            mockSsoTokens.loadOriginalSession.mockResolvedValue(mockOriginalSession);
        });

        it("should successfully exchange a valid token", async () => {
            mockSsoTokens.consumeTransferToken.mockResolvedValue(validTokenPayload);

            const caller = createCallerFactory(clientRouter)(createMockContext({}, undefined, "ffftemp.akosua.xyz"));

            const result = await caller.exchangeRedirectToken({
                token: validToken,
            });

            expect(result).toEqual({
                success: true,
                user: mockUser,
            });

            expect(mockSsoTokens.consumeTransferToken).toHaveBeenCalledWith(validToken);
            expect(mockUserDao.getUserById).toHaveBeenCalledWith("123");
            expect(mockSsoTokens.loadOriginalSession).toHaveBeenCalledWith("original-session-id");
        });

        it("should reject invalid token format", async () => {
            const caller = createCallerFactory(clientRouter)(createMockContext({}, undefined, "ffftemp.akosua.xyz"));

            // Too short
            await expect(
                caller.exchangeRedirectToken({
                    token: "short",
                })
            ).rejects.toThrow();

            // Too long
            await expect(
                caller.exchangeRedirectToken({
                    token: "a".repeat(65),
                })
            ).rejects.toThrow();

            // Invalid characters
            await expect(
                caller.exchangeRedirectToken({
                    token: "g".repeat(64), // 'g' is not hex
                })
            ).rejects.toThrow();
        });

        it("should reject invalid or expired token", async () => {
            mockSsoTokens.consumeTransferToken.mockResolvedValue(null);

            const caller = createCallerFactory(clientRouter)(createMockContext({}, undefined, "ffftemp.akosua.xyz"));

            await expect(
                caller.exchangeRedirectToken({
                    token: validToken,
                })
            ).rejects.toThrow(TRPCError);
        });

        it("should reject requests from invalid hosts", async () => {
            mockSsoTokens.consumeTransferToken.mockResolvedValue(validTokenPayload);

            const caller = createCallerFactory(clientRouter)(createMockContext({}, undefined, "malicious-site.com"));

            await expect(
                caller.exchangeRedirectToken({
                    token: validToken,
                })
            ).rejects.toThrow(TRPCError);
        });

        it("should handle user not found", async () => {
            mockSsoTokens.consumeTransferToken.mockResolvedValue(validTokenPayload);
            mockUserDao.getUserById.mockRejectedValue(new Error("User not found"));

            const caller = createCallerFactory(clientRouter)(createMockContext({}, undefined, "ffftemp.akosua.xyz"));

            await expect(
                caller.exchangeRedirectToken({
                    token: validToken,
                })
            ).rejects.toThrow(TRPCError);
        });

        it("should handle missing original session", async () => {
            mockSsoTokens.consumeTransferToken.mockResolvedValue(validTokenPayload);
            mockSsoTokens.loadOriginalSession.mockResolvedValue(null);

            const caller = createCallerFactory(clientRouter)(createMockContext({}, undefined, "ffftemp.akosua.xyz"));

            await expect(
                caller.exchangeRedirectToken({
                    token: validToken,
                })
            ).rejects.toThrow(TRPCError);
        });

        it("should accept all allowed request hosts", async () => {
            mockSsoTokens.consumeTransferToken.mockResolvedValue(validTokenPayload);

            const allowedHosts = [
                "trades.flexfoxfantasy.com",
                "staging.trades.akosua.xyz",
                "ffftemp.akosua.xyz",
                "ffftemp.netlify.app",
            ];

            for (const host of allowedHosts) {
                const caller = createCallerFactory(clientRouter)(createMockContext({}, undefined, host));

                const result = await caller.exchangeRedirectToken({
                    token: validToken,
                });

                expect(result.success).toBe(true);
            }
        });

        it("should handle session regeneration errors", async () => {
            mockSsoTokens.consumeTransferToken.mockResolvedValue(validTokenPayload);

            const mockContext = createMockContext({}, undefined, "ffftemp.akosua.xyz");
            mockContext.req.session = {
                regenerate: jest.fn(callback => callback(new Error("Session regeneration failed"))),
            } as any;

            const caller = createCallerFactory(clientRouter)(mockContext);

            await expect(
                caller.exchangeRedirectToken({
                    token: validToken,
                })
            ).rejects.toThrow("Session regeneration failed");
        });

        it("should properly set session data after successful exchange", async () => {
            mockSsoTokens.consumeTransferToken.mockResolvedValue(validTokenPayload);

            const mockContext = createMockContext({}, undefined, "ffftemp.akosua.xyz");
            mockContext.req.session = {
                regenerate: jest.fn(callback => callback()),
                user: undefined,
            } as any;

            const caller = createCallerFactory(clientRouter)(mockContext);

            await caller.exchangeRedirectToken({
                token: validToken,
            });

            expect(mockContext.req.session.user).toBe("123"); // serializeUser returns user ID
        });
    });
});
