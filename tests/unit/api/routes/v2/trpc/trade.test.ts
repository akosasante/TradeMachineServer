import { mockDeep, mockReset } from "jest-mock-extended";
import { tradeRouter } from "../../../../../../src/api/routes/v2/routers/trade";
import logger from "../../../../../../src/bootstrap/logger";
import { Context, createCallerFactory } from "../../../../../../src/api/routes/v2/utils/trpcHelpers";
import { ExtendedPrismaClient } from "../../../../../../src/bootstrap/prisma-db";
import UserDAO, { PublicUser } from "../../../../../../src/DAO/v2/UserDAO";
import { Request, Response } from "express";
import { Session } from "express-session";
import { Prisma, TradeParticipantType, TradeStatus, UserRole } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { v4 as uuid } from "uuid";
import type { PrismaTrade } from "../../../../../../src/DAO/v2/TradeDAO";

// ─── Mocks ────────────────────────────────────────────────────────────────────

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

jest.mock("../../../../../../src/bootstrap/metrics", () => ({
    activeUserMetric: { inc: jest.fn() },
    activeSessionsMetric: { inc: jest.fn() },
    tradeActionTokenGeneratedMetric: { inc: jest.fn() },
    tradeActionTokenExchangedMetric: { inc: jest.fn() },
    tradeActionTokenFailedMetric: { inc: jest.fn() },
    transferTokenExchangedMetric: { inc: jest.fn() },
    transferTokenFailedMetric: { inc: jest.fn() },
    transferTokenGeneratedMetric: { inc: jest.fn() },
    metricsMiddleware: jest.fn((_req: unknown, _res: unknown, next: () => void) => next()),
    metricsRegistry: { getSingleMetric: jest.fn() },
}));

jest.mock("../../../../../../src/api/routes/v2/utils/tradeActionTokens", () => ({
    createTradeActionToken: jest.fn(() => Promise.resolve("mock-token-abc")),
}));

// ─── Factories ────────────────────────────────────────────────────────────────

const CREATOR_USER_ID = uuid();
const RECIPIENT_USER_ID = uuid();
const RECIPIENT_2_USER_ID = uuid();
const TRADE_ID = uuid();
const CREATOR_TEAM_ID = uuid();
const RECIPIENT_TEAM_ID = uuid();
const RECIPIENT_2_TEAM_ID = uuid();

function makeTrade(overrides: Partial<PrismaTrade> = {}): PrismaTrade {
    return {
        id: TRADE_ID,
        dateCreated: new Date(),
        dateModified: new Date(),
        status: TradeStatus.REQUESTED,
        declinedReason: null,
        declinedById: null,
        acceptedBy: [],
        acceptedByDetails: [],
        acceptedOnDate: null,
        submittedAt: null,
        submittedById: null,
        emails: [],
        tradeParticipants: [
            {
                id: uuid(),
                dateCreated: new Date(),
                dateModified: new Date(),
                participantType: TradeParticipantType.CREATOR,
                tradeId: TRADE_ID,
                teamId: CREATOR_TEAM_ID,
                team: {
                    id: CREATOR_TEAM_ID,
                    owners: [{ id: CREATOR_USER_ID }],
                } as any,
            },
            {
                id: uuid(),
                dateCreated: new Date(),
                dateModified: new Date(),
                participantType: TradeParticipantType.RECIPIENT,
                tradeId: TRADE_ID,
                teamId: RECIPIENT_TEAM_ID,
                team: {
                    id: RECIPIENT_TEAM_ID,
                    owners: [{ id: RECIPIENT_USER_ID }],
                } as any,
            },
        ],
        tradeItems: [],
        ...overrides,
    } as unknown as PrismaTrade;
}

function makeUser(overrides: Partial<PublicUser> = {}): PublicUser {
    return {
        id: RECIPIENT_USER_ID,
        dateCreated: new Date(),
        dateModified: new Date(),
        email: "user@example.com",
        displayName: "Test User",
        slackUsername: null,
        discordUserId: null,
        role: UserRole.OWNER,
        lastLoggedIn: new Date(),
        passwordResetExpiresOn: null,
        passwordResetToken: null,
        status: "ACTIVE",
        csvName: null,
        espnMember: null,
        teamId: null,
        isAdmin: () => false,
        ...overrides,
    } as unknown as PublicUser;
}

// ─── Context helpers ──────────────────────────────────────────────────────────

describe("[TRPC] Trades Router Unit Tests", () => {
    const mockPrisma = mockDeep<ExtendedPrismaClient>();
    const mockUserDao = mockDeep<UserDAO>();
    const mockReq = mockDeep<Request>();
    const mockRes = mockDeep<Response>();

    function createMockContext(
        user: PublicUser,
        sessionData?: Partial<Session & { user?: string }>
    ): Context & { user: PublicUser } {
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
            regenerate: jest.fn(cb => cb(null)),
            destroy: jest.fn(cb => cb(null)),
            reload: jest.fn(cb => cb(null)),
            save: jest.fn(cb => cb?.(null)),
            touch: jest.fn(() => session),
            resetMaxAge: jest.fn(() => session),
            user: user.id,
            ...sessionData,
        } as Session & { user?: string };

        const req = {
            ...mockReq,
            headers: { origin: "https://trades.flexfoxfantasy.com" },
            header: (name: string) => undefined as string | undefined,
            connection: { remoteAddress: "127.0.0.1" },
            socket: { remoteAddress: "127.0.0.1" },
            sessionID: "test-session-id",
            hostname: "trades.flexfoxfantasy.com",
            session,
        } as unknown as Request;

        return {
            req,
            res: mockRes as unknown as Response,
            session,
            prisma: mockPrisma as unknown as ExtendedPrismaClient,
            userDao: mockUserDao as unknown as UserDAO,
            user,
        };
    }

    beforeAll(() => {
        logger.debug("~~~~~~TRPC TRADES ROUTER UNIT TESTS BEGIN~~~~~~");
    });

    afterAll(() => {
        logger.debug("~~~~~~TRPC TRADES ROUTER UNIT TESTS COMPLETE~~~~~~");
    });

    afterEach(() => {
        // mockReset clears both call history AND queued mockResolvedValueOnce responses,
        // preventing stale mock responses from polluting subsequent tests.
        mockReset(mockPrisma);
        mockReset(mockUserDao);
        jest.clearAllMocks();
    });

    // ─── trades.get ────────────────────────────────────────────────────────────

    describe("trades.get", () => {
        it("should return the trade when found", async () => {
            const user = makeUser();
            const trade = makeTrade();
            mockUserDao.getUserById.mockResolvedValueOnce(user);
            mockPrisma.trade.findUniqueOrThrow.mockResolvedValueOnce(trade as any);

            const caller = createCallerFactory(tradeRouter)(createMockContext(user));
            const result = await caller.get({ tradeId: TRADE_ID });

            expect(result).toEqual(trade);
            expect(mockPrisma.trade.findUniqueOrThrow).toHaveBeenCalledWith(
                expect.objectContaining({ where: { id: TRADE_ID } })
            );
        });

        it("should propagate NOT_FOUND when trade does not exist", async () => {
            const user = makeUser();
            const notFound = new Prisma.PrismaClientKnownRequestError("Not found", {
                code: "P2025",
                clientVersion: "test",
            });
            mockUserDao.getUserById.mockResolvedValueOnce(user);
            mockPrisma.trade.findUniqueOrThrow.mockRejectedValueOnce(notFound);

            const caller = createCallerFactory(tradeRouter)(createMockContext(user));
            await expect(caller.get({ tradeId: TRADE_ID })).rejects.toMatchObject({
                code: "NOT_FOUND",
            });
        });
    });

    // ─── trades.list ─────────────────────────────────────────────────────────────

    describe("trades.list", () => {
        it("should return empty list when user has no teamId without calling prisma", async () => {
            const user = makeUser({ teamId: null });
            mockUserDao.getUserById.mockResolvedValueOnce(user);

            const caller = createCallerFactory(tradeRouter)(createMockContext(user));
            const result = await caller.list({ page: 0, pageSize: 20 });

            expect(result).toEqual({ trades: [], total: 0, page: 0, pageSize: 20 });
            expect(mockPrisma.trade.findMany).not.toHaveBeenCalled();
            expect(mockPrisma.trade.count).not.toHaveBeenCalled();
        });

        it("should return trades and total from TradeDAO for user with teamId", async () => {
            const user = makeUser({ id: RECIPIENT_USER_ID, teamId: RECIPIENT_TEAM_ID });
            const trade = makeTrade();
            mockUserDao.getUserById.mockResolvedValueOnce(user);
            mockPrisma.trade.findMany.mockResolvedValueOnce([trade] as any);
            mockPrisma.trade.count.mockResolvedValueOnce(7);

            const caller = createCallerFactory(tradeRouter)(createMockContext(user));
            const result = await caller.list({ page: 2, pageSize: 15 });

            expect(result).toEqual({
                trades: [trade],
                total: 7,
                page: 2,
                pageSize: 15,
            });
            expect(mockPrisma.trade.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        tradeParticipants: { some: { teamId: RECIPIENT_TEAM_ID } },
                    }),
                    skip: 30,
                    take: 15,
                })
            );
        });

        it("should forward statuses filter to prisma", async () => {
            const user = makeUser({ teamId: RECIPIENT_TEAM_ID });
            mockUserDao.getUserById.mockResolvedValueOnce(user);
            mockPrisma.trade.findMany.mockResolvedValueOnce([] as any);
            mockPrisma.trade.count.mockResolvedValueOnce(0);

            const caller = createCallerFactory(tradeRouter)(createMockContext(user));
            await caller.list({
                page: 0,
                pageSize: 20,
                statuses: [TradeStatus.REQUESTED, TradeStatus.ACCEPTED],
            });

            expect(mockPrisma.trade.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        status: { in: [TradeStatus.REQUESTED, TradeStatus.ACCEPTED] },
                    }),
                })
            );
        });
    });

    // ─── trades.accept ─────────────────────────────────────────────────────────

    describe("trades.accept", () => {
        it("should accept a trade and transition to PENDING when not all accepted", async () => {
            const user = makeUser({ id: RECIPIENT_USER_ID });
            // Two recipient teams so that only one accepting still leaves allAccepted = false
            const trade = makeTrade({
                status: TradeStatus.REQUESTED,
                tradeParticipants: [
                    {
                        id: uuid(),
                        dateCreated: new Date(),
                        dateModified: new Date(),
                        participantType: TradeParticipantType.CREATOR,
                        tradeId: TRADE_ID,
                        teamId: CREATOR_TEAM_ID,
                        team: { id: CREATOR_TEAM_ID, owners: [{ id: CREATOR_USER_ID }] } as any,
                    },
                    {
                        id: uuid(),
                        dateCreated: new Date(),
                        dateModified: new Date(),
                        participantType: TradeParticipantType.RECIPIENT,
                        tradeId: TRADE_ID,
                        teamId: RECIPIENT_TEAM_ID,
                        team: { id: RECIPIENT_TEAM_ID, owners: [{ id: RECIPIENT_USER_ID }] } as any,
                    },
                    {
                        id: uuid(),
                        dateCreated: new Date(),
                        dateModified: new Date(),
                        participantType: TradeParticipantType.RECIPIENT,
                        tradeId: TRADE_ID,
                        teamId: RECIPIENT_2_TEAM_ID,
                        team: { id: RECIPIENT_2_TEAM_ID, owners: [{ id: RECIPIENT_2_USER_ID }] } as any,
                    },
                ],
            } as any);
            mockUserDao.getUserById.mockResolvedValueOnce(user);
            // getTradeById (initial fetch)
            mockPrisma.trade.findUniqueOrThrow.mockResolvedValueOnce(trade as any);
            // updateAcceptedBy (PENDING): single update + re-fetch
            mockPrisma.trade.update.mockResolvedValueOnce(trade as any);
            mockPrisma.trade.findUniqueOrThrow.mockResolvedValueOnce({
                ...trade,
                acceptedBy: [RECIPIENT_USER_ID],
                status: TradeStatus.PENDING,
            } as any);

            const caller = createCallerFactory(tradeRouter)(createMockContext(user));
            const result = await caller.accept({ tradeId: TRADE_ID, skipNotifications: true });

            expect(result.allAccepted).toBe(false);
            expect(mockPrisma.trade.update).toHaveBeenCalledTimes(1);
            expect(mockPrisma.trade.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        acceptedBy: [RECIPIENT_USER_ID],
                        status: TradeStatus.PENDING,
                    }),
                })
            );
        });

        it("should transition to ACCEPTED when all recipient teams accepted", async () => {
            const user = makeUser({ id: RECIPIENT_USER_ID });
            // Single recipient team — one acceptance = all accepted
            const trade = makeTrade({ status: TradeStatus.PENDING });
            mockUserDao.getUserById.mockResolvedValueOnce(user);
            // initial getTradeById
            mockPrisma.trade.findUniqueOrThrow.mockResolvedValueOnce(trade as any);
            // updateAcceptedBy (ACCEPTED): single update + re-fetch
            mockPrisma.trade.update.mockResolvedValueOnce(trade as any);
            mockPrisma.trade.findUniqueOrThrow.mockResolvedValueOnce({
                ...trade,
                acceptedBy: [RECIPIENT_USER_ID],
                status: TradeStatus.ACCEPTED,
            } as any);

            const caller = createCallerFactory(tradeRouter)(createMockContext(user));
            const result = await caller.accept({ tradeId: TRADE_ID, skipNotifications: true });

            expect(result.allAccepted).toBe(true);
            expect(result.trade.status).toBe(TradeStatus.ACCEPTED);
            expect(mockPrisma.trade.update).toHaveBeenCalledTimes(1);
            expect(mockPrisma.trade.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({ status: TradeStatus.ACCEPTED }),
                })
            );
        });

        it("should throw FORBIDDEN if user is not a recipient", async () => {
            const outsider = makeUser({ id: uuid() });
            const trade = makeTrade({ status: TradeStatus.REQUESTED });
            mockUserDao.getUserById.mockResolvedValueOnce(outsider);
            mockPrisma.trade.findUniqueOrThrow.mockResolvedValueOnce(trade as any);

            const caller = createCallerFactory(tradeRouter)(createMockContext(outsider));
            await expect(caller.accept({ tradeId: TRADE_ID, skipNotifications: true })).rejects.toMatchObject({
                code: "FORBIDDEN",
            });
        });

        it("should throw BAD_REQUEST if user already accepted", async () => {
            const user = makeUser({ id: RECIPIENT_USER_ID });
            const trade = makeTrade({
                status: TradeStatus.PENDING,
                acceptedBy: [RECIPIENT_USER_ID],
            });
            mockUserDao.getUserById.mockResolvedValueOnce(user);
            mockPrisma.trade.findUniqueOrThrow.mockResolvedValueOnce(trade as any);

            const caller = createCallerFactory(tradeRouter)(createMockContext(user));
            await expect(caller.accept({ tradeId: TRADE_ID, skipNotifications: true })).rejects.toMatchObject({
                code: "BAD_REQUEST",
            });
        });

        it("should allow admin to accept on behalf of another user via actingAsUserId", async () => {
            const admin = makeUser({
                id: uuid(),
                role: UserRole.ADMIN,
                isAdmin: () => true,
            });
            const trade = makeTrade({ status: TradeStatus.REQUESTED });
            mockUserDao.getUserById.mockResolvedValueOnce(admin);
            // initial getTradeById
            mockPrisma.trade.findUniqueOrThrow.mockResolvedValueOnce(trade as any);
            // updateAcceptedBy (ACCEPTED): single update + re-fetch
            mockPrisma.trade.update.mockResolvedValueOnce(trade as any);
            mockPrisma.trade.findUniqueOrThrow.mockResolvedValueOnce({
                ...trade,
                acceptedBy: [RECIPIENT_USER_ID],
                status: TradeStatus.ACCEPTED,
            } as any);

            const caller = createCallerFactory(tradeRouter)(createMockContext(admin));
            const result = await caller.accept({
                tradeId: TRADE_ID,
                actingAsUserId: RECIPIENT_USER_ID,
                skipNotifications: true,
            });

            expect(result.allAccepted).toBe(true);
            expect(mockPrisma.trade.update).toHaveBeenCalledTimes(1);
        });

        it("should throw FORBIDDEN if non-admin tries to use actingAsUserId", async () => {
            const user = makeUser({ id: RECIPIENT_USER_ID });
            const trade = makeTrade();
            mockUserDao.getUserById.mockResolvedValueOnce(user);
            mockPrisma.trade.findUniqueOrThrow.mockResolvedValueOnce(trade as any);

            const caller = createCallerFactory(tradeRouter)(createMockContext(user));
            await expect(
                caller.accept({ tradeId: TRADE_ID, actingAsUserId: uuid(), skipNotifications: true })
            ).rejects.toMatchObject({ code: "FORBIDDEN" });
        });
    });

    // ─── trades.decline ────────────────────────────────────────────────────────

    describe("trades.decline", () => {
        it("should decline a trade and transition to REJECTED", async () => {
            const user = makeUser({ id: RECIPIENT_USER_ID });
            const trade = makeTrade({ status: TradeStatus.REQUESTED });
            const declinedTrade = { ...trade, status: TradeStatus.REJECTED, declinedById: RECIPIENT_USER_ID };
            mockUserDao.getUserById.mockResolvedValueOnce(user);
            // initial getTradeById
            mockPrisma.trade.findUniqueOrThrow.mockResolvedValueOnce(trade as any);
            // updateDeclinedBy: single update (declinedById + status REJECTED) + re-fetch
            mockPrisma.trade.update.mockResolvedValueOnce(declinedTrade as any);
            mockPrisma.trade.findUniqueOrThrow.mockResolvedValueOnce(declinedTrade as any);

            const caller = createCallerFactory(tradeRouter)(createMockContext(user));
            const result = await caller.decline({ tradeId: TRADE_ID, skipNotifications: true });

            expect(result.status).toBe(TradeStatus.REJECTED);
            expect(mockPrisma.trade.update).toHaveBeenCalledTimes(1);
            expect(mockPrisma.trade.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        declinedById: RECIPIENT_USER_ID,
                        status: TradeStatus.REJECTED,
                    }),
                })
            );
        });

        it("should throw FORBIDDEN if user is not a participant", async () => {
            const outsider = makeUser({ id: uuid() });
            const trade = makeTrade();
            mockUserDao.getUserById.mockResolvedValueOnce(outsider);
            mockPrisma.trade.findUniqueOrThrow.mockResolvedValueOnce(trade as any);

            const caller = createCallerFactory(tradeRouter)(createMockContext(outsider));
            await expect(caller.decline({ tradeId: TRADE_ID, skipNotifications: true })).rejects.toMatchObject({
                code: "FORBIDDEN",
            });
        });

        it("should pass declinedReason to the DAO", async () => {
            const user = makeUser({ id: RECIPIENT_USER_ID });
            const trade = makeTrade({ status: TradeStatus.REQUESTED });
            mockUserDao.getUserById.mockResolvedValueOnce(user);
            mockPrisma.trade.findUniqueOrThrow.mockResolvedValueOnce(trade as any);
            mockPrisma.trade.update.mockResolvedValueOnce(trade as any);
            mockPrisma.trade.findUniqueOrThrow.mockResolvedValueOnce(trade as any);

            const caller = createCallerFactory(tradeRouter)(createMockContext(user));
            await caller.decline({
                tradeId: TRADE_ID,
                declinedReason: "Not a fair trade",
                skipNotifications: true,
            });

            expect(mockPrisma.trade.update).toHaveBeenCalledTimes(1);
            expect(mockPrisma.trade.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        declinedReason: "Not a fair trade",
                        status: TradeStatus.REJECTED,
                    }),
                })
            );
        });

        it("should throw BAD_REQUEST when status transition is invalid (SUBMITTED)", async () => {
            const user = makeUser({ id: RECIPIENT_USER_ID });
            const submittedTrade = makeTrade({ status: TradeStatus.SUBMITTED });
            mockUserDao.getUserById.mockResolvedValueOnce(user);
            mockPrisma.trade.findUniqueOrThrow.mockResolvedValueOnce(submittedTrade as any);

            const caller = createCallerFactory(tradeRouter)(createMockContext(user));
            await expect(caller.decline({ tradeId: TRADE_ID, skipNotifications: true })).rejects.toMatchObject({
                code: "BAD_REQUEST",
            });
        });
    });

    // ─── trades.submit ─────────────────────────────────────────────────────────

    describe("trades.submit", () => {
        it("should submit an accepted trade", async () => {
            const user = makeUser({ id: CREATOR_USER_ID });
            const trade = makeTrade({ status: TradeStatus.ACCEPTED });
            const submittedTrade = { ...trade, status: TradeStatus.SUBMITTED };
            mockUserDao.getUserById.mockResolvedValueOnce(user);
            // initial getTradeById
            mockPrisma.trade.findUniqueOrThrow.mockResolvedValueOnce(trade as any);
            // updateSubmitted: single update (submittedAt, submittedById, status SUBMITTED) + re-fetch
            mockPrisma.trade.update.mockResolvedValueOnce(submittedTrade as any);
            mockPrisma.trade.findUniqueOrThrow.mockResolvedValueOnce(submittedTrade as any);

            const caller = createCallerFactory(tradeRouter)(createMockContext(user));
            const result = await caller.submit({ tradeId: TRADE_ID, skipNotifications: true });

            expect(result.status).toBe(TradeStatus.SUBMITTED);
            expect(mockPrisma.trade.update).toHaveBeenCalledTimes(1);
            expect(mockPrisma.trade.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        submittedAt: expect.any(Date),
                        submittedById: CREATOR_USER_ID,
                        status: TradeStatus.SUBMITTED,
                    }),
                })
            );
        });

        it("should throw FORBIDDEN if user is not the trade creator", async () => {
            const recipient = makeUser({ id: RECIPIENT_USER_ID });
            const trade = makeTrade({ status: TradeStatus.ACCEPTED });
            mockUserDao.getUserById.mockResolvedValueOnce(recipient);
            mockPrisma.trade.findUniqueOrThrow.mockResolvedValueOnce(trade as any);

            const caller = createCallerFactory(tradeRouter)(createMockContext(recipient));
            await expect(caller.submit({ tradeId: TRADE_ID, skipNotifications: true })).rejects.toMatchObject({
                code: "FORBIDDEN",
            });
        });

        it("should throw BAD_REQUEST when trade status does not allow submission", async () => {
            const user = makeUser({ id: CREATOR_USER_ID });
            const trade = makeTrade({ status: TradeStatus.REQUESTED });
            mockUserDao.getUserById.mockResolvedValueOnce(user);
            mockPrisma.trade.findUniqueOrThrow.mockResolvedValueOnce(trade as any);

            const caller = createCallerFactory(tradeRouter)(createMockContext(user));
            await expect(caller.submit({ tradeId: TRADE_ID, skipNotifications: true })).rejects.toMatchObject({
                code: "BAD_REQUEST",
            });
        });

        it("should throw FORBIDDEN if non-admin tries to use actingAsUserId", async () => {
            const user = makeUser({ id: CREATOR_USER_ID });
            const trade = makeTrade();
            mockUserDao.getUserById.mockResolvedValueOnce(user);
            mockPrisma.trade.findUniqueOrThrow.mockResolvedValueOnce(trade as any);

            const caller = createCallerFactory(tradeRouter)(createMockContext(user));
            await expect(
                caller.submit({ tradeId: TRADE_ID, actingAsUserId: uuid(), skipNotifications: true })
            ).rejects.toMatchObject({ code: "FORBIDDEN" });
        });
    });
});
