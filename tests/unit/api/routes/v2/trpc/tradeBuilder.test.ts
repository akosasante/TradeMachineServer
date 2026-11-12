import { PickLeagueLevel, PlayerLeagueLevel, UserRole } from "@prisma/client";
import { Request, Response } from "express";
import { Session } from "express-session";
import { mockDeep } from "jest-mock-extended";
import { v4 as uuid } from "uuid";
import { z } from "zod";
import { ExtendedPrismaClient } from "../../../../../../src/bootstrap/prisma-db";
import UserDAO, { PublicUser } from "../../../../../../src/DAO/v2/UserDAO";
import { Context, createCallerFactory } from "../../../../../../src/api/routes/v2/utils/trpcHelpers";
import { tradeBuilderRouter, tradeBuilderSchemas } from "../../../../../../src/api/routes/v2/routers/tradeBuilder";

jest.mock("../../../../../../src/utils/tracing", () => ({
    createSpanFromRequest: jest.fn(() => ({
        span: { setAttributes: jest.fn(), addEvent: jest.fn(), setStatus: jest.fn() },
        context: {},
    })),
    finishSpanWithStatusCode: jest.fn(),
    addSpanAttributes: jest.fn(),
    addSpanEvent: jest.fn(),
}));

const creatorTeamId = uuid();
const recipientTeamId = uuid();
const playerId = uuid();
const pickId = uuid();

const teamResults = {
    teams: [
        {
            id: creatorTeamId,
            name: "Team A",
            owners: [{ id: uuid(), displayName: "Owner A", csvName: "A" }],
        },
    ],
} satisfies z.infer<typeof tradeBuilderSchemas.teamSearchOutputSchema>;

const playerResults = {
    players: [
        {
            id: playerId,
            name: "Player A",
            level: PlayerLeagueLevel.MAJORS,
            mlbTeam: "SEA",
            recordedOwner: { id: creatorTeamId, name: "Team A" },
            ownedByPreferred: true,
        },
    ],
    total: 1,
    skip: 0,
    take: 20,
} satisfies z.infer<typeof tradeBuilderSchemas.playerSearchOutputSchema>;

const pickResults = {
    picks: [
        {
            id: pickId,
            season: 2027,
            type: PickLeagueLevel.MAJORS,
            round: 1,
            pickNumber: null,
            currentOwner: { id: creatorTeamId, name: "Team A" },
            originalOwner: { id: recipientTeamId, name: "Team B" },
            ownedByPreferred: true,
        },
    ],
    total: 1,
    skip: 0,
    take: 20,
} satisfies z.infer<typeof tradeBuilderSchemas.pickSearchOutputSchema>;

describe("trade builder contract", () => {
    it("accepts valid proposal routes and rejects duplicate participants, duplicate assets, and self-transfers", () => {
        const proposal = {
            participants: [creatorTeamId, recipientTeamId],
            items: [
                {
                    type: "PLAYER" as const,
                    assetId: playerId,
                    senderTeamId: creatorTeamId,
                    recipientTeamId,
                },
            ],
        };

        expect(tradeBuilderSchemas.tradeProposalInputSchema.safeParse(proposal).success).toBe(true);
        expect(
            tradeBuilderSchemas.tradeProposalInputSchema.safeParse({
                ...proposal,
                participants: [creatorTeamId, creatorTeamId],
            }).success
        ).toBe(false);
        expect(
            tradeBuilderSchemas.tradeProposalInputSchema.safeParse({
                ...proposal,
                items: [
                    ...proposal.items,
                    { ...proposal.items[0] },
                ],
            }).success
        ).toBe(false);
        expect(
            tradeBuilderSchemas.tradeProposalInputSchema.safeParse({
                ...proposal,
                items: [
                    {
                        ...proposal.items[0],
                        senderTeamId: recipientTeamId,
                    },
                ],
            }).success
        ).toBe(false);
        expect(
            tradeBuilderSchemas.tradeProposalInputSchema.safeParse({
                ...proposal,
                items: [
                    {
                        ...proposal.items[0],
                        senderTeamId: uuid(),
                    },
                ],
            }).success
        ).toBe(false);
    });

    it("rejects malformed asset and participant identifiers", () => {
        const result = tradeBuilderSchemas.tradeProposalInputSchema.safeParse({
            participants: [creatorTeamId, "not-a-uuid"],
            items: [
                {
                    type: "PLAYER",
                    assetId: "not-a-uuid",
                    senderTeamId: creatorTeamId,
                    recipientTeamId,
                },
            ],
        });

        expect(result.success).toBe(false);
    });

    it("applies bounded skip/take defaults and rejects invalid asset-search windows", () => {
        expect(tradeBuilderSchemas.searchPlayersInputSchema.parse({})).toMatchObject({ skip: 0, take: 20 });
        expect(tradeBuilderSchemas.searchPlayersInputSchema.safeParse({ skip: -1 }).success).toBe(false);
        expect(tradeBuilderSchemas.searchPicksInputSchema.safeParse({ take: 51 }).success).toBe(false);
    });

    it("validates representative team, player, pick, and mutation output fixtures", () => {
        expect(tradeBuilderSchemas.teamSearchOutputSchema.parse(teamResults).teams).toHaveLength(1);
        expect(tradeBuilderSchemas.playerSearchOutputSchema.parse(playerResults).players).toHaveLength(1);
        expect(tradeBuilderSchemas.pickSearchOutputSchema.parse(pickResults).picks).toHaveLength(1);

        expect(tradeBuilderSchemas.createAndRequestOutputSchema.parse({ tradeId: uuid() })).toHaveProperty(
            "tradeId"
        );
    });

    it("fails explicitly until createAndRequest is implemented", async () => {
        const userId = uuid();
        const user = {
            id: userId,
            role: UserRole.OWNER,
            isAdmin: () => false,
        } as unknown as PublicUser;
        const userDao = mockDeep<UserDAO>();
        userDao.getUserById.mockResolvedValue(user);
        const context = {
            req: mockDeep<Request>(),
            res: mockDeep<Response>(),
            session: { user: userId } as Session & { user?: string },
            prisma: mockDeep<ExtendedPrismaClient>(),
            userDao,
        } as Context;
        const caller = createCallerFactory(tradeBuilderRouter)(context);

        await expect(
            caller.createAndRequest({
                participants: [creatorTeamId, recipientTeamId],
                items: [
                    {
                        type: "PICK",
                        assetId: pickId,
                        senderTeamId: creatorTeamId,
                        recipientTeamId,
                    },
                ],
            })
        ).rejects.toMatchObject({ code: "NOT_IMPLEMENTED" });
    });
});
