import { mockDeep, mockClear } from "jest-mock-extended";
import { TradeParticipantType } from "@prisma/client";
import TradeDAO from "../../../../src/DAO/v2/TradeDAO";
import { buildTradeSummary, validateTrade } from "../../../../src/services/tradeBuilder/tradeValidator";
import { TradeFactory } from "../../../factories/TradeFactory";
import { v4 as uuid } from "uuid";
import type { PrismaTrade } from "../../../../src/DAO/v2/TradeDAO";

// ─── Inline helpers ───────────────────────────────────────────────────────────

// Produces the minimal participant shape that tradeValidator reads:
// participantType, teamId, team.name, team.owners
function makeParticipant(
    teamId: string,
    type: TradeParticipantType,
    ownerIds: string[] = []
): PrismaTrade["tradeParticipants"][number] {
    return {
        id: uuid(),
        tradeId: uuid(),
        participantType: type,
        teamId,
        team: {
            id: teamId,
            name: `Team-${teamId.slice(0, 4)}`,
            owners: ownerIds.map(oid => ({
                id: oid,
                name: "Owner",
                email: `${oid}@example.com`,
                password: "hashed",
                userSettings: null,
                discordUserId: null,
                dateCreated: new Date(),
                dateModified: new Date(),
            })),
            espnId: null,
            slackId: null,
            dateCreated: new Date(),
            dateModified: new Date(),
        },
    } as unknown as PrismaTrade["tradeParticipants"][number];
}

// Produces the minimal trade-item shape that tradeValidator reads: senderId / recipientId
function makeTradeItem(senderId: string, recipientId: string): PrismaTrade["tradeItems"][number] {
    return {
        id: uuid(),
        tradeId: uuid(),
        tradeItemType: "PLAYER" as const,
        tradeItemId: uuid(),
        senderId,
        recipientId,
        sender: null,
        recipient: null,
    } as unknown as PrismaTrade["tradeItems"][number];
}

// ─── Test suite ───────────────────────────────────────────────────────────────

describe("unit/ tradeValidator", () => {
    const mockDao = mockDeep<TradeDAO>();

    afterEach(() => {
        mockClear(mockDao);
    });

    // ── buildTradeSummary ─────────────────────────────────────────────────────

    describe("buildTradeSummary", () => {
        it("happy path — 2 teams, items sent both ways", async () => {
            const creatorTeamId = uuid();
            const recipientTeamId = uuid();

            const trade = TradeFactory.getPrismaTrade({
                tradeParticipants: [
                    makeParticipant(creatorTeamId, TradeParticipantType.CREATOR),
                    makeParticipant(recipientTeamId, TradeParticipantType.RECIPIENT),
                ],
                tradeItems: [
                    makeTradeItem(creatorTeamId, recipientTeamId), // creator sends to recipient
                    makeTradeItem(recipientTeamId, creatorTeamId), // recipient sends to creator
                ],
            });

            mockDao.getTradeById.mockResolvedValueOnce(trade);

            const summary = await buildTradeSummary(trade.id, mockDao);

            expect(summary.teams).toHaveLength(2);

            const creator = summary.teams.find(t => t.teamId === creatorTeamId)!;
            const recipient = summary.teams.find(t => t.teamId === recipientTeamId)!;

            expect(creator.sendsCount).toBe(1);
            expect(creator.receivesCount).toBe(1);
            expect(recipient.sendsCount).toBe(1);
            expect(recipient.receivesCount).toBe(1);
        });

        it("no items — all counts are 0", async () => {
            const creatorTeamId = uuid();
            const recipientTeamId = uuid();

            const trade = TradeFactory.getPrismaTrade({
                tradeParticipants: [
                    makeParticipant(creatorTeamId, TradeParticipantType.CREATOR),
                    makeParticipant(recipientTeamId, TradeParticipantType.RECIPIENT),
                ],
                tradeItems: [],
            });

            mockDao.getTradeById.mockResolvedValueOnce(trade);

            const summary = await buildTradeSummary(trade.id, mockDao);

            for (const team of summary.teams) {
                expect(team.sendsCount).toBe(0);
                expect(team.receivesCount).toBe(0);
            }
        });
    });

    // ── validateTrade ─────────────────────────────────────────────────────────

    describe("validateTrade", () => {
        it("valid trade — canSend: true, no errors, no warnings", async () => {
            const creatorTeamId = uuid();
            const recipientTeamId = uuid();

            const trade = TradeFactory.getPrismaTrade({
                tradeParticipants: [
                    makeParticipant(creatorTeamId, TradeParticipantType.CREATOR),
                    makeParticipant(recipientTeamId, TradeParticipantType.RECIPIENT),
                ],
                tradeItems: [
                    makeTradeItem(creatorTeamId, recipientTeamId), // creator sends to recipient
                    makeTradeItem(recipientTeamId, creatorTeamId), // recipient sends to creator
                ],
            });

            mockDao.getTradeById.mockResolvedValueOnce(trade);

            const result = await validateTrade(trade.id, mockDao);

            expect(result.canSend).toBe(true);
            expect(result.errors).toHaveLength(0);
            expect(result.warnings).toHaveLength(0);
        });

        it("MISSING_CREATOR — no CREATOR participant", async () => {
            const recipientTeamId = uuid();

            const trade = TradeFactory.getPrismaTrade({
                tradeParticipants: [makeParticipant(recipientTeamId, TradeParticipantType.RECIPIENT)],
                tradeItems: [makeTradeItem(recipientTeamId, recipientTeamId)],
            });

            mockDao.getTradeById.mockResolvedValueOnce(trade);

            const result = await validateTrade(trade.id, mockDao);

            expect(result.canSend).toBe(false);
            expect(result.errors.map(e => e.code)).toContain("MISSING_CREATOR");
        });

        it("MULTIPLE_CREATORS — two CREATOR participants", async () => {
            const creatorTeamId1 = uuid();
            const creatorTeamId2 = uuid();
            const recipientTeamId = uuid();

            const trade = TradeFactory.getPrismaTrade({
                tradeParticipants: [
                    makeParticipant(creatorTeamId1, TradeParticipantType.CREATOR),
                    makeParticipant(creatorTeamId2, TradeParticipantType.CREATOR),
                    makeParticipant(recipientTeamId, TradeParticipantType.RECIPIENT),
                ],
                tradeItems: [makeTradeItem(creatorTeamId1, recipientTeamId)],
            });

            mockDao.getTradeById.mockResolvedValueOnce(trade);

            const result = await validateTrade(trade.id, mockDao);

            expect(result.canSend).toBe(false);
            expect(result.errors.map(e => e.code)).toContain("MULTIPLE_CREATORS");
        });

        it("NO_RECIPIENTS — no RECIPIENT participant", async () => {
            const creatorTeamId = uuid();

            const trade = TradeFactory.getPrismaTrade({
                tradeParticipants: [makeParticipant(creatorTeamId, TradeParticipantType.CREATOR)],
                tradeItems: [makeTradeItem(creatorTeamId, creatorTeamId)],
            });

            mockDao.getTradeById.mockResolvedValueOnce(trade);

            const result = await validateTrade(trade.id, mockDao);

            expect(result.errors.map(e => e.code)).toContain("NO_RECIPIENTS");
        });

        it("NO_TRADE_ITEMS — no trade items", async () => {
            const creatorTeamId = uuid();
            const recipientTeamId = uuid();

            const trade = TradeFactory.getPrismaTrade({
                tradeParticipants: [
                    makeParticipant(creatorTeamId, TradeParticipantType.CREATOR),
                    makeParticipant(recipientTeamId, TradeParticipantType.RECIPIENT),
                ],
                tradeItems: [],
            });

            mockDao.getTradeById.mockResolvedValueOnce(trade);

            const result = await validateTrade(trade.id, mockDao);

            expect(result.errors.map(e => e.code)).toContain("NO_TRADE_ITEMS");
        });

        it("TEAM_RECEIVES_NOTHING warning — second recipient gets nothing, canSend stays true", async () => {
            const creatorTeamId = uuid();
            const recipientTeamId1 = uuid();
            const recipientTeamId2 = uuid();

            const trade = TradeFactory.getPrismaTrade({
                tradeParticipants: [
                    makeParticipant(creatorTeamId, TradeParticipantType.CREATOR),
                    makeParticipant(recipientTeamId1, TradeParticipantType.RECIPIENT),
                    makeParticipant(recipientTeamId2, TradeParticipantType.RECIPIENT),
                ],
                tradeItems: [
                    // Only recipientTeamId1 receives something
                    makeTradeItem(creatorTeamId, recipientTeamId1),
                ],
            });

            mockDao.getTradeById.mockResolvedValueOnce(trade);

            const result = await validateTrade(trade.id, mockDao);

            // A warning is advisory — canSend must still be true
            expect(result.canSend).toBe(true);
            expect(result.errors).toHaveLength(0);

            expect(result.warnings.map(w => w.code)).toContain("TEAM_RECEIVES_NOTHING");

            const nothingWarning = result.warnings.find(
                w => w.code === "TEAM_RECEIVES_NOTHING" && w.teamId === recipientTeamId2
            );
            expect(nothingWarning).toBeDefined();
        });

        it("calls getTradeById exactly once per validateTrade call", async () => {
            const creatorTeamId = uuid();
            const recipientTeamId = uuid();

            const trade = TradeFactory.getPrismaTrade({
                tradeParticipants: [
                    makeParticipant(creatorTeamId, TradeParticipantType.CREATOR),
                    makeParticipant(recipientTeamId, TradeParticipantType.RECIPIENT),
                ],
                tradeItems: [makeTradeItem(creatorTeamId, recipientTeamId)],
            });

            mockDao.getTradeById.mockResolvedValueOnce(trade);

            await validateTrade(trade.id, mockDao);

            expect(mockDao.getTradeById).toHaveBeenCalledTimes(1);
        });
    });
});
