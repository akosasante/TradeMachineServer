import { TradeItemType, TradeParticipantType } from "@prisma/client";
import { clearPrismaDb } from "../../helpers";
import initializeDb, { ExtendedPrismaClient } from "../../../../src/bootstrap/prisma-db";
import TradeDAO from "../../../../src/DAO/v2/TradeDAO";
import { buildTradeSummary, validateTrade } from "../../../../src/services/tradeBuilder/tradeValidator";
import { v4 as uuid } from "uuid";

let prisma: ExtendedPrismaClient;
let tradeDao: TradeDAO;

beforeAll(() => {
    prisma = initializeDb(process.env.DB_LOGS === "true");
    tradeDao = new TradeDAO(prisma.trade);
});

afterAll(async () => {
    await prisma.$disconnect();
});

afterEach(async () => {
    await clearPrismaDb(prisma);
});

/** Creates a bare trade with specified participants and items directly via Prisma. */
async function createRawTrade({
    participants,
    items = [],
}: {
    participants: { participantType: TradeParticipantType; teamId: string }[];
    items?: {
        tradeItemType: TradeItemType;
        tradeItemId: string;
        senderId: string;
        recipientId: string;
    }[];
}): Promise<{ id: string }> {
    return prisma.trade.create({
        data: {
            status: "DRAFT",
            tradeParticipants: {
                create: participants.map(p => ({
                    participantType: p.participantType,
                    teamId: p.teamId,
                })),
            },
            tradeItems: {
                create: items.map(item => ({
                    tradeItemType: item.tradeItemType,
                    tradeItemId: item.tradeItemId,
                    senderId: item.senderId,
                    recipientId: item.recipientId,
                })),
            },
        },
    });
}

describe("integration/ buildTradeSummary", () => {
    it("integration/ computes correct send/receive counts per team", async () => {
        const team1 = await prisma.team.create({ data: { name: "Summary Team 1", status: "ACTIVE" } });
        const team2 = await prisma.team.create({ data: { name: "Summary Team 2", status: "ACTIVE" } });

        const trade = await createRawTrade({
            participants: [
                { participantType: TradeParticipantType.CREATOR, teamId: team1.id },
                { participantType: TradeParticipantType.RECIPIENT, teamId: team2.id },
            ],
            items: [
                {
                    tradeItemType: TradeItemType.PLAYER,
                    tradeItemId: uuid(),
                    senderId: team1.id,
                    recipientId: team2.id,
                },
                {
                    tradeItemType: TradeItemType.PLAYER,
                    tradeItemId: uuid(),
                    senderId: team2.id,
                    recipientId: team1.id,
                },
            ],
        });

        const summary = await buildTradeSummary(trade.id, tradeDao);

        const team1Summary = summary.teams.find(t => t.teamId === team1.id);
        const team2Summary = summary.teams.find(t => t.teamId === team2.id);

        expect(team1Summary?.sendsCount).toBe(1);
        expect(team1Summary?.receivesCount).toBe(1);
        expect(team2Summary?.sendsCount).toBe(1);
        expect(team2Summary?.receivesCount).toBe(1);
    });
});

describe("integration/ validateTrade", () => {
    it("integration/ valid trade (1 creator, 1 recipient, 1 item) has no errors", async () => {
        const team1 = await prisma.team.create({ data: { name: "Valid Team 1", status: "ACTIVE" } });
        const team2 = await prisma.team.create({ data: { name: "Valid Team 2", status: "ACTIVE" } });

        const trade = await createRawTrade({
            participants: [
                { participantType: TradeParticipantType.CREATOR, teamId: team1.id },
                { participantType: TradeParticipantType.RECIPIENT, teamId: team2.id },
            ],
            items: [
                {
                    tradeItemType: TradeItemType.PLAYER,
                    tradeItemId: uuid(),
                    senderId: team1.id,
                    recipientId: team2.id,
                },
            ],
        });

        const result = await validateTrade(trade.id, tradeDao);

        expect(result.canSend).toBe(true);
        expect(result.errors).toHaveLength(0);
    });

    it("integration/ trade with no items has NO_TRADE_ITEMS error and canSend=false", async () => {
        const team1 = await prisma.team.create({ data: { name: "No Items Team 1", status: "ACTIVE" } });
        const team2 = await prisma.team.create({ data: { name: "No Items Team 2", status: "ACTIVE" } });

        const trade = await createRawTrade({
            participants: [
                { participantType: TradeParticipantType.CREATOR, teamId: team1.id },
                { participantType: TradeParticipantType.RECIPIENT, teamId: team2.id },
            ],
        });

        const result = await validateTrade(trade.id, tradeDao);

        expect(result.canSend).toBe(false);
        const errorCodes = result.errors.map(e => e.code);
        expect(errorCodes).toContain("NO_TRADE_ITEMS");
    });

    it("integration/ team that receives nothing gets TEAM_RECEIVES_NOTHING warning", async () => {
        const team1 = await prisma.team.create({ data: { name: "Sends Only Team 1", status: "ACTIVE" } });
        const team2 = await prisma.team.create({ data: { name: "Receives Nothing Team 2", status: "ACTIVE" } });

        // Item sends from team1 to team1 — team2 receives nothing
        const trade = await createRawTrade({
            participants: [
                { participantType: TradeParticipantType.CREATOR, teamId: team1.id },
                { participantType: TradeParticipantType.RECIPIENT, teamId: team2.id },
            ],
            items: [
                {
                    tradeItemType: TradeItemType.PLAYER,
                    tradeItemId: uuid(),
                    senderId: team1.id,
                    recipientId: team1.id, // team2 gets nothing
                },
            ],
        });

        const result = await validateTrade(trade.id, tradeDao);

        // Warning, not error — canSend is still true (no structural errors)
        expect(result.canSend).toBe(true);
        const warningCodes = result.warnings.map(w => w.code);
        expect(warningCodes).toContain("TEAM_RECEIVES_NOTHING");
        const team2Warning = result.warnings.find(w => w.teamId === team2.id);
        expect(team2Warning).toBeDefined();
    });
});
