/**
 * Integration tests for admin tRPC routes (admin.users, admin.teams, admin.players, admin.picks, admin.sync).
 * Boots the real Express server with Prisma + Redis and authenticates via tRPC v2 login.
 */
import { Server } from "http";
import request from "supertest";
import { hashSync } from "bcryptjs";
import {
    TeamStatus,
    UserRole,
    UserStatus,
    PlayerLeagueLevel,
    PickLeagueLevel,
    SyncJobType,
    SyncDatabaseScope,
    oban_job_state,
    Prisma,
} from "@prisma/client";
import logger from "../../../src/bootstrap/logger";
import startServer from "../../../src/bootstrap/app";
import { clearPrismaDb, clearRedisTestData, encodeTrpcHttpGetInput, trpcV2LoggedIn } from "../helpers";
import initializeDb, { ExtendedPrismaClient } from "../../../src/bootstrap/prisma-db";
import { handleExitInTest, registerCleanupCallback } from "../../../src/bootstrap/shutdownHandler";

let app: Server;
let prisma: ExtendedPrismaClient;

const password = "testpassword123";
const hashedPassword = hashSync(password, 1);

async function shutdown() {
    try {
        await handleExitInTest();
    } catch (err) {
        logger.error(`Error while shutting down: ${err}`);
    }
}

beforeAll(async () => {
    logger.debug("~~~~~~ADMIN ROUTES INTEGRATION TESTS BEFORE ALL~~~~~~");
    app = await startServer();
    prisma = initializeDb(process.env.DB_LOGS === "true");
    registerCleanupCallback(async () => {
        await prisma.$disconnect();
    });
    return app;
});

afterAll(async () => {
    logger.debug("~~~~~~ADMIN ROUTES INTEGRATION TESTS AFTER ALL~~~~~~");
    const shutdownResult = await shutdown();
    if (app) {
        app.close(() => {
            logger.debug("CLOSED SERVER");
        });
    }
    return shutdownResult;
});

async function createUser(overrides: {
    email: string;
    role: UserRole;
    displayName?: string;
    teamId?: string;
}) {
    return prisma.user.create({
        data: {
            email: overrides.email,
            password: hashedPassword,
            displayName: overrides.displayName ?? overrides.email.split("@")[0],
            role: overrides.role,
            status: UserStatus.ACTIVE,
            teamId: overrides.teamId ?? null,
        },
    });
}

// ─── Users ───────────────────────────────────────────────────────────────────

describe("admin.users", () => {
    afterEach(async () => {
        await clearRedisTestData();
        return await clearPrismaDb(prisma);
    });

    describe("RBAC", () => {
        it("should return 401 when not authenticated", async () => {
            const input = encodeTrpcHttpGetInput({});
            const { body } = await request(app).get(`/v2/admin.users.list`).expect(401);

            expect(body.error).toMatchObject({
                code: -32001,
                message: expect.stringMatching(/not authenticated|Authentication required/i),
            });
        });

        it("should reject OWNER from listing users", async () => {
            await createUser({ email: "owner@test.com", role: UserRole.OWNER });

            const { body } = await trpcV2LoggedIn(app, "owner@test.com", password, (agent) =>
                agent.get(`/v2/admin.users.list`).expect(403)
            );

            expect(body.error.data.code).toBe("FORBIDDEN");
        });

        it("should allow COMMISSIONER to list users", async () => {
            await createUser({ email: "commish@test.com", role: UserRole.COMMISSIONER });

            const { body } = await trpcV2LoggedIn(app, "commish@test.com", password, (agent) =>
                agent.get(`/v2/admin.users.list`).expect(200)
            );

            expect(Array.isArray(body.result.data)).toBe(true);
        });

        it("should reject COMMISSIONER from deleting a user", async () => {
            const commish = await createUser({ email: "commish@test.com", role: UserRole.COMMISSIONER });
            const target = await createUser({ email: "target@test.com", role: UserRole.OWNER });

            const { body } = await trpcV2LoggedIn(app, "commish@test.com", password, (agent) =>
                agent
                    .post(`/v2/admin.users.delete`)
                    .send({ id: target.id })
                    .expect(403)
            );

            expect(body.error.data.code).toBe("FORBIDDEN");
        });
    });

    describe("CRUD", () => {
        it("should list all users with team info", async () => {
            const team = await prisma.team.create({
                data: { name: "Admin Test Team", status: TeamStatus.ACTIVE },
            });
            await createUser({ email: "admin@test.com", role: UserRole.ADMIN, teamId: team.id });
            await createUser({ email: "user2@test.com", role: UserRole.OWNER, teamId: team.id });

            const { body } = await trpcV2LoggedIn(app, "admin@test.com", password, (agent) =>
                agent.get(`/v2/admin.users.list`).expect(200)
            );

            expect(body.result.data).toHaveLength(2);
            const admin = body.result.data.find((u: any) => u.email === "admin@test.com");
            expect(admin.team).toMatchObject({ id: team.id, name: "Admin Test Team" });
            expect(admin).not.toHaveProperty("password");
        });

        it("should create a new user", async () => {
            await createUser({ email: "admin@test.com", role: UserRole.ADMIN });

            const { body } = await trpcV2LoggedIn(app, "admin@test.com", password, (agent) =>
                agent
                    .post(`/v2/admin.users.create`)
                    .send({ email: "newuser@test.com", displayName: "New User" })
                    .expect(200)
            );

            expect(body.result.data).toMatchObject({
                email: "newuser@test.com",
                displayName: "New User",
                role: UserRole.OWNER,
                status: UserStatus.ACTIVE,
            });
        });

        it("should update a user", async () => {
            await createUser({ email: "admin@test.com", role: UserRole.ADMIN });
            const target = await createUser({ email: "target@test.com", role: UserRole.OWNER });

            const { body } = await trpcV2LoggedIn(app, "admin@test.com", password, (agent) =>
                agent
                    .post(`/v2/admin.users.update`)
                    .send({ id: target.id, displayName: "Updated Name", role: UserRole.COMMISSIONER })
                    .expect(200)
            );

            expect(body.result.data.displayName).toBe("Updated Name");
            expect(body.result.data.role).toBe(UserRole.COMMISSIONER);
        });

        it("should delete a user (admin only)", async () => {
            await createUser({ email: "admin@test.com", role: UserRole.ADMIN });
            const target = await createUser({ email: "delete-me@test.com", role: UserRole.OWNER });

            const { body } = await trpcV2LoggedIn(app, "admin@test.com", password, (agent) =>
                agent
                    .post(`/v2/admin.users.delete`)
                    .send({ id: target.id })
                    .expect(200)
            );

            expect(body.result.data.id).toBe(target.id);

            const remaining = await prisma.user.findMany({ where: { email: "delete-me@test.com" } });
            expect(remaining).toHaveLength(0);
        });
    });
});

// ─── Teams ───────────────────────────────────────────────────────────────────

describe("admin.teams", () => {
    afterEach(async () => {
        await clearRedisTestData();
        return await clearPrismaDb(prisma);
    });

    describe("RBAC", () => {
        it("should reject OWNER from listing teams", async () => {
            await createUser({ email: "owner@test.com", role: UserRole.OWNER });

            const { body } = await trpcV2LoggedIn(app, "owner@test.com", password, (agent) =>
                agent.get(`/v2/admin.teams.list`).expect(403)
            );

            expect(body.error.data.code).toBe("FORBIDDEN");
        });

        it("should reject COMMISSIONER from deleting a team", async () => {
            await createUser({ email: "commish@test.com", role: UserRole.COMMISSIONER });
            const team = await prisma.team.create({ data: { name: "Team X", status: TeamStatus.ACTIVE } });

            const { body } = await trpcV2LoggedIn(app, "commish@test.com", password, (agent) =>
                agent.post(`/v2/admin.teams.delete`).send({ id: team.id }).expect(403)
            );

            expect(body.error.data.code).toBe("FORBIDDEN");
        });
    });

    describe("CRUD", () => {
        it("should list all teams with owners", async () => {
            const team = await prisma.team.create({ data: { name: "List Team", status: TeamStatus.ACTIVE } });
            await createUser({ email: "admin@test.com", role: UserRole.ADMIN, teamId: team.id });

            const { body } = await trpcV2LoggedIn(app, "admin@test.com", password, (agent) =>
                agent.get(`/v2/admin.teams.list`).expect(200)
            );

            expect(Array.isArray(body.result.data)).toBe(true);
            const found = body.result.data.find((t: any) => t.id === team.id);
            expect(found.name).toBe("List Team");
            expect(Array.isArray(found.owners)).toBe(true);
        });

        it("should create a team", async () => {
            await createUser({ email: "admin@test.com", role: UserRole.ADMIN });

            const { body } = await trpcV2LoggedIn(app, "admin@test.com", password, (agent) =>
                agent.post(`/v2/admin.teams.create`).send({ name: "New Team", espnId: 7 }).expect(200)
            );

            expect(body.result.data).toMatchObject({
                name: "New Team",
                espnId: 7,
                status: TeamStatus.ACTIVE,
            });
        });

        it("should update a team", async () => {
            await createUser({ email: "admin@test.com", role: UserRole.ADMIN });
            const team = await prisma.team.create({ data: { name: "Old Name", status: TeamStatus.ACTIVE } });

            const { body } = await trpcV2LoggedIn(app, "admin@test.com", password, (agent) =>
                agent.post(`/v2/admin.teams.update`).send({ id: team.id, name: "New Name" }).expect(200)
            );

            expect(body.result.data.name).toBe("New Name");
        });

        it("should delete a team (admin only)", async () => {
            await createUser({ email: "admin@test.com", role: UserRole.ADMIN });
            const team = await prisma.team.create({ data: { name: "Delete Me", status: TeamStatus.ACTIVE } });

            const { body } = await trpcV2LoggedIn(app, "admin@test.com", password, (agent) =>
                agent.post(`/v2/admin.teams.delete`).send({ id: team.id }).expect(200)
            );

            expect(body.result.data.id).toBe(team.id);
            const remaining = await prisma.team.findMany({ where: { id: team.id } });
            expect(remaining).toHaveLength(0);
        });
    });
});

// ─── Players ─────────────────────────────────────────────────────────────────

describe("admin.players", () => {
    afterEach(async () => {
        await clearRedisTestData();
        return await clearPrismaDb(prisma);
    });

    describe("RBAC", () => {
        it("should allow COMMISSIONER to search players (read-only)", async () => {
            await createUser({ email: "commish@test.com", role: UserRole.COMMISSIONER });

            const input = encodeTrpcHttpGetInput({});
            const { body } = await trpcV2LoggedIn(app, "commish@test.com", password, (agent) =>
                agent.get(`/v2/admin.players.search?input=${input}`).expect(200)
            );

            expect(body.result.data).toHaveProperty("players");
            expect(body.result.data).toHaveProperty("total");
        });

        it("should reject COMMISSIONER from creating a player", async () => {
            await createUser({ email: "commish@test.com", role: UserRole.COMMISSIONER });

            const { body } = await trpcV2LoggedIn(app, "commish@test.com", password, (agent) =>
                agent.post(`/v2/admin.players.create`).send({ name: "Blocked" }).expect(403)
            );

            expect(body.error.data.code).toBe("FORBIDDEN");
        });
    });

    describe("CRUD", () => {
        it("should search players with pagination", async () => {
            await createUser({ email: "admin@test.com", role: UserRole.ADMIN });

            await prisma.player.createMany({
                data: [
                    { name: "Aaron Judge", league: PlayerLeagueLevel.MAJORS, mlbTeam: "NYY" },
                    { name: "Aaron Nola", league: PlayerLeagueLevel.MAJORS, mlbTeam: "PHI" },
                    { name: "Minor Leaguer", league: PlayerLeagueLevel.MINORS, mlbTeam: "LAA" },
                ],
            });

            const input = encodeTrpcHttpGetInput({ search: "Aaron", take: 10 });
            const { body } = await trpcV2LoggedIn(app, "admin@test.com", password, (agent) =>
                agent.get(`/v2/admin.players.search?input=${input}`).expect(200)
            );

            expect(body.result.data.total).toBe(2);
            expect(body.result.data.players).toHaveLength(2);
        });

        it("should filter players by league", async () => {
            await createUser({ email: "admin@test.com", role: UserRole.ADMIN });

            await prisma.player.createMany({
                data: [
                    { name: "Major Player", league: PlayerLeagueLevel.MAJORS },
                    { name: "Minor Player", league: PlayerLeagueLevel.MINORS },
                ],
            });

            const input = encodeTrpcHttpGetInput({ league: PlayerLeagueLevel.MINORS });
            const { body } = await trpcV2LoggedIn(app, "admin@test.com", password, (agent) =>
                agent.get(`/v2/admin.players.search?input=${input}`).expect(200)
            );

            expect(body.result.data.total).toBe(1);
            expect(body.result.data.players[0].name).toBe("Minor Player");
        });

        it("should create a player", async () => {
            await createUser({ email: "admin@test.com", role: UserRole.ADMIN });

            const { body } = await trpcV2LoggedIn(app, "admin@test.com", password, (agent) =>
                agent
                    .post(`/v2/admin.players.create`)
                    .send({ name: "New Player", league: PlayerLeagueLevel.MAJORS, mlbTeam: "BOS" })
                    .expect(200)
            );

            expect(body.result.data).toMatchObject({
                name: "New Player",
                league: PlayerLeagueLevel.MAJORS,
                mlbTeam: "BOS",
            });
        });

        it("should update a player", async () => {
            await createUser({ email: "admin@test.com", role: UserRole.ADMIN });
            const player = await prisma.player.create({
                data: { name: "Old Name", league: PlayerLeagueLevel.MAJORS },
            });

            const { body } = await trpcV2LoggedIn(app, "admin@test.com", password, (agent) =>
                agent.post(`/v2/admin.players.update`).send({ id: player.id, name: "New Name" }).expect(200)
            );

            expect(body.result.data.name).toBe("New Name");
        });

        it("should delete a player (admin only)", async () => {
            await createUser({ email: "admin@test.com", role: UserRole.ADMIN });
            const player = await prisma.player.create({
                data: { name: "Delete Me", league: PlayerLeagueLevel.MINORS },
            });

            await trpcV2LoggedIn(app, "admin@test.com", password, (agent) =>
                agent.post(`/v2/admin.players.delete`).send({ id: player.id }).expect(200)
            );

            const remaining = await prisma.player.findMany({ where: { id: player.id } });
            expect(remaining).toHaveLength(0);
        });
    });
});

// ─── Draft Picks ─────────────────────────────────────────────────────────────

describe("admin.picks", () => {
    afterEach(async () => {
        await clearRedisTestData();
        return await clearPrismaDb(prisma);
    });

    describe("RBAC", () => {
        it("should allow COMMISSIONER to list picks", async () => {
            await createUser({ email: "commish@test.com", role: UserRole.COMMISSIONER });

            const input = encodeTrpcHttpGetInput({});
            const { body } = await trpcV2LoggedIn(app, "commish@test.com", password, (agent) =>
                agent.get(`/v2/admin.picks.list?input=${input}`).expect(200)
            );

            expect(Array.isArray(body.result.data)).toBe(true);
        });

        it("should reject COMMISSIONER from creating picks", async () => {
            await createUser({ email: "commish@test.com", role: UserRole.COMMISSIONER });

            const { body } = await trpcV2LoggedIn(app, "commish@test.com", password, (agent) =>
                agent
                    .post(`/v2/admin.picks.create`)
                    .send({ round: 1, season: 2026, type: PickLeagueLevel.MAJORS })
                    .expect(403)
            );

            expect(body.error.data.code).toBe("FORBIDDEN");
        });
    });

    describe("CRUD", () => {
        it("should list picks with team relations and filter by season", async () => {
            await createUser({ email: "admin@test.com", role: UserRole.ADMIN });
            const team = await prisma.team.create({ data: { name: "Pick Team", status: TeamStatus.ACTIVE } });

            await prisma.draftPick.create({
                data: {
                    round: new Prisma.Decimal(1),
                    season: 2026,
                    type: PickLeagueLevel.MAJORS,
                    currentOwnerId: team.id,
                    originalOwnerId: team.id,
                },
            });
            await prisma.draftPick.create({
                data: {
                    round: new Prisma.Decimal(1),
                    season: 2027,
                    type: PickLeagueLevel.MAJORS,
                },
            });

            const input = encodeTrpcHttpGetInput({ season: 2026 });
            const { body } = await trpcV2LoggedIn(app, "admin@test.com", password, (agent) =>
                agent.get(`/v2/admin.picks.list?input=${input}`).expect(200)
            );

            expect(body.result.data).toHaveLength(1);
            expect(body.result.data[0].season).toBe(2026);
            expect(body.result.data[0].currentOwner).toMatchObject({ id: team.id, name: "Pick Team" });
        });

        it("should create a pick", async () => {
            await createUser({ email: "admin@test.com", role: UserRole.ADMIN });
            const team = await prisma.team.create({ data: { name: "Owner Team", status: TeamStatus.ACTIVE } });

            const { body } = await trpcV2LoggedIn(app, "admin@test.com", password, (agent) =>
                agent
                    .post(`/v2/admin.picks.create`)
                    .send({
                        round: 2,
                        season: 2026,
                        type: PickLeagueLevel.HIGHMINORS,
                        currentOwnerId: team.id,
                        originalOwnerId: team.id,
                    })
                    .expect(200)
            );

            expect(body.result.data).toMatchObject({
                season: 2026,
                type: PickLeagueLevel.HIGHMINORS,
            });
            expect(body.result.data.currentOwner).toMatchObject({ id: team.id });
        });

        it("should update a pick", async () => {
            await createUser({ email: "admin@test.com", role: UserRole.ADMIN });
            const teamA = await prisma.team.create({ data: { name: "Team A", status: TeamStatus.ACTIVE } });
            const teamB = await prisma.team.create({ data: { name: "Team B", status: TeamStatus.ACTIVE } });

            const pick = await prisma.draftPick.create({
                data: {
                    round: new Prisma.Decimal(1),
                    season: 2026,
                    type: PickLeagueLevel.MAJORS,
                    currentOwnerId: teamA.id,
                    originalOwnerId: teamA.id,
                },
            });

            const { body } = await trpcV2LoggedIn(app, "admin@test.com", password, (agent) =>
                agent
                    .post(`/v2/admin.picks.update`)
                    .send({ id: pick.id, currentOwnerId: teamB.id })
                    .expect(200)
            );

            expect(body.result.data.currentOwner).toMatchObject({ id: teamB.id, name: "Team B" });
            expect(body.result.data.originalOwner).toMatchObject({ id: teamA.id, name: "Team A" });
        });

        it("should delete a pick (admin only)", async () => {
            await createUser({ email: "admin@test.com", role: UserRole.ADMIN });
            const pick = await prisma.draftPick.create({
                data: {
                    round: new Prisma.Decimal(1),
                    season: 2026,
                    type: PickLeagueLevel.LOWMINORS,
                },
            });

            await trpcV2LoggedIn(app, "admin@test.com", password, (agent) =>
                agent.post(`/v2/admin.picks.delete`).send({ id: pick.id }).expect(200)
            );

            const remaining = await prisma.draftPick.findMany({ where: { id: pick.id } });
            expect(remaining).toHaveLength(0);
        });
    });
});

// ─── Sync ────────────────────────────────────────────────────────────────────

describe("admin.sync", () => {
    afterEach(async () => {
        await clearRedisTestData();
        return await clearPrismaDb(prisma);
    });

    describe("RBAC", () => {
        it("should reject COMMISSIONER from enqueueing sync jobs", async () => {
            await createUser({ email: "commish@test.com", role: UserRole.COMMISSIONER });

            const { body } = await trpcV2LoggedIn(app, "commish@test.com", password, (agent) =>
                agent.post(`/v2/admin.sync.enqueue`).send({ jobType: SyncJobType.espn_team_sync }).expect(403)
            );

            expect(body.error.data.code).toBe("FORBIDDEN");
        });

        it("should allow COMMISSIONER to query sync status", async () => {
            await createUser({ email: "admin@test.com", role: UserRole.ADMIN });

            const obanJob = await prisma.obanJob.create({
                data: {
                    queue: "espn_sync",
                    worker: "TradeMachine.Jobs.EspnTeamSync",
                    args: {},
                    max_attempts: 3,
                    state: oban_job_state.completed,
                    completed_at: new Date(),
                },
            });

            await createUser({ email: "commish@test.com", role: UserRole.COMMISSIONER });

            const input = encodeTrpcHttpGetInput({ obanJobId: obanJob.id.toString() });
            const { body } = await trpcV2LoggedIn(app, "commish@test.com", password, (agent) =>
                agent.get(`/v2/admin.sync.status?input=${input}`).expect(200)
            );

            expect(body.result.data.state).toBe(oban_job_state.completed);
            expect(body.result.data.isTerminal).toBe(true);
        });
    });

    describe("enqueue", () => {
        it("should enqueue an espn_team_sync job and return job id", async () => {
            await createUser({ email: "admin@test.com", role: UserRole.ADMIN });

            const { body } = await trpcV2LoggedIn(app, "admin@test.com", password, (agent) =>
                agent.post(`/v2/admin.sync.enqueue`).send({ jobType: SyncJobType.espn_team_sync }).expect(200)
            );

            expect(body.result.data.obanJobId).toBeDefined();
            expect(body.result.data.state).toBe(oban_job_state.available);

            const job = await prisma.obanJob.findFirst({
                where: { id: BigInt(body.result.data.obanJobId) },
            });
            expect(job).not.toBeNull();
            expect(job!.worker).toBe("TradeMachine.Jobs.EspnTeamSync");
        });
    });

    describe("enqueueFullEspn", () => {
        it("should enqueue both team and player sync jobs", async () => {
            await createUser({ email: "admin@test.com", role: UserRole.ADMIN });

            const { body } = await trpcV2LoggedIn(app, "admin@test.com", password, (agent) =>
                agent.post(`/v2/admin.sync.enqueueFullEspn`).expect(200)
            );

            expect(body.result.data.teamSync.obanJobId).toBeDefined();
            expect(body.result.data.playerSync.obanJobId).toBeDefined();
        });
    });

    describe("status", () => {
        it("should return NOT_FOUND for a non-existent oban job id", async () => {
            await createUser({ email: "admin@test.com", role: UserRole.ADMIN });

            const input = encodeTrpcHttpGetInput({ obanJobId: "999999" });
            const { body } = await trpcV2LoggedIn(app, "admin@test.com", password, (agent) =>
                agent.get(`/v2/admin.sync.status?input=${input}`).expect(404)
            );

            expect(body.error.data.code).toBe("NOT_FOUND");
        });

        it("should return job state with execution data when available", async () => {
            await createUser({ email: "admin@test.com", role: UserRole.ADMIN });

            const obanJob = await prisma.obanJob.create({
                data: {
                    queue: "espn_sync",
                    worker: "TradeMachine.Jobs.EspnTeamSync",
                    args: {},
                    max_attempts: 3,
                    state: oban_job_state.completed,
                    completed_at: new Date(),
                },
            });

            await prisma.syncJobExecution.create({
                data: {
                    obanJobId: obanJob.id,
                    jobType: SyncJobType.espn_team_sync,
                    databaseScope: SyncDatabaseScope.production,
                    status: "completed",
                    startedAt: new Date(Date.now() - 60_000),
                    completedAt: new Date(),
                    durationMs: 60000,
                    recordsProcessed: 50,
                    recordsUpdated: 5,
                    recordsSkipped: 45,
                },
            });

            const input = encodeTrpcHttpGetInput({ obanJobId: obanJob.id.toString() });
            const { body } = await trpcV2LoggedIn(app, "admin@test.com", password, (agent) =>
                agent.get(`/v2/admin.sync.status?input=${input}`).expect(200)
            );

            expect(body.result.data.obanJobId).toBe(obanJob.id.toString());
            expect(body.result.data.state).toBe(oban_job_state.completed);
            expect(body.result.data.isTerminal).toBe(true);
            expect(body.result.data.execution).toMatchObject({
                status: "completed",
                recordsProcessed: 50,
                recordsUpdated: 5,
            });
        });
    });
});
