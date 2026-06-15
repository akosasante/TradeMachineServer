import { Prisma, PickLeagueLevel } from "@prisma/client";
import { ExtendedPrismaClient } from "../../bootstrap/prisma-db";

export const teamOwnerSelect = {
    select: { id: true, name: true, espnId: true, status: true },
} as const;

/** The `include` clause used by every DraftPickDAO read that hydrates owner teams. */
export const draftPickInclude = {
    currentOwner: teamOwnerSelect,
    originalOwner: teamOwnerSelect,
} as const;

export type DraftPickWithTeams = Prisma.Result<
    ExtendedPrismaClient["draftPick"],
    { include: typeof draftPickInclude },
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

    public async getAllPicks(filters?: { season?: number; type?: PickLeagueLevel }): Promise<DraftPickWithTeams[]> {
        const where: Prisma.DraftPickWhereInput = {};
        if (filters?.season !== undefined) where.season = filters.season;
        if (filters?.type !== undefined) where.type = filters.type;

        return (await this.pickDb.findMany({
            where,
            orderBy: [{ season: "desc" }, { round: "asc" }, { pickNumber: "asc" }],
            include: draftPickInclude,
        })) as unknown as DraftPickWithTeams[];
    }

    public async getPickById(id: string): Promise<DraftPickWithTeams> {
        return (await this.pickDb.findUniqueOrThrow({
            where: { id },
            include: draftPickInclude,
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
            include: draftPickInclude,
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
            include: draftPickInclude,
        })) as unknown as DraftPickWithTeams;
    }

    public async deletePick(id: string): Promise<DraftPickWithTeams> {
        return (await this.pickDb.delete({
            where: { id },
            include: draftPickInclude,
        })) as unknown as DraftPickWithTeams;
    }

    public async searchEligiblePicks(opts: {
        year?: number;
        type?: PickLeagueLevel;
        round?: number;
        originalOwnerId?: string;
        currentOwnerId?: string;
        skip?: number;
        take?: number;
    }): Promise<{ picks: DraftPickWithTeams[]; total: number }> {
        const tradeableFrom = process.env.DRAFT_PICKS_TRADEABLE_FROM;
        if (tradeableFrom) {
            const tradeableDate = new Date(tradeableFrom);
            if (new Date() < tradeableDate) {
                return { picks: [], total: 0 };
            }
        }

        const where: Prisma.DraftPickWhereInput = {};
        if (opts.year !== undefined) where.season = opts.year;
        if (opts.type !== undefined) where.type = opts.type;
        if (opts.round !== undefined) where.round = new Prisma.Decimal(opts.round);
        if (opts.originalOwnerId !== undefined) where.originalOwnerId = opts.originalOwnerId;
        if (opts.currentOwnerId !== undefined) where.currentOwnerId = opts.currentOwnerId;

        const [picks, total] = await Promise.all([
            this.pickDb.findMany({
                where,
                orderBy: [{ season: "desc" }, { round: "asc" }],
                skip: opts.skip ?? 0,
                take: opts.take ?? 50,
                include: draftPickInclude,
            }),
            this.pickDb.count({ where }),
        ]);

        return { picks: picks as unknown as DraftPickWithTeams[], total };
    }
}
