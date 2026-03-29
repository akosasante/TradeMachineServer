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
