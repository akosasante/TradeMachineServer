/**
 * Integration tests for tRPC trades.accept / trades.decline notification gating.
 * Verifies that email and Discord DM Oban jobs are created (or skipped) based
 * on the user's `userSettings.notifications` preferences stored in the DB.
 */
import { Server } from "http";
import { hashSync } from "bcryptjs";
import { TeamStatus, TradeParticipantType, TradeStatus, UserRole, UserStatus } from "@prisma/client";
import logger from "../../../src/bootstrap/logger";
import startServer from "../../../src/bootstrap/app";
import { clearPrismaDb, clearRedisTestData, trpcV2LoggedIn } from "../helpers";
import initializeDb, { ExtendedPrismaClient } from "../../../src/bootstrap/prisma-db";
import { handleExitInTest, registerCleanupCallback } from "../../../src/bootstrap/shutdownHandler";

let app: Server;
let prisma: ExtendedPrismaClient;

const PASSWORD = "testpassword123";
const HASHED_PASSWORD = hashSync(PASSWORD, 1);

async function shutdown() {
    try {
        await handleExitInTest();
    } catch (err) {
        logger.error(`Error while shutting down: ${err}`);
    }
}

beforeAll(async () => {
    logger.debug("~~~~~~TRPC TRADE NOTIFICATION GATING BEFORE ALL~~~~~~");
    app = await startServer();
    prisma = initializeDb(process.env.DB_LOGS === "true");
    registerCleanupCallback(async () => {
        await prisma.$disconnect();
    });
    return app;
});

afterAll(async () => {
    logger.debug("~~~~~~TRPC TRADE NOTIFICATION GATING AFTER ALL~~~~~~");
    const shutdownResult = await shutdown();
    if (app) {
        app.close(() => {
            logger.debug("CLOSED SERVER");
        });
    }
    return shutdownResult;
});

async function createTeamsAndUsers(opts: {
    creatorEmail: string;
    recipientEmail: string;
    creatorSettings?: object;
    recipientSettings?: object;
    creatorDiscordUserId?: string;
    recipientDiscordUserId?: string;
}) {
    const teamA = await prisma.team.create({ data: { name: "Creator Team", status: TeamStatus.ACTIVE } });
    const teamB = await prisma.team.create({ data: { name: "Recipient Team", status: TeamStatus.ACTIVE } });

    const creator = await prisma.user.create({
        data: {
            email: opts.creatorEmail,
            password: HASHED_PASSWORD,
            displayName: "Creator Owner",
            role: UserRole.OWNER,
            status: UserStatus.ACTIVE,
            teamId: teamA.id,
            discordUserId: opts.creatorDiscordUserId ?? null,
            userSettings: opts.creatorSettings ?? {},
        },
    });

    const recipient = await prisma.user.create({
        data: {
            email: opts.recipientEmail,
            password: HASHED_PASSWORD,
            displayName: "Recipient Owner",
            role: UserRole.OWNER,
            status: UserStatus.ACTIVE,
            teamId: teamB.id,
            discordUserId: opts.recipientDiscordUserId ?? null,
            userSettings: opts.recipientSettings ?? {},
        },
    });

    return { teamA, teamB, creator, recipient };
}

async function createTrade(teamAId: string, teamBId: string, status: TradeStatus) {
    return prisma.trade.create({
        data: {
            status,
            tradeParticipants: {
                create: [
                    { participantType: TradeParticipantType.CREATOR, teamId: teamAId },
                    { participantType: TradeParticipantType.RECIPIENT, teamId: teamBId },
                ],
            },
        },
    });
}

function countObanJobs(jobs: any[], filter: { jobType?: string; emailType?: string; tradeId: string }) {
    return jobs.filter(j => {
        const args = j.args as Record<string, unknown>;
        if (filter.jobType && args.job_type !== filter.jobType) return false;
        if (filter.emailType && args.email_type !== filter.emailType) return false;
        return args.trade_id === filter.tradeId;
    }).length;
}

describe("tRPC trades.accept / trades.decline notification gating", () => {
    afterEach(async () => {
        await clearRedisTestData();
        await prisma.obanJob.deleteMany({});
        return await clearPrismaDb(prisma);
    });

    describe("trades.accept (all accepted → enqueue submit notifications)", () => {
        it("should enqueue email but NOT DM when creator has email enabled and no discordUserId", async () => {
            const { teamA, teamB, recipient } = await createTeamsAndUsers({
                creatorEmail: "creator-accept1@example.com",
                recipientEmail: "recipient-accept1@example.com",
                creatorSettings: { notifications: { tradeActionEmail: true, tradeActionDiscordDm: true } },
            });
            const trade = await createTrade(teamA.id, teamB.id, TradeStatus.REQUESTED);

            const { body } = await trpcV2LoggedIn(app, recipient.email, PASSWORD, agent =>
                agent.post("/v2/trades.accept").send({ tradeId: trade.id, skipNotifications: false }).expect(200)
            );
            expect(body.result.data.allAccepted).toBe(true);

            const obanJobs = await prisma.obanJob.findMany({});
            const emailCount = countObanJobs(obanJobs, { emailType: "trade_submit", tradeId: trade.id });
            const dmCount = countObanJobs(obanJobs, { jobType: "trade_submit_dm", tradeId: trade.id });

            expect(emailCount).toBeGreaterThanOrEqual(1);
            expect(dmCount).toBe(0);
        });

        it("should enqueue both email and DM when creator has both enabled and a discordUserId", async () => {
            const { teamA, teamB, recipient } = await createTeamsAndUsers({
                creatorEmail: "creator-accept2@example.com",
                recipientEmail: "recipient-accept2@example.com",
                creatorDiscordUserId: "111222333444555666",
                creatorSettings: { notifications: { tradeActionEmail: true, tradeActionDiscordDm: true } },
            });
            const trade = await createTrade(teamA.id, teamB.id, TradeStatus.REQUESTED);

            const { body } = await trpcV2LoggedIn(app, recipient.email, PASSWORD, agent =>
                agent.post("/v2/trades.accept").send({ tradeId: trade.id, skipNotifications: false }).expect(200)
            );
            expect(body.result.data.allAccepted).toBe(true);

            const obanJobs = await prisma.obanJob.findMany({});
            const emailCount = countObanJobs(obanJobs, { emailType: "trade_submit", tradeId: trade.id });
            const dmCount = countObanJobs(obanJobs, { jobType: "trade_submit_dm", tradeId: trade.id });

            expect(emailCount).toBeGreaterThanOrEqual(1);
            expect(dmCount).toBeGreaterThanOrEqual(1);
        });

        it("should skip email when creator has tradeActionEmail=false", async () => {
            const { teamA, teamB, recipient } = await createTeamsAndUsers({
                creatorEmail: "creator-accept3@example.com",
                recipientEmail: "recipient-accept3@example.com",
                creatorDiscordUserId: "999888777666555444",
                creatorSettings: { notifications: { tradeActionEmail: false, tradeActionDiscordDm: true } },
            });
            const trade = await createTrade(teamA.id, teamB.id, TradeStatus.REQUESTED);

            await trpcV2LoggedIn(app, recipient.email, PASSWORD, agent =>
                agent.post("/v2/trades.accept").send({ tradeId: trade.id, skipNotifications: false }).expect(200)
            );

            const obanJobs = await prisma.obanJob.findMany({});
            const emailCount = countObanJobs(obanJobs, { emailType: "trade_submit", tradeId: trade.id });
            const dmCount = countObanJobs(obanJobs, { jobType: "trade_submit_dm", tradeId: trade.id });

            expect(emailCount).toBe(0);
            expect(dmCount).toBeGreaterThanOrEqual(1);
        });

        it("should enqueue email by default when userSettings is empty (tradeActionEmail defaults to true)", async () => {
            const { teamA, teamB, recipient } = await createTeamsAndUsers({
                creatorEmail: "creator-accept4@example.com",
                recipientEmail: "recipient-accept4@example.com",
            });
            const trade = await createTrade(teamA.id, teamB.id, TradeStatus.REQUESTED);

            await trpcV2LoggedIn(app, recipient.email, PASSWORD, agent =>
                agent.post("/v2/trades.accept").send({ tradeId: trade.id, skipNotifications: false }).expect(200)
            );

            const obanJobs = await prisma.obanJob.findMany({});
            const emailCount = countObanJobs(obanJobs, { emailType: "trade_submit", tradeId: trade.id });
            const dmCount = countObanJobs(obanJobs, { jobType: "trade_submit_dm", tradeId: trade.id });

            expect(emailCount).toBeGreaterThanOrEqual(1);
            expect(dmCount).toBe(0);
        });
    });

    describe("trades.decline (enqueue decline notifications for non-decliner)", () => {
        it("should enqueue email but NOT DM when creator has no discordUserId", async () => {
            const { teamA, teamB, recipient } = await createTeamsAndUsers({
                creatorEmail: "creator-decline1@example.com",
                recipientEmail: "recipient-decline1@example.com",
                creatorSettings: { notifications: { tradeActionEmail: true, tradeActionDiscordDm: true } },
            });
            const trade = await createTrade(teamA.id, teamB.id, TradeStatus.REQUESTED);

            await trpcV2LoggedIn(app, recipient.email, PASSWORD, agent =>
                agent.post("/v2/trades.decline").send({ tradeId: trade.id, skipNotifications: false }).expect(200)
            );

            const obanJobs = await prisma.obanJob.findMany({});
            const emailCount = countObanJobs(obanJobs, { emailType: "trade_declined", tradeId: trade.id });
            const dmCount = countObanJobs(obanJobs, { jobType: "trade_declined_dm", tradeId: trade.id });

            expect(emailCount).toBeGreaterThanOrEqual(1);
            expect(dmCount).toBe(0);
        });

        it("should enqueue both email and DM when creator has both enabled and a discordUserId", async () => {
            const { teamA, teamB, recipient } = await createTeamsAndUsers({
                creatorEmail: "creator-decline2@example.com",
                recipientEmail: "recipient-decline2@example.com",
                creatorDiscordUserId: "222333444555666777",
                creatorSettings: { notifications: { tradeActionEmail: true, tradeActionDiscordDm: true } },
            });
            const trade = await createTrade(teamA.id, teamB.id, TradeStatus.REQUESTED);

            await trpcV2LoggedIn(app, recipient.email, PASSWORD, agent =>
                agent.post("/v2/trades.decline").send({ tradeId: trade.id, skipNotifications: false }).expect(200)
            );

            const obanJobs = await prisma.obanJob.findMany({});
            const emailCount = countObanJobs(obanJobs, { emailType: "trade_declined", tradeId: trade.id });
            const dmCount = countObanJobs(obanJobs, { jobType: "trade_declined_dm", tradeId: trade.id });

            expect(emailCount).toBeGreaterThanOrEqual(1);
            expect(dmCount).toBeGreaterThanOrEqual(1);
        });

        it("should skip email when creator has tradeActionEmail=false", async () => {
            const { teamA, teamB, recipient } = await createTeamsAndUsers({
                creatorEmail: "creator-decline3@example.com",
                recipientEmail: "recipient-decline3@example.com",
                creatorDiscordUserId: "333444555666777888",
                creatorSettings: { notifications: { tradeActionEmail: false, tradeActionDiscordDm: true } },
            });
            const trade = await createTrade(teamA.id, teamB.id, TradeStatus.REQUESTED);

            await trpcV2LoggedIn(app, recipient.email, PASSWORD, agent =>
                agent.post("/v2/trades.decline").send({ tradeId: trade.id, skipNotifications: false }).expect(200)
            );

            const obanJobs = await prisma.obanJob.findMany({});
            const emailCount = countObanJobs(obanJobs, { emailType: "trade_declined", tradeId: trade.id });
            const dmCount = countObanJobs(obanJobs, { jobType: "trade_declined_dm", tradeId: trade.id });

            expect(emailCount).toBe(0);
            expect(dmCount).toBeGreaterThanOrEqual(1);
        });

        it("should not enqueue any notifications for the declining user themselves", async () => {
            const { teamA, teamB, recipient } = await createTeamsAndUsers({
                creatorEmail: "creator-decline4@example.com",
                recipientEmail: "recipient-decline4@example.com",
                recipientDiscordUserId: "444555666777888999",
                recipientSettings: { notifications: { tradeActionEmail: true, tradeActionDiscordDm: true } },
                creatorSettings: { notifications: { tradeActionEmail: true, tradeActionDiscordDm: true } },
                creatorDiscordUserId: "555666777888999000",
            });
            const trade = await createTrade(teamA.id, teamB.id, TradeStatus.REQUESTED);

            await trpcV2LoggedIn(app, recipient.email, PASSWORD, agent =>
                agent.post("/v2/trades.decline").send({ tradeId: trade.id, skipNotifications: false }).expect(200)
            );

            const obanJobs = await prisma.obanJob.findMany({});
            const allRecipientJobs = obanJobs.filter(j => {
                const args = j.args as Record<string, unknown>;
                return args.recipient_user_id === recipient.id && args.trade_id === trade.id;
            });
            expect(allRecipientJobs).toHaveLength(0);
        });

        it("should include notification_settings_url in DM job args when V3_BASE_URL is set", async () => {
            const savedV3Base = process.env.V3_BASE_URL;
            process.env.V3_BASE_URL = "https://v3-test.example.com";

            try {
                const { teamA, teamB, recipient } = await createTeamsAndUsers({
                    creatorEmail: "creator-decline5@example.com",
                    recipientEmail: "recipient-decline5@example.com",
                    creatorDiscordUserId: "666777888999000111",
                    creatorSettings: { notifications: { tradeActionEmail: true, tradeActionDiscordDm: true } },
                });
                const trade = await createTrade(teamA.id, teamB.id, TradeStatus.REQUESTED);

                await trpcV2LoggedIn(app, recipient.email, PASSWORD, agent =>
                    agent.post("/v2/trades.decline").send({ tradeId: trade.id, skipNotifications: false }).expect(200)
                );

                const dmJobs = await prisma.obanJob.findMany({
                    where: { worker: "TradeMachine.Jobs.DiscordWorker", queue: "discord" },
                });
                const match = dmJobs.filter(j => {
                    const args = j.args as Record<string, unknown>;
                    return args.job_type === "trade_declined_dm" && args.trade_id === trade.id;
                });

                expect(match.length).toBeGreaterThanOrEqual(1);
                const dmArgs = match[0].args as Record<string, unknown>;
                expect(dmArgs.notification_settings_url).toBe("https://v3-test.example.com/dashboard");
            } finally {
                if (savedV3Base === undefined) delete process.env.V3_BASE_URL;
                else process.env.V3_BASE_URL = savedV3Base;
            }
        });
    });
});
