import { Prisma, PickLeagueLevel } from "@prisma/client";
import { ExtendedPrismaClient } from "../../bootstrap/prisma-db";

const teamOwnerSelect = {
    select: { id: true, name: true, espnId: true, status: true },
} as const;

export type DraftPickWithTeams = Prisma.Result<
    ExtendedPrismaClient["draftPick"],
    { include: { currentOwner: typeof teamOwnerSelect; originalOwner: typeof teamOwnerSelect } },
    "findFirstOrThrow"
>;

export default class DraftPickDAO {
    private readonly pickDb: ExtendedPrismaClient["draftPick"];

    constructor(pickDb: ExtendedPrismaClient["draftPick"] | undefined) {
        if (!pickDb) {
            throw new Error("DraftPickDAO must be initialized with a PrismaClient model instance!");
        }
        this.pickDb = pickDb;
    }

    public async getAllPicks(filters?: {
        season?: number;
        type?: PickLeagueLevel;
    }): Promise<DraftPickWithTeams[]> {
        const where: Prisma.DraftPickWhereInput = {};
        if (filters?.season !== undefined) where.season = filters.season;
        if (filters?.type !== undefined) where.type = filters.type;

        return (await this.pickDb.findMany({
            where,
            orderBy: [{ season: "desc" }, { round: "asc" }, { pickNumber: "asc" }],
            include: { currentOwner: teamOwnerSelect, originalOwner: teamOwnerSelect },
        })) as unknown as DraftPickWithTeams[];
    }

    public async getPickById(id: string): Promise<DraftPickWithTeams> {
        return (await this.pickDb.findUniqueOrThrow({
            where: { id },
            include: { currentOwner: teamOwnerSelect, originalOwner: teamOwnerSelect },
        })) as unknown as DraftPickWithTeams;
    }

    public async createPick(data: {
        round: number;
        season: number;
        type: PickLeagueLevel;
        currentOwnerId?: string;
        originalOwnerId?: string;
        pickNumber?: number;
    }): Promise<DraftPickWithTeams> {
        return (await this.pickDb.create({
            data: {
                round: new Prisma.Decimal(data.round),
                season: data.season,
                type: data.type,
                pickNumber: data.pickNumber ?? null,
                currentOwnerId: data.currentOwnerId ?? null,
                originalOwnerId: data.originalOwnerId ?? null,
            },
            include: { currentOwner: teamOwnerSelect, originalOwner: teamOwnerSelect },
        })) as unknown as DraftPickWithTeams;
    }

    public async updatePick(
        id: string,
        data: {
            round?: number;
            season?: number;
            type?: PickLeagueLevel;
            currentOwnerId?: string | null;
            originalOwnerId?: string | null;
            pickNumber?: number | null;
        }
    ): Promise<DraftPickWithTeams> {
        const updateData: Prisma.DraftPickUpdateInput = {};
        if (data.round !== undefined) updateData.round = new Prisma.Decimal(data.round);
        if (data.season !== undefined) updateData.season = data.season;
        if (data.type !== undefined) updateData.type = data.type;
        if (data.pickNumber !== undefined) updateData.pickNumber = data.pickNumber;
        if (data.currentOwnerId !== undefined) {
            updateData.currentOwner = data.currentOwnerId
                ? { connect: { id: data.currentOwnerId } }
                : { disconnect: true };
        }
        if (data.originalOwnerId !== undefined) {
            updateData.originalOwner = data.originalOwnerId
                ? { connect: { id: data.originalOwnerId } }
                : { disconnect: true };
        }

        return (await this.pickDb.update({
            where: { id },
            data: updateData,
            include: { currentOwner: teamOwnerSelect, originalOwner: teamOwnerSelect },
        })) as unknown as DraftPickWithTeams;
    }

    public async deletePick(id: string): Promise<DraftPickWithTeams> {
        return (await this.pickDb.delete({
            where: { id },
            include: { currentOwner: teamOwnerSelect, originalOwner: teamOwnerSelect },
        })) as unknown as DraftPickWithTeams;
    }
}
