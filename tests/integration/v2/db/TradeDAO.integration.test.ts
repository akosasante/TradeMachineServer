import { TradeItemType, TradeParticipantType, TradeStatus } from "@prisma/client";
import { clearPrismaDb } from "../../helpers";
import initializeDb, { ExtendedPrismaClient } from "../../../../src/bootstrap/prisma-db";
import TradeDAO from "../../../../src/DAO/v2/TradeDAO";
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

/** Creates a team and a user that owns it. Returns both. */
async function createTeamWithOwner(
    teamName: string,
    ownerEmail: string
): Promise<{ team: { id: string }; user: { id: string } }> {
    const team = await prisma.team.create({ data: { name: teamName, status: "ACTIVE" } });
    const user = await prisma.user.create({
        data: { email: ownerEmail, role: "OWNER", teamId: team.id },
    });
    return { team, user };
}

describe("integration/ TradeDAO write methods", () => {
    it("integration/ createDraft → addTradeItem → requestTrade round-trip", async () => {
        const { team: team1 } = await createTeamWithOwner("Team Alpha", "alpha@test.com");
        const { team: team2 } = await createTeamWithOwner("Team Beta", "beta@test.com");

        // createDraft
        const draft = await tradeDao.createDraft({
            creatorTeamId: team1.id,
            participantTeamIds: [team2.id],
        });

        expect(draft.status).toBe(TradeStatus.DRAFT);
        expect(draft.tradeParticipants).toHaveLength(2);
        const creatorParticipant = draft.tradeParticipants.find(
            p => p.participantType === TradeParticipantType.CREATOR
        );
        const recipientParticipant = draft.tradeParticipants.find(
            p => p.participantType === TradeParticipantType.RECIPIENT
        );
        expect(creatorParticipant?.teamId).toBe(team1.id);
        expect(recipientParticipant?.teamId).toBe(team2.id);

        // addTradeItem
        const itemId = uuid();
        const tradeWithItem = await tradeDao.addTradeItem(draft.id, {
            tradeItemType: TradeItemType.PLAYER,
            tradeItemId: itemId,
            senderId: team1.id,
            recipientId: team2.id,
        });

        expect(tradeWithItem.tradeItems).toHaveLength(1);
        expect(tradeWithItem.tradeItems[0].senderId).toBe(team1.id);
        expect(tradeWithItem.tradeItems[0].recipientId).toBe(team2.id);

        // requestTrade
        const requested = await tradeDao.requestTrade(draft.id);
        expect(requested.status).toBe(TradeStatus.REQUESTED);
    });

    it("integration/ addTradeItem dedup constraint throws on duplicate item", async () => {
        const { team: team1 } = await createTeamWithOwner("Team Gamma", "gamma@test.com");
        const { team: team2 } = await createTeamWithOwner("Team Delta", "delta@test.com");

        const draft = await tradeDao.createDraft({
            creatorTeamId: team1.id,
            participantTeamIds: [team2.id],
        });

        const itemId = uuid();
        await tradeDao.addTradeItem(draft.id, {
            tradeItemType: TradeItemType.PLAYER,
            tradeItemId: itemId,
            senderId: team1.id,
            recipientId: team2.id,
        });

        // Adding the exact same item should throw due to @@unique constraint
        await expect(
            tradeDao.addTradeItem(draft.id, {
                tradeItemType: TradeItemType.PLAYER,
                tradeItemId: itemId,
                senderId: team1.id,
                recipientId: team2.id,
            })
        ).rejects.toThrow();

        // Verify only 1 item persisted
        const trade = await tradeDao.getTradeById(draft.id);
        expect(trade.tradeItems).toHaveLength(1);
    });

    it("integration/ deleteDraft rejects when caller does not own the CREATOR team", async () => {
        const { team: team1 } = await createTeamWithOwner("Team Epsilon", "epsilon@test.com");
        const { team: team2 } = await createTeamWithOwner("Team Zeta", "zeta@test.com");

        // user2 is the owner of team2, NOT team1
        const user2 = await prisma.user.findFirst({ where: { teamId: team2.id } });
        expect(user2).not.toBeNull();

        const draft = await tradeDao.createDraft({
            creatorTeamId: team1.id,
            participantTeamIds: [team2.id],
        });

        await expect(tradeDao.deleteDraft(draft.id, user2!.id)).rejects.toThrow(/Unauthorized/);

        // Trade still exists
        const stillExists = await prisma.trade.findUnique({ where: { id: draft.id } });
        expect(stillExists).not.toBeNull();
    });

    it("integration/ deleteDraft rejects when trade status is not DRAFT", async () => {
        const { team: team1, user: user1 } = await createTeamWithOwner("Team Eta", "eta@test.com");
        const { team: team2 } = await createTeamWithOwner("Team Theta", "theta@test.com");

        const draft = await tradeDao.createDraft({
            creatorTeamId: team1.id,
            participantTeamIds: [team2.id],
        });

        // Transition to REQUESTED
        await tradeDao.requestTrade(draft.id);

        await expect(tradeDao.deleteDraft(draft.id, user1.id)).rejects.toThrow(/not in DRAFT status/);
    });

    it("integration/ deleteDraft happy path removes the trade", async () => {
        const { team: team1, user: user1 } = await createTeamWithOwner("Team Iota", "iota@test.com");
        const { team: team2 } = await createTeamWithOwner("Team Kappa", "kappa@test.com");

        const draft = await tradeDao.createDraft({
            creatorTeamId: team1.id,
            participantTeamIds: [team2.id],
        });

        await tradeDao.deleteDraft(draft.id, user1.id);

        const deleted = await prisma.trade.findUnique({ where: { id: draft.id } });
        expect(deleted).toBeNull();
    });
});
