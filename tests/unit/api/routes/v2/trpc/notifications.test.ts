import { mockDeep, mockReset } from "jest-mock-extended";
import { notificationsRouter } from "../../../../../../src/api/routes/v2/routers/notifications";
import logger from "../../../../../../src/bootstrap/logger";
import { Context, createCallerFactory } from "../../../../../../src/api/routes/v2/utils/trpcHelpers";
import { ExtendedPrismaClient } from "../../../../../../src/bootstrap/prisma-db";
import UserDAO, { PublicUser } from "../../../../../../src/DAO/v2/UserDAO";
import { Request, Response } from "express";
import { Session } from "express-session";
import { UserRole } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { v4 as uuid } from "uuid";

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

const USER_ID = uuid();

function makeUser(overrides: Partial<PublicUser> = {}): PublicUser {
    return {
        id: USER_ID,
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

describe("[TRPC] Notifications Router Unit Tests", () => {
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
            header: (_name: string) => undefined as string | undefined,
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
        logger.debug("~~~~~~TRPC NOTIFICATIONS ROUTER UNIT TESTS BEGIN~~~~~~");
    });

    afterAll(() => {
        logger.debug("~~~~~~TRPC NOTIFICATIONS ROUTER UNIT TESTS COMPLETE~~~~~~");
    });

    afterEach(() => {
        mockReset(mockPrisma);
        mockReset(mockUserDao);
        jest.clearAllMocks();
    });

    // ─── notifications.get ────────────────────────────────────────────────────

    describe("notifications.get", () => {
        it("returns resolved defaults when userSettings is empty", async () => {
            const user = makeUser();
            mockUserDao.getUserById.mockResolvedValueOnce(user);
            mockPrisma.user.findUniqueOrThrow.mockResolvedValueOnce({
                userSettings: {},
            } as any);

            const caller = createCallerFactory(notificationsRouter)(createMockContext(user));
            const result = await caller.get();

            expect(result.notifications.tradeActionEmail).toBe(true);
            expect(result.notifications.tradeActionDiscordDm).toBe(false);
            expect(result.settingsUpdatedAt).toBeNull();
            expect(result.schemaVersion).toBe(1);
        });

        it("returns explicit values when set in DB", async () => {
            const user = makeUser();
            mockUserDao.getUserById.mockResolvedValueOnce(user);
            mockPrisma.user.findUniqueOrThrow.mockResolvedValueOnce({
                userSettings: {
                    schemaVersion: 1,
                    settingsUpdatedAt: "2026-04-12T00:00:00Z",
                    notifications: { tradeActionDiscordDm: true, tradeActionEmail: false },
                },
            } as any);

            const caller = createCallerFactory(notificationsRouter)(createMockContext(user));
            const result = await caller.get();

            expect(result.notifications.tradeActionDiscordDm).toBe(true);
            expect(result.notifications.tradeActionEmail).toBe(false);
            expect(result.settingsUpdatedAt).toBe("2026-04-12T00:00:00Z");
        });

        it("returns defaults when userSettings is null", async () => {
            const user = makeUser();
            mockUserDao.getUserById.mockResolvedValueOnce(user);
            mockPrisma.user.findUniqueOrThrow.mockResolvedValueOnce({
                userSettings: null,
            } as any);

            const caller = createCallerFactory(notificationsRouter)(createMockContext(user));
            const result = await caller.get();

            expect(result.notifications.tradeActionEmail).toBe(true);
            expect(result.notifications.tradeActionDiscordDm).toBe(false);
        });
    });

    // ─── notifications.update ─────────────────────────────────────────────────

    describe("notifications.update", () => {
        it("enables Discord DM and persists update", async () => {
            const user = makeUser();
            mockUserDao.getUserById.mockResolvedValueOnce(user);

            mockPrisma.user.findUniqueOrThrow.mockResolvedValueOnce({
                userSettings: {},
            } as any);

            const updatedSettings = {
                schemaVersion: 1,
                settingsUpdatedAt: new Date().toISOString(),
                notifications: { tradeActionDiscordDm: true, tradeActionEmail: true },
            };
            mockPrisma.user.update.mockResolvedValueOnce({
                userSettings: updatedSettings,
            } as any);

            const caller = createCallerFactory(notificationsRouter)(createMockContext(user));
            const result = await caller.update({ tradeActionDiscordDm: true });

            expect(result.notifications.tradeActionDiscordDm).toBe(true);
            expect(result.notifications.tradeActionEmail).toBe(true);
            expect(mockPrisma.user.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: USER_ID },
                    data: expect.objectContaining({
                        userSettings: expect.objectContaining({
                            notifications: expect.objectContaining({
                                tradeActionDiscordDm: true,
                                tradeActionEmail: true,
                            }),
                        }),
                    }),
                })
            );
        });

        it("allows disabling email when Discord is on", async () => {
            const user = makeUser();
            mockUserDao.getUserById.mockResolvedValueOnce(user);

            mockPrisma.user.findUniqueOrThrow.mockResolvedValueOnce({
                userSettings: {
                    notifications: { tradeActionDiscordDm: true, tradeActionEmail: true },
                },
            } as any);

            const updatedSettings = {
                schemaVersion: 1,
                settingsUpdatedAt: new Date().toISOString(),
                notifications: { tradeActionDiscordDm: true, tradeActionEmail: false },
            };
            mockPrisma.user.update.mockResolvedValueOnce({
                userSettings: updatedSettings,
            } as any);

            const caller = createCallerFactory(notificationsRouter)(createMockContext(user));
            const result = await caller.update({ tradeActionEmail: false });

            expect(result.notifications.tradeActionEmail).toBe(false);
            expect(result.notifications.tradeActionDiscordDm).toBe(true);
        });

        it("rejects update when both channels would be disabled", async () => {
            const user = makeUser();
            mockUserDao.getUserById.mockResolvedValueOnce(user);

            mockPrisma.user.findUniqueOrThrow.mockResolvedValueOnce({
                userSettings: {
                    notifications: { tradeActionDiscordDm: false, tradeActionEmail: true },
                },
            } as any);

            const caller = createCallerFactory(notificationsRouter)(createMockContext(user));

            await expect(caller.update({ tradeActionEmail: false })).rejects.toMatchObject({
                code: "BAD_REQUEST",
            });
            expect(mockPrisma.user.update).not.toHaveBeenCalled();
        });

        it("no-op patch returns current values", async () => {
            const user = makeUser();
            mockUserDao.getUserById.mockResolvedValueOnce(user);

            const existing = {
                schemaVersion: 1,
                settingsUpdatedAt: "2026-04-12T00:00:00Z",
                notifications: { tradeActionDiscordDm: false, tradeActionEmail: true },
            };
            mockPrisma.user.findUniqueOrThrow.mockResolvedValueOnce({
                userSettings: existing,
            } as any);

            mockPrisma.user.update.mockResolvedValueOnce({
                userSettings: {
                    ...existing,
                    settingsUpdatedAt: new Date().toISOString(),
                },
            } as any);

            const caller = createCallerFactory(notificationsRouter)(createMockContext(user));
            const result = await caller.update({});

            expect(result.notifications.tradeActionEmail).toBe(true);
            expect(result.notifications.tradeActionDiscordDm).toBe(false);
        });
    });
});
