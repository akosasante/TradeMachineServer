/* eslint-disable @typescript-eslint/naming-convention */

import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
    UserRole,
    UserStatus,
    TeamStatus,
    PlayerLeagueLevel,
    PickLeagueLevel,
    SyncJobType,
    oban_job_state,
} from "@prisma/client";
import { router, protectedProcedure, withTracing, Context } from "../utils/trpcHelpers";
import { extractTraceContext } from "../../../../utils/tracing";
import Users from "../../../../DAO/v2/UserDAO";
import Teams from "../../../../DAO/v2/TeamDAO";
import Players from "../../../../DAO/v2/PlayerDAO";
import DraftPicks from "../../../../DAO/v2/DraftPickDAO";
import ObanDAO from "../../../../DAO/v2/ObanDAO";
import SyncJobExecutionDAO from "../../../../DAO/v2/SyncJobExecutionDAO";

// ─── RBAC helpers ───────────────────────────────────────────────────────────

function assertAdmin(ctx: Context & { user: { role: UserRole } }) {
    if (ctx.user.role !== UserRole.ADMIN) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Admin only" });
    }
}

function assertAdminOrCommissioner(ctx: Context & { user: { role: UserRole } }) {
    if (ctx.user.role !== UserRole.ADMIN && ctx.user.role !== UserRole.COMMISSIONER) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Admin or commissioner required" });
    }
}

const adminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
    assertAdminOrCommissioner(ctx as Context & { user: { role: UserRole } });
    return next({ ctx });
});

const adminOnlyProcedure = protectedProcedure.use(async ({ ctx, next }) => {
    assertAdmin(ctx as Context & { user: { role: UserRole } });
    return next({ ctx });
});

// ─── Zod schemas ────────────────────────────────────────────────────────────

const syncJobTypeSchema = z.nativeEnum(SyncJobType);

// ─── Users ──────────────────────────────────────────────────────────────────

const usersRouter = router({
    list: adminProcedure.query(
        withTracing("trpc.admin.users.list", async (_input: undefined, ctx: Context) => {
            return new Users(ctx.prisma.user).getAllUsersWithTeams();
        })
    ),
    getById: adminProcedure.input(z.object({ id: z.string().uuid() })).query(
        withTracing("trpc.admin.users.getById", async (input: { id: string }, ctx: Context) => {
            return new Users(ctx.prisma.user).getUserById(input.id);
        })
    ),
    create: adminProcedure
        .input(
            z.object({
                email: z.string().email(),
                displayName: z.string().optional(),
                role: z.nativeEnum(UserRole).optional(),
                status: z.nativeEnum(UserStatus).optional(),
                csvName: z.string().optional(),
                teamId: z.string().uuid().optional(),
            })
        )
        .mutation(
            withTracing(
                "trpc.admin.users.create",
                async (
                    input: {
                        email: string;
                        displayName?: string;
                        role?: UserRole;
                        status?: UserStatus;
                        csvName?: string;
                        teamId?: string;
                    },
                    ctx: Context
                ) => {
                    const userDao = new Users(ctx.prisma.user);
                    const users = await userDao.createUsers([
                        {
                            email: input.email,
                            displayName: input.displayName,
                            role: input.role ?? UserRole.OWNER,
                            status: input.status ?? UserStatus.ACTIVE,
                            csvName: input.csvName,
                            teamId: input.teamId,
                        },
                    ]);
                    if (!users.length) {
                        throw new TRPCError({ code: "CONFLICT", message: "User already exists" });
                    }
                    return users[0];
                }
            )
        ),
    update: adminProcedure
        .input(
            z.object({
                id: z.string().uuid(),
                email: z.string().email().optional(),
                displayName: z.string().optional(),
                role: z.nativeEnum(UserRole).optional(),
                status: z.nativeEnum(UserStatus).optional(),
                csvName: z.string().optional(),
                teamId: z.string().uuid().nullable().optional(),
            })
        )
        .mutation(
            withTracing(
                "trpc.admin.users.update",
                async (
                    input: {
                        id: string;
                        email?: string;
                        displayName?: string;
                        role?: UserRole;
                        status?: UserStatus;
                        csvName?: string;
                        teamId?: string | null;
                    },
                    ctx: Context
                ) => {
                    const { id, ...data } = input;
                    return new Users(ctx.prisma.user).updateUser(id, data);
                }
            )
        ),
    delete: adminOnlyProcedure.input(z.object({ id: z.string().uuid() })).mutation(
        withTracing("trpc.admin.users.delete", async (input: { id: string }, ctx: Context) => {
            return new Users(ctx.prisma.user).deleteUser(input.id);
        })
    ),
});

// ─── Teams ──────────────────────────────────────────────────────────────────

const teamsRouter = router({
    list: adminProcedure.query(
        withTracing("trpc.admin.teams.list", async (_input: undefined, ctx: Context) => {
            return new Teams(ctx.prisma.team).getAllTeams();
        })
    ),
    getById: adminProcedure.input(z.object({ id: z.string().uuid() })).query(
        withTracing("trpc.admin.teams.getById", async (input: { id: string }, ctx: Context) => {
            return new Teams(ctx.prisma.team).getTeamById(input.id);
        })
    ),
    create: adminProcedure
        .input(
            z.object({
                name: z.string().min(1),
                espnId: z.number().int().nullable().optional(),
                status: z.nativeEnum(TeamStatus).optional(),
            })
        )
        .mutation(
            withTracing(
                "trpc.admin.teams.create",
                async (input: { name: string; espnId?: number | null; status?: TeamStatus }, ctx: Context) => {
                    return new Teams(ctx.prisma.team).createTeam(input);
                }
            )
        ),
    update: adminProcedure
        .input(
            z.object({
                id: z.string().uuid(),
                name: z.string().min(1).optional(),
                espnId: z.number().int().nullable().optional(),
                status: z.nativeEnum(TeamStatus).optional(),
            })
        )
        .mutation(
            withTracing(
                "trpc.admin.teams.update",
                async (
                    input: { id: string; name?: string; espnId?: number | null; status?: TeamStatus },
                    ctx: Context
                ) => {
                    const { id, ...data } = input;
                    return new Teams(ctx.prisma.team).updateTeam(id, data);
                }
            )
        ),
    delete: adminOnlyProcedure.input(z.object({ id: z.string().uuid() })).mutation(
        withTracing("trpc.admin.teams.delete", async (input: { id: string }, ctx: Context) => {
            return new Teams(ctx.prisma.team).deleteTeam(input.id);
        })
    ),
});

// ─── Players ────────────────────────────────────────────────────────────────

const playersRouter = router({
    search: adminProcedure
        .input(
            z.object({
                search: z.string().optional(),
                league: z.nativeEnum(PlayerLeagueLevel).optional(),
                skip: z.number().int().min(0).optional(),
                take: z.number().int().min(1).max(200).optional(),
            })
        )
        .query(
            withTracing(
                "trpc.admin.players.search",
                async (
                    input: {
                        search?: string;
                        league?: PlayerLeagueLevel;
                        skip?: number;
                        take?: number;
                    },
                    ctx: Context
                ) => {
                    return new Players(ctx.prisma.player).searchPlayers(input);
                }
            )
        ),
    getById: adminProcedure.input(z.object({ id: z.string().uuid() })).query(
        withTracing("trpc.admin.players.getById", async (input: { id: string }, ctx: Context) => {
            return new Players(ctx.prisma.player).getPlayerById(input.id);
        })
    ),
    create: adminOnlyProcedure
        .input(
            z.object({
                name: z.string().min(1),
                league: z.nativeEnum(PlayerLeagueLevel).nullable().optional(),
                mlbTeam: z.string().nullable().optional(),
                playerDataId: z.number().int().nullable().optional(),
                leagueTeamId: z.string().uuid().nullable().optional(),
            })
        )
        .mutation(
            withTracing(
                "trpc.admin.players.create",
                async (
                    input: {
                        name: string;
                        league?: PlayerLeagueLevel | null;
                        mlbTeam?: string | null;
                        playerDataId?: number | null;
                        leagueTeamId?: string | null;
                    },
                    ctx: Context
                ) => {
                    return new Players(ctx.prisma.player).createPlayer(input);
                }
            )
        ),
    update: adminOnlyProcedure
        .input(
            z.object({
                id: z.string().uuid(),
                name: z.string().min(1).optional(),
                league: z.nativeEnum(PlayerLeagueLevel).nullable().optional(),
                mlbTeam: z.string().nullable().optional(),
                playerDataId: z.number().int().nullable().optional(),
                leagueTeamId: z.string().uuid().nullable().optional(),
            })
        )
        .mutation(
            withTracing(
                "trpc.admin.players.update",
                async (
                    input: {
                        id: string;
                        name?: string;
                        league?: PlayerLeagueLevel | null;
                        mlbTeam?: string | null;
                        playerDataId?: number | null;
                        leagueTeamId?: string | null;
                    },
                    ctx: Context
                ) => {
                    const { id, ...data } = input;
                    return new Players(ctx.prisma.player).updatePlayer(id, data);
                }
            )
        ),
    delete: adminOnlyProcedure.input(z.object({ id: z.string().uuid() })).mutation(
        withTracing("trpc.admin.players.delete", async (input: { id: string }, ctx: Context) => {
            return new Players(ctx.prisma.player).deletePlayer(input.id);
        })
    ),
});

// ─── Draft Picks ────────────────────────────────────────────────────────────

const picksRouter = router({
    list: adminProcedure
        .input(
            z
                .object({
                    season: z.number().int().optional(),
                    type: z.nativeEnum(PickLeagueLevel).optional(),
                })
                .optional()
        )
        .query(
            withTracing(
                "trpc.admin.picks.list",
                async (input: { season?: number; type?: PickLeagueLevel } | undefined, ctx: Context) => {
                    return new DraftPicks(ctx.prisma.draftPick).getAllPicks(input ?? undefined);
                }
            )
        ),
    getById: adminProcedure.input(z.object({ id: z.string().uuid() })).query(
        withTracing("trpc.admin.picks.getById", async (input: { id: string }, ctx: Context) => {
            return new DraftPicks(ctx.prisma.draftPick).getPickById(input.id);
        })
    ),
    create: adminOnlyProcedure
        .input(
            z.object({
                round: z.number(),
                season: z.number().int(),
                type: z.nativeEnum(PickLeagueLevel),
                currentOwnerId: z.string().uuid().optional(),
                originalOwnerId: z.string().uuid().optional(),
                pickNumber: z.number().int().optional(),
            })
        )
        .mutation(
            withTracing(
                "trpc.admin.picks.create",
                async (
                    input: {
                        round: number;
                        season: number;
                        type: PickLeagueLevel;
                        currentOwnerId?: string;
                        originalOwnerId?: string;
                        pickNumber?: number;
                    },
                    ctx: Context
                ) => {
                    return new DraftPicks(ctx.prisma.draftPick).createPick(input);
                }
            )
        ),
    update: adminOnlyProcedure
        .input(
            z.object({
                id: z.string().uuid(),
                round: z.number().optional(),
                season: z.number().int().optional(),
                type: z.nativeEnum(PickLeagueLevel).optional(),
                currentOwnerId: z.string().uuid().nullable().optional(),
                originalOwnerId: z.string().uuid().nullable().optional(),
                pickNumber: z.number().int().nullable().optional(),
            })
        )
        .mutation(
            withTracing(
                "trpc.admin.picks.update",
                async (
                    input: {
                        id: string;
                        round?: number;
                        season?: number;
                        type?: PickLeagueLevel;
                        currentOwnerId?: string | null;
                        originalOwnerId?: string | null;
                        pickNumber?: number | null;
                    },
                    ctx: Context
                ) => {
                    const { id, ...data } = input;
                    return new DraftPicks(ctx.prisma.draftPick).updatePick(id, data);
                }
            )
        ),
    delete: adminOnlyProcedure.input(z.object({ id: z.string().uuid() })).mutation(
        withTracing("trpc.admin.picks.delete", async (input: { id: string }, ctx: Context) => {
            return new DraftPicks(ctx.prisma.draftPick).deletePick(input.id);
        })
    ),
});

// ─── Sync ───────────────────────────────────────────────────────────────────

const syncRouter = router({
    enqueue: adminOnlyProcedure.input(z.object({ jobType: syncJobTypeSchema })).mutation(
        withTracing("trpc.admin.sync.enqueue", async (input: { jobType: SyncJobType }, ctx: Context) => {
            const obanDao = new ObanDAO(ctx.prisma.obanJob);
            const traceCtx = extractTraceContext() ?? undefined;
            let job;
            switch (input.jobType) {
                case SyncJobType.espn_team_sync:
                    job = await obanDao.enqueueEspnTeamSync(traceCtx);
                    break;
                case SyncJobType.mlb_players_sync:
                    job = await obanDao.enqueueEspnMlbPlayersSync(traceCtx);
                    break;
                case SyncJobType.minors_sync:
                    job = await obanDao.enqueueMinorsSync(traceCtx);
                    break;
                case SyncJobType.draft_picks_sync:
                    job = await obanDao.enqueueDraftPicksSync(traceCtx);
                    break;
                default: {
                    const _exhaustive: never = input.jobType;
                    throw new TRPCError({
                        code: "BAD_REQUEST",
                        message: `Unknown job type: ${_exhaustive}`,
                    });
                }
            }
            return { obanJobId: job.id.toString(), state: job.state };
        })
    ),
    enqueueFullEspn: adminOnlyProcedure.mutation(
        withTracing("trpc.admin.sync.enqueueFullEspn", async (_input: undefined, ctx: Context) => {
            const obanDao = new ObanDAO(ctx.prisma.obanJob);
            const traceCtx = extractTraceContext() ?? undefined;
            const teamJob = await obanDao.enqueueEspnTeamSync(traceCtx);
            const playerJob = await obanDao.enqueueEspnMlbPlayersSync(traceCtx);
            return {
                teamSync: { obanJobId: teamJob.id.toString(), state: teamJob.state },
                playerSync: { obanJobId: playerJob.id.toString(), state: playerJob.state },
            };
        })
    ),
    status: adminProcedure.input(z.object({ obanJobId: z.string() })).query(
        withTracing("trpc.admin.sync.status", async (input: { obanJobId: string }, ctx: Context) => {
            const obanDao = new ObanDAO(ctx.prisma.obanJob);
            const syncDao = new SyncJobExecutionDAO(ctx.prisma.syncJobExecution);
            const jobId = BigInt(input.obanJobId);
            const obanJob = await obanDao.getJobById(jobId);
            if (!obanJob) {
                throw new TRPCError({ code: "NOT_FOUND", message: "Oban job not found" });
            }

            const execution = await syncDao.getByObanJobId(jobId);

            const terminalStates: oban_job_state[] = [
                oban_job_state.completed,
                oban_job_state.discarded,
                oban_job_state.cancelled,
            ];
            const isTerminal = terminalStates.includes(obanJob.state);

            return {
                obanJobId: obanJob.id.toString(),
                state: obanJob.state,
                isTerminal,
                completedAt: obanJob.completed_at?.toISOString() ?? null,
                errors: obanJob.errors,
                execution: execution
                    ? {
                          id: execution.id,
                          status: execution.status,
                          startedAt: execution.startedAt.toISOString(),
                          completedAt: execution.completedAt?.toISOString() ?? null,
                          durationMs: execution.durationMs,
                          recordsProcessed: execution.recordsProcessed,
                          recordsUpdated: execution.recordsUpdated,
                          recordsSkipped: execution.recordsSkipped,
                          errorMessage: execution.errorMessage,
                      }
                    : null,
            };
        })
    ),
    latestStatus: adminProcedure.input(z.object({ jobType: z.nativeEnum(SyncJobType) })).query(
        withTracing("trpc.admin.sync.latestStatus", async (input: { jobType: SyncJobType }, ctx: Context) => {
            const execution = await new SyncJobExecutionDAO(ctx.prisma.syncJobExecution).getLatestByJobType(
                input.jobType
            );
            return execution
                ? {
                      id: execution.id,
                      status: execution.status,
                      startedAt: execution.startedAt.toISOString(),
                      completedAt: execution.completedAt?.toISOString() ?? null,
                      durationMs: execution.durationMs,
                      recordsProcessed: execution.recordsProcessed,
                      recordsUpdated: execution.recordsUpdated,
                      errorMessage: execution.errorMessage,
                  }
                : null;
        })
    ),
});

// ─── Email ──────────────────────────────────────────────────────────────────

const emailRouter = router({
    sendRegistration: adminProcedure.input(z.object({ userId: z.string().uuid() })).mutation(
        withTracing("trpc.admin.email.sendRegistration", async (input: { userId: string }, ctx: Context) => {
            const obanDao = new ObanDAO(ctx.prisma.obanJob);
            const traceCtx = extractTraceContext() ?? undefined;
            const job = await obanDao.enqueueRegistrationEmail(input.userId, traceCtx);
            return { obanJobId: job.id.toString() };
        })
    ),
    sendPasswordReset: adminProcedure.input(z.object({ userId: z.string().uuid() })).mutation(
        withTracing("trpc.admin.email.sendPasswordReset", async (input: { userId: string }, ctx: Context) => {
            const userDao = new Users(ctx.prisma.user);
            const obanDao = new ObanDAO(ctx.prisma.obanJob);
            const traceCtx = extractTraceContext() ?? undefined;
            await userDao.setPasswordExpires(input.userId);
            const job = await obanDao.enqueuePasswordResetEmail(input.userId, traceCtx);
            return { obanJobId: job.id.toString() };
        })
    ),
});

// ─── Composite ──────────────────────────────────────────────────────────────

export const adminRouter = router({
    users: usersRouter,
    teams: teamsRouter,
    players: playersRouter,
    picks: picksRouter,
    sync: syncRouter,
    email: emailRouter,
});

/* eslint-enable @typescript-eslint/naming-convention */
