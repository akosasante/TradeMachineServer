/**
 * Integration tests for GET /v2/trades.list (tRPC over HTTP).
 * Uses the same Prisma DATABASE_URL as other integration tests (see tests/.env via jestSetupFile).
 * If Prisma fails on missing columns, sync the test schema: `make prisma-migrate-test` (from TradeMachineServer).
 */
import { Server } from "http";
import request from "supertest";
import { hashSync } from "bcryptjs";
import { TeamStatus, TradeParticipantType, TradeStatus, UserRole, UserStatus } from "@prisma/client";
import logger from "../../../src/bootstrap/logger";
import startServer from "../../../src/bootstrap/app";
import { clearPrismaDb, clearRedisTestData, encodeTrpcHttpGetInput, trpcV2LoggedIn } from "../helpers";
import initializeDb, { ExtendedPrismaClient } from "../../../src/bootstrap/prisma-db";
import { handleExitInTest, registerCleanupCallback } from "../../../src/bootstrap/shutdownHandler";

let app: Server;
let prisma: ExtendedPrismaClient;

async function shutdown() {
    try {
        await handleExitInTest();
    } catch (err) {
        logger.error(`Error while shutting down: ${err}`);
    }
}

beforeAll(async () => {
    logger.debug("~~~~~~TRPC TRADE LIST ROUTES BEFORE ALL~~~~~~");
    app = await startServer();
    prisma = initializeDb(process.env.DB_LOGS === "true");
    registerCleanupCallback(async () => {
        await prisma.$disconnect();
    });
    return app;
});

afterAll(async () => {
    logger.debug("~~~~~~TRPC TRADE LIST ROUTES AFTER ALL~~~~~~");
    const shutdownResult = await shutdown();
    if (app) {
        app.close(() => {
            logger.debug("CLOSED SERVER");
        });
    }
    return shutdownResult;
});

describe("tRPC trades.list", () => {
    const testUser = { email: "listowner@example.com", password: "testpassword123" };

    afterEach(async () => {
        await clearRedisTestData();
        return await clearPrismaDb(prisma);
    });

    it("should return 401 when not authenticated", async () => {
        const input = encodeTrpcHttpGetInput({ page: 0, pageSize: 20 });
        const { body } = await request(app).get(`/v2/trades.list?input=${input}`).expect(401);

        expect(body.error).toMatchObject({
            code: -32001,
            message: expect.stringMatching(/not authenticated|Authentication required/i),
        });
    });

    it("should list trades for the logged-in user's team", async () => {
        const teamA = await prisma.team.create({
            data: { name: "List Team A", status: TeamStatus.ACTIVE },
        });
        const teamB = await prisma.team.create({
            data: { name: "List Team B", status: TeamStatus.ACTIVE },
        });

        const hashedPassword = hashSync(testUser.password, 1);
        await prisma.user.create({
            data: {
                email: testUser.email,
                password: hashedPassword,
                displayName: "List Owner",
                role: UserRole.OWNER,
                status: UserStatus.ACTIVE,
                teamId: teamA.id,
            },
        });

        const trade = await prisma.trade.create({
            data: {
                status: TradeStatus.REQUESTED,
                tradeParticipants: {
                    create: [
                        { participantType: TradeParticipantType.CREATOR, teamId: teamA.id },
                        { participantType: TradeParticipantType.RECIPIENT, teamId: teamB.id },
                    ],
                },
            },
        });

        const listInput = encodeTrpcHttpGetInput({ page: 0, pageSize: 20 });
        const { body } = await trpcV2LoggedIn(app, testUser.email, testUser.password, agent =>
            agent.get(`/v2/trades.list?input=${listInput}`).expect(200)
        );

        expect(body.result.data.total).toBe(1);
        expect(body.result.data.page).toBe(0);
        expect(body.result.data.pageSize).toBe(20);
        expect(body.result.data.trades).toHaveLength(1);
        expect(body.result.data.trades[0].id).toBe(trade.id);
    });
});

describe("tRPC trades.listStaff", () => {
    const password = "testpassword123";
    const hashedPassword = hashSync(password, 1);

    afterEach(async () => {
        await clearRedisTestData();
        return await clearPrismaDb(prisma);
    });

    it("should return 401 when not authenticated", async () => {
        const input = encodeTrpcHttpGetInput({ page: 0, pageSize: 20 });
        const { body } = await request(app).get(`/v2/trades.listStaff?input=${input}`).expect(401);

        expect(body.error).toMatchObject({
            code: -32001,
            message: expect.stringMatching(/not authenticated|Authentication required/i),
        });
    });

    it("should return FORBIDDEN for an OWNER user", async () => {
        const teamA = await prisma.team.create({ data: { name: "Staff Team A", status: TeamStatus.ACTIVE } });

        await prisma.user.create({
            data: {
                email: "staffowner@example.com",
                password: hashedPassword,
                displayName: "Staff Owner",
                role: UserRole.OWNER,
                status: UserStatus.ACTIVE,
                teamId: teamA.id,
            },
        });

        const input = encodeTrpcHttpGetInput({ page: 0, pageSize: 20 });
        const { body } = await trpcV2LoggedIn(app, "staffowner@example.com", password, agent =>
            agent.get(`/v2/trades.listStaff?input=${input}`).expect(200)
        );

        expect(body.error).toMatchObject({
            data: expect.objectContaining({ code: "FORBIDDEN" }),
        });
    });

    it("should return all trades for an ADMIN user (league-wide, not team-scoped)", async () => {
        const teamA = await prisma.team.create({ data: { name: "Staff Team A", status: TeamStatus.ACTIVE } });
        const teamB = await prisma.team.create({ data: { name: "Staff Team B", status: TeamStatus.ACTIVE } });
        const teamC = await prisma.team.create({ data: { name: "Staff Team C", status: TeamStatus.ACTIVE } });

        await prisma.user.create({
            data: {
                email: "staffadmin@example.com",
                password: hashedPassword,
                displayName: "Staff Admin",
                role: UserRole.ADMIN,
                status: UserStatus.ACTIVE,
                teamId: teamA.id,
            },
        });

        const tradeAB = await prisma.trade.create({
            data: {
                status: TradeStatus.REQUESTED,
                tradeParticipants: {
                    create: [
                        { participantType: TradeParticipantType.CREATOR, teamId: teamA.id },
                        { participantType: TradeParticipantType.RECIPIENT, teamId: teamB.id },
                    ],
                },
            },
        });

        const tradeBC = await prisma.trade.create({
            data: {
                status: TradeStatus.SUBMITTED,
                tradeParticipants: {
                    create: [
                        { participantType: TradeParticipantType.CREATOR, teamId: teamB.id },
                        { participantType: TradeParticipantType.RECIPIENT, teamId: teamC.id },
                    ],
                },
            },
        });

        const input = encodeTrpcHttpGetInput({ page: 0, pageSize: 20 });
        const { body } = await trpcV2LoggedIn(app, "staffadmin@example.com", password, agent =>
            agent.get(`/v2/trades.listStaff?input=${input}`).expect(200)
        );

        expect(body.result.data.total).toBe(2);
        expect(body.result.data.trades).toHaveLength(2);
        const tradeIds = body.result.data.trades.map((t: { id: string }) => t.id);
        expect(tradeIds).toContain(tradeAB.id);
        expect(tradeIds).toContain(tradeBC.id);
    });

    it("should return all trades for a COMMISSIONER user", async () => {
        const teamA = await prisma.team.create({ data: { name: "Comm Team A", status: TeamStatus.ACTIVE } });
        const teamB = await prisma.team.create({ data: { name: "Comm Team B", status: TeamStatus.ACTIVE } });

        await prisma.user.create({
            data: {
                email: "commissioner@example.com",
                password: hashedPassword,
                displayName: "Commissioner",
                role: UserRole.COMMISSIONER,
                status: UserStatus.ACTIVE,
                teamId: teamA.id,
            },
        });

        await prisma.trade.create({
            data: {
                status: TradeStatus.ACCEPTED,
                tradeParticipants: {
                    create: [
                        { participantType: TradeParticipantType.CREATOR, teamId: teamA.id },
                        { participantType: TradeParticipantType.RECIPIENT, teamId: teamB.id },
                    ],
                },
            },
        });

        const input = encodeTrpcHttpGetInput({ page: 0, pageSize: 20 });
        const { body } = await trpcV2LoggedIn(app, "commissioner@example.com", password, agent =>
            agent.get(`/v2/trades.listStaff?input=${input}`).expect(200)
        );

        expect(body.result.data.total).toBe(1);
        expect(body.result.data.trades).toHaveLength(1);
    });

    it("should filter by statuses when provided", async () => {
        const teamA = await prisma.team.create({ data: { name: "Filter Team A", status: TeamStatus.ACTIVE } });
        const teamB = await prisma.team.create({ data: { name: "Filter Team B", status: TeamStatus.ACTIVE } });

        await prisma.user.create({
            data: {
                email: "filteradmin@example.com",
                password: hashedPassword,
                displayName: "Filter Admin",
                role: UserRole.ADMIN,
                status: UserStatus.ACTIVE,
                teamId: teamA.id,
            },
        });

        await prisma.trade.create({
            data: {
                status: TradeStatus.REQUESTED,
                tradeParticipants: {
                    create: [
                        { participantType: TradeParticipantType.CREATOR, teamId: teamA.id },
                        { participantType: TradeParticipantType.RECIPIENT, teamId: teamB.id },
                    ],
                },
            },
        });

        await prisma.trade.create({
            data: {
                status: TradeStatus.SUBMITTED,
                tradeParticipants: {
                    create: [
                        { participantType: TradeParticipantType.CREATOR, teamId: teamA.id },
                        { participantType: TradeParticipantType.RECIPIENT, teamId: teamB.id },
                    ],
                },
            },
        });

        const input = encodeTrpcHttpGetInput({
            page: 0,
            pageSize: 20,
            statuses: [TradeStatus.REQUESTED],
        });
        const { body } = await trpcV2LoggedIn(app, "filteradmin@example.com", password, agent =>
            agent.get(`/v2/trades.listStaff?input=${input}`).expect(200)
        );

        expect(body.result.data.total).toBe(1);
        expect(body.result.data.trades).toHaveLength(1);
        expect(body.result.data.trades[0].status).toBe(TradeStatus.REQUESTED);
    });
});
