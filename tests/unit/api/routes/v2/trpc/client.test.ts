import { mockClear, mockDeep } from "jest-mock-extended";
import { clientRouter } from "../../../../../../src/api/routes/v2/routers/client";
import logger from "../../../../../../src/bootstrap/logger";
import { Context, createCallerFactory } from "../../../../../../src/api/routes/v2/trpcHelpers";
import { ExtendedPrismaClient } from "../../../../../../src/bootstrap/prisma-db";
import UserDAO from "../../../../../../src/DAO/v2/UserDAO";
import { Request, Response } from "express";

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

describe("[TRPC] Client Router Unit Tests", () => {
    const mockPrisma = mockDeep<ExtendedPrismaClient>();
    const mockUserDao = mockDeep<UserDAO>();
    const mockReq = mockDeep<Request>();
    const mockRes = mockDeep<Response>();

    const createMockContext = (headers: Record<string, string | string[]> = {}): Context => {
        const req = {
            ...mockReq,
            headers,
            connection: { remoteAddress: "192.168.1.100" },
            socket: { remoteAddress: "192.168.1.100" },
        } as unknown as Request;

        return {
            req,
            res: mockRes as unknown as Response,
            session: undefined,
            prisma: mockPrisma as unknown as ExtendedPrismaClient,
            userDao: mockUserDao as unknown as UserDAO,
        };
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
});
