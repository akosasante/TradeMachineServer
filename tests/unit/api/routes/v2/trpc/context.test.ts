import { Request, Response } from "express";
import { mockDeep, mockClear } from "jest-mock-extended";
import { createContext } from "../../../../../../src/api/routes/v2/utils/context";
import { ExtendedPrismaClient } from "../../../../../../src/bootstrap/prisma-db";
import UserDAO from "../../../../../../src/DAO/v2/UserDAO";
import logger from "../../../../../../src/bootstrap/logger";

describe("[TRPC] Context Creation", () => {
    const mockReq = mockDeep<Request>();
    const mockRes = mockDeep<Response>();
    const mockPrisma = mockDeep<ExtendedPrismaClient>();

    beforeAll(() => {
        logger.debug("~~~~~~TRPC CONTEXT TESTS BEGIN~~~~~~");
    });
    afterAll(() => {
        logger.debug("~~~~~~TRPC CONTEXT TESTS COMPLETE~~~~~~");
    });

    beforeEach(() => {
        // Mock Express app with settings containing prisma client
        const mockApp = {
            settings: {
                prisma: mockPrisma,
            },
        };
        (mockReq as any).app = mockApp;

        // Mock session
        (mockReq as any).session = {
            user: "test-user-id",
        };
    });

    afterEach(() => {
        mockClear(mockReq);
        mockClear(mockRes);
        mockClear(mockPrisma);
    });

    describe("createContext", () => {
        it("should create context with req, res, session, prisma, and userDAO", () => {
            const context = createContext({ req: mockReq, res: mockRes });

            expect(context.req).toBe(mockReq);
            expect(context.res).toBe(mockRes);
            expect(context.session).toEqual({ user: "test-user-id" });
            expect(context.prisma).toBe(mockPrisma);
            expect(context.userDao).toBeInstanceOf(UserDAO);
        });

        it("should handle missing session gracefully", () => {
            (mockReq as any).session = undefined;

            const context = createContext({ req: mockReq, res: mockRes });

            expect(context.session).toBeUndefined();
            expect(context.prisma).toBe(mockPrisma);
            expect(context.userDao).toBeInstanceOf(UserDAO);
        });
    });
});
