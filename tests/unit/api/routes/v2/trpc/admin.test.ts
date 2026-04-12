import { mockClear, mockDeep } from "jest-mock-extended";
import { adminRouter } from "../../../../../../src/api/routes/v2/routers/admin";
import { Context, createCallerFactory } from "../../../../../../src/api/routes/v2/utils/trpcHelpers";
import { ExtendedPrismaClient } from "../../../../../../src/bootstrap/prisma-db";
import UserDAO, { PublicUser } from "../../../../../../src/DAO/v2/UserDAO";
import TeamDAO from "../../../../../../src/DAO/v2/TeamDAO";
import PlayerDAO from "../../../../../../src/DAO/v2/PlayerDAO";
import DraftPickDAO from "../../../../../../src/DAO/v2/DraftPickDAO";
import ObanDAO from "../../../../../../src/DAO/v2/ObanDAO";
import SyncJobExecutionDAO from "../../../../../../src/DAO/v2/SyncJobExecutionDAO";
import { Request, Response } from "express";
import { TRPCError } from "@trpc/server";
import { Session } from "express-session";
import { UserRole, UserStatus, oban_job_state, SyncJobType, SyncJobStatus } from "@prisma/client";

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
    activeUserMetric: mockDeep(),
    activeSessionsMetric: mockDeep(),
    transferTokenExchangedMetric: mockDeep(),
    transferTokenFailedMetric: mockDeep(),
    transferTokenGeneratedMetric: mockDeep(),
    metricsMiddleware: jest.fn((_req: any, _res: any, next: any) => next()),
    metricsRegistry: mockDeep(),
}));

describe("[TRPC] Admin Router Unit Tests", () => {
    const mockPrisma = mockDeep<ExtendedPrismaClient>();
    const mockUserDao = mockDeep<UserDAO>();
    const mockTeamDao = mockDeep<TeamDAO>();
    const mockPlayerDao = mockDeep<PlayerDAO>();
    const mockDraftPickDao = mockDeep<DraftPickDAO>();
    const mockObanDao = mockDeep<ObanDAO>();
    const mockSyncJobExecutionDao = mockDeep<SyncJobExecutionDAO>();
    const mockReq = mockDeep<Request>();
    const mockRes = mockDeep<Response>();

    const createCaller = createCallerFactory(adminRouter);

    const baseUser = {
        id: "user-1",
        dateCreated: new Date(),
        dateModified: new Date(),
        email: "admin@test.com",
        displayName: "Admin",
        slackUsername: null,
        discordUserId: null,
        role: UserRole.ADMIN,
        lastLoggedIn: new Date(),
        passwordResetExpiresOn: null,
        passwordResetToken: null,
        status: UserStatus.ACTIVE,
        csvName: null,
        espnMember: null,
        teamId: null,
        isAdmin: () => true,
    } as unknown as PublicUser;

    function createMockContext(role: UserRole): Context {
        const user = { ...baseUser, role, isAdmin: () => role === UserRole.ADMIN } as unknown as PublicUser;
        const session: Session & { user?: string } = {
            id: "test-session",
            cookie: {
                originalMaxAge: 86400000,
                expires: new Date(Date.now() + 86400000),
                secure: false,
                httpOnly: true,
                path: "/",
                sameSite: "lax" as const,
            },
            regenerate: jest.fn((cb: any) => cb(null)),
            destroy: jest.fn((cb: any) => cb(null)),
            reload: jest.fn((cb: any) => cb(null)),
            save: jest.fn((cb: any) => cb?.(null)),
            touch: jest.fn(),
            resetMaxAge: jest.fn(),
            user: user.id,
        } as unknown as Session & { user?: string };

        mockUserDao.getUserById.mockResolvedValue(user as any);

        return {
            req: { ...mockReq, session, headers: {} } as unknown as Request,
            res: mockRes as unknown as Response,
            session,
            prisma: mockPrisma as unknown as ExtendedPrismaClient,
            userDao: mockUserDao as unknown as UserDAO,
            teamDao: mockTeamDao as unknown as TeamDAO,
            playerDao: mockPlayerDao as unknown as PlayerDAO,
            draftPickDao: mockDraftPickDao as unknown as DraftPickDAO,
            obanDao: mockObanDao as unknown as ObanDAO,
            syncJobExecutionDao: mockSyncJobExecutionDao as unknown as SyncJobExecutionDAO,
        };
    }

    beforeEach(() => {
        mockClear(mockPrisma);
        mockClear(mockUserDao);
        mockClear(mockTeamDao);
        mockClear(mockPlayerDao);
        mockClear(mockDraftPickDao);
        mockClear(mockObanDao);
        mockClear(mockSyncJobExecutionDao);
        mockClear(mockReq);
        mockClear(mockRes);
    });

    // ─── RBAC ─────────────────────────────────────────────────────

    describe("RBAC - admin can delete users", () => {
        it("should allow admin to delete a user", async () => {
            const ctx = createMockContext(UserRole.ADMIN);
            const caller = createCaller(ctx);
            mockUserDao.deleteUser.mockResolvedValue(baseUser as any);

            const targetId = "00000000-0000-0000-0000-000000000002";
            const result = await caller.users.delete({ id: targetId });
            expect(mockUserDao.deleteUser).toHaveBeenCalledWith(targetId);
            expect(result).toBeDefined();
        });
    });

    describe("RBAC - commissioner cannot delete users", () => {
        it("should reject commissioner deleting a user", async () => {
            const ctx = createMockContext(UserRole.COMMISSIONER);
            const caller = createCaller(ctx);

            await expect(caller.users.delete({ id: "00000000-0000-0000-0000-000000000002" })).rejects.toThrow(TRPCError);
        });
    });

    describe("RBAC - owner cannot access admin routes", () => {
        it("should reject owner listing users", async () => {
            const ctx = createMockContext(UserRole.OWNER);
            const caller = createCaller(ctx);

            await expect(caller.users.list()).rejects.toThrow(TRPCError);
        });
    });

    describe("RBAC - commissioner can list users", () => {
        it("should allow commissioner to list users", async () => {
            const ctx = createMockContext(UserRole.COMMISSIONER);
            const caller = createCaller(ctx);
            mockUserDao.getAllUsersWithTeams.mockResolvedValue([baseUser] as any);

            const result = await caller.users.list();
            expect(result).toHaveLength(1);
        });
    });

    describe("RBAC - commissioner can list picks but not create", () => {
        it("should allow commissioner to list picks", async () => {
            const ctx = createMockContext(UserRole.COMMISSIONER);
            const caller = createCaller(ctx);
            mockDraftPickDao.getAllPicks.mockResolvedValue([]);

            const result = await caller.picks.list();
            expect(result).toEqual([]);
        });

        it("should reject commissioner creating picks", async () => {
            const ctx = createMockContext(UserRole.COMMISSIONER);
            const caller = createCaller(ctx);

            await expect(
                caller.picks.create({
                    round: 1,
                    season: 2026,
                    type: "MAJORS" as any,
                })
            ).rejects.toThrow(TRPCError);
        });
    });

    // ─── Sync status ──────────────────────────────────────────────

    describe("sync.status", () => {
        it("should return oban job state and execution data", async () => {
            const ctx = createMockContext(UserRole.ADMIN);
            const caller = createCaller(ctx);

            const obanJob = {
                id: BigInt(42),
                state: oban_job_state.completed,
                completed_at: new Date("2026-01-01T12:00:00Z"),
                errors: [],
            };
            mockObanDao.getJobById.mockResolvedValue(obanJob as any);

            const execution = {
                id: "exec-1",
                status: SyncJobStatus.completed,
                startedAt: new Date("2026-01-01T11:55:00Z"),
                completedAt: new Date("2026-01-01T12:00:00Z"),
                durationMs: 300000,
                recordsProcessed: 150,
                recordsUpdated: 12,
                recordsSkipped: 138,
                errorMessage: null,
            };
            mockSyncJobExecutionDao.getByObanJobId.mockResolvedValue(execution as any);

            const result = await caller.sync.status({ obanJobId: "42" });

            expect(result.obanJobId).toBe("42");
            expect(result.state).toBe(oban_job_state.completed);
            expect(result.isTerminal).toBe(true);
            expect(result.execution).not.toBeNull();
            expect(result.execution!.recordsProcessed).toBe(150);
        });

        it("should return null execution when SyncJobExecution does not exist yet", async () => {
            const ctx = createMockContext(UserRole.ADMIN);
            const caller = createCaller(ctx);

            const obanJob = {
                id: BigInt(43),
                state: oban_job_state.executing,
                completed_at: null,
                errors: [],
            };
            mockObanDao.getJobById.mockResolvedValue(obanJob as any);
            mockSyncJobExecutionDao.getByObanJobId.mockResolvedValue(null);

            const result = await caller.sync.status({ obanJobId: "43" });

            expect(result.state).toBe(oban_job_state.executing);
            expect(result.isTerminal).toBe(false);
            expect(result.execution).toBeNull();
        });

        it("should throw NOT_FOUND when oban job does not exist", async () => {
            const ctx = createMockContext(UserRole.ADMIN);
            const caller = createCaller(ctx);
            mockObanDao.getJobById.mockResolvedValue(null);

            await expect(caller.sync.status({ obanJobId: "999" })).rejects.toThrow(TRPCError);
        });
    });

    // ─── Sync enqueue ─────────────────────────────────────────────

    describe("sync.enqueue", () => {
        it("should enqueue espn_team_sync", async () => {
            const ctx = createMockContext(UserRole.ADMIN);
            const caller = createCaller(ctx);
            const mockJob = { id: BigInt(50), state: oban_job_state.available };
            mockObanDao.enqueueEspnTeamSync.mockResolvedValue(mockJob as any);

            const result = await caller.sync.enqueue({ jobType: SyncJobType.espn_team_sync });
            expect(result.obanJobId).toBe("50");
            expect(mockObanDao.enqueueEspnTeamSync).toHaveBeenCalled();
        });

        it("should reject commissioner from enqueueing", async () => {
            const ctx = createMockContext(UserRole.COMMISSIONER);
            const caller = createCaller(ctx);

            await expect(
                caller.sync.enqueue({ jobType: SyncJobType.espn_team_sync })
            ).rejects.toThrow(TRPCError);
        });
    });

    describe("sync.enqueueFullEspn", () => {
        it("should enqueue both team and player sync", async () => {
            const ctx = createMockContext(UserRole.ADMIN);
            const caller = createCaller(ctx);

            const teamJob = { id: BigInt(60), state: oban_job_state.available };
            const playerJob = { id: BigInt(61), state: oban_job_state.available };
            mockObanDao.enqueueEspnTeamSync.mockResolvedValue(teamJob as any);
            mockObanDao.enqueueEspnMlbPlayersSync.mockResolvedValue(playerJob as any);

            const result = await caller.sync.enqueueFullEspn();
            expect(result.teamSync.obanJobId).toBe("60");
            expect(result.playerSync.obanJobId).toBe("61");
        });
    });

    // ─── Email ────────────────────────────────────────────────────

    describe("email.sendRegistration", () => {
        it("should enqueue a registration email", async () => {
            const ctx = createMockContext(UserRole.ADMIN);
            const caller = createCaller(ctx);
            const mockJob = { id: BigInt(70), state: oban_job_state.available };
            mockObanDao.enqueueRegistrationEmail.mockResolvedValue(mockJob as any);

            const result = await caller.email.sendRegistration({ userId: "00000000-0000-0000-0000-000000000002" });
            expect(result.obanJobId).toBe("70");
            expect(mockObanDao.enqueueRegistrationEmail).toHaveBeenCalledWith("00000000-0000-0000-0000-000000000002", expect.anything());
        });
    });
});
