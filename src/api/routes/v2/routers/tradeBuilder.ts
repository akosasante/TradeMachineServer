import { PickLeagueLevel, PlayerLeagueLevel } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router, withTracing } from "../utils/trpcHelpers";

const pageWindowInput = {
    skip: z.number().int().min(0).default(0),
    take: z.number().int().min(1).max(50).default(20),
};

const teamIdentitySchema = z.object({
    id: z.string().uuid(),
    name: z.string(),
});

const teamSearchOutputSchema = z.object({
    teams: z.array(
        teamIdentitySchema.extend({
            owners: z.array(
                z.object({
                    id: z.string().uuid(),
                    displayName: z.string().nullable(),
                    csvName: z.string().nullable(),
                })
            ),
        })
    ),
});

const playerSearchOutputSchema = z.object({
    players: z.array(
        z.object({
            id: z.string().uuid(),
            name: z.string(),
            level: z.nativeEnum(PlayerLeagueLevel).nullable(),
            mlbTeam: z.string().nullable(),
            recordedOwner: teamIdentitySchema.nullable(),
            ownedByPreferred: z.boolean(),
        })
    ),
    total: z.number().int().min(0),
    skip: z.number().int().min(0),
    take: z.number().int().min(1).max(50),
});

const pickSearchOutputSchema = z.object({
    picks: z.array(
        z.object({
            id: z.string().uuid(),
            season: z.number().int(),
            type: z.nativeEnum(PickLeagueLevel),
            round: z.number(),
            pickNumber: z.number().int().nullable(),
            currentOwner: teamIdentitySchema.nullable(),
            originalOwner: teamIdentitySchema.nullable(),
            ownedByPreferred: z.boolean(),
        })
    ),
    total: z.number().int().min(0),
    skip: z.number().int().min(0),
    take: z.number().int().min(1).max(50),
});

const tradeProposalInputSchema = z
    .object({
        participants: z.array(z.string().uuid()).min(2).max(50),
        items: z
            .array(
                z.object({
                    type: z.enum(["PLAYER", "PICK"]),
                    assetId: z.string().uuid(),
                    senderTeamId: z.string().uuid(),
                    recipientTeamId: z.string().uuid(),
                })
            )
            .min(1)
            .max(500),
    })
    .superRefine((proposal, ctx) => {
        if (new Set(proposal.participants).size !== proposal.participants.length) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Participants must be unique",
                path: ["participants"],
            });
        }

        const participantIds = new Set(proposal.participants);
        const assetKeys = new Set<string>();

        proposal.items.forEach((item, index) => {
            if (item.senderTeamId === item.recipientTeamId) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: "An asset cannot be sent to the same team that sends it",
                    path: ["items", index, "recipientTeamId"],
                });
            }

            if (!participantIds.has(item.senderTeamId)) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: "Sender must be a trade participant",
                    path: ["items", index, "senderTeamId"],
                });
            }

            if (!participantIds.has(item.recipientTeamId)) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: "Recipient must be a trade participant",
                    path: ["items", index, "recipientTeamId"],
                });
            }

            const assetKey = `${item.type}:${item.assetId}`;
            if (assetKeys.has(assetKey)) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: "Each asset can only appear once in a trade",
                    path: ["items", index, "assetId"],
                });
            }
            assetKeys.add(assetKey);
        });
    });

const createAndRequestOutputSchema = z.object({
    tradeId: z.string().uuid(),
});

const searchTeamsInputSchema = z.object({
    q: z.string().trim().max(100).optional(),
    excludeTeamIds: z.array(z.string().uuid()).max(50).default([]),
});

const searchPlayersInputSchema = z.object({
    q: z.string().trim().max(100).optional(),
    level: z.nativeEnum(PlayerLeagueLevel).optional(),
    preferredOwnerTeamId: z.string().uuid().optional(),
    ...pageWindowInput,
});

const searchPicksInputSchema = z.object({
    season: z.number().int().min(1900).max(2200).optional(),
    type: z.nativeEnum(PickLeagueLevel).optional(),
    round: z.number().positive().max(100).optional(),
    preferredOwnerTeamId: z.string().uuid().optional(),
    ...pageWindowInput,
});

function notImplemented(procedure: string): never {
    throw new TRPCError({
        code: "NOT_IMPLEMENTED",
        message: `trades.builder.${procedure} is not implemented yet`,
    });
}

export const tradeBuilderRouter = router({
    searchTeams: protectedProcedure
        .input(searchTeamsInputSchema)
        .output(teamSearchOutputSchema)
        .query(withTracing("trpc.trades.builder.searchTeams", async () => notImplemented("searchTeams"))),
    searchPlayers: protectedProcedure
        .input(searchPlayersInputSchema)
        .output(playerSearchOutputSchema)
        .query(withTracing("trpc.trades.builder.searchPlayers", async () => notImplemented("searchPlayers"))),
    searchPicks: protectedProcedure
        .input(searchPicksInputSchema)
        .output(pickSearchOutputSchema)
        .query(withTracing("trpc.trades.builder.searchPicks", async () => notImplemented("searchPicks"))),
    createAndRequest: protectedProcedure
        .input(tradeProposalInputSchema)
        .output(createAndRequestOutputSchema)
        .mutation(withTracing("trpc.trades.builder.createAndRequest", async () => notImplemented("createAndRequest"))),
});

export const tradeBuilderSchemas = {
    searchTeamsInputSchema,
    searchPlayersInputSchema,
    searchPicksInputSchema,
    teamSearchOutputSchema,
    playerSearchOutputSchema,
    pickSearchOutputSchema,
    tradeProposalInputSchema,
    createAndRequestOutputSchema,
};
