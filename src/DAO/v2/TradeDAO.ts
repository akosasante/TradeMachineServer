import { Prisma, TradeItemType, TradeParticipantType, TradeStatus } from "@prisma/client";
import { ExtendedPrismaClient } from "../../bootstrap/prisma-db";

export interface AcceptedByEntry {
    by: string;
    at: string;
}

export type DateField = "CREATED" | "SUBMITTED" | "ACCEPTED" | "DECLINED";

export interface PickFilter {
    pickType?: string;
    season?: number;
    round?: number;
    originalOwnerId?: string;
}

export interface StaffTradeFilters {
    statuses?: TradeStatus[];
    page: number;
    pageSize: number;
    dateFrom?: string;
    dateTo?: string;
    dateField?: DateField;
    playerIds?: string[];
    pick?: PickFilter;
}

export type TeamTradeOrderBy = "CREATED" | "SUBMITTED";

export interface TeamTradeFilters {
    statuses?: TradeStatus[];
    page: number;
    pageSize: number;
    dateFrom?: string;
    dateTo?: string;
    dateField?: DateField;
    playerIds?: string[];
    pick?: PickFilter;
    /** Sort order. "CREATED" = dateCreated desc (default, backward-compat). "SUBMITTED" = submittedAt desc. */
    orderBy?: TeamTradeOrderBy;
}

/** The Prisma include shape used consistently across all DAO methods */
export const tradeWithRelations = {
    tradeParticipants: {
        include: {
            team: {
                include: {
                    owners: true,
                },
            },
        },
    },
    tradeItems: {
        include: {
            sender: {
                include: {
                    owners: true,
                },
            },
            recipient: {
                include: {
                    owners: true,
                },
            },
        },
    },
} as const;

export type PrismaTrade = Prisma.TradeGetPayload<{ include: typeof tradeWithRelations }>;

/** Status values allowed when recording an acceptance (all or partial). */
export type AcceptStatus = "PENDING" | "ACCEPTED";

export default class TradeDAO {
    private readonly tradeDb: ExtendedPrismaClient["trade"];

    constructor(tradeDb: ExtendedPrismaClient["trade"] | undefined) {
        if (!tradeDb) {
            throw new Error("TradeDAO must be initialized with a PrismaClient model instance!");
        }
        this.tradeDb = tradeDb;
    }

    public async getTradeById(id: string): Promise<PrismaTrade> {
        return this.tradeDb.findUniqueOrThrow({
            where: { id },
            include: tradeWithRelations,
        });
    }

    /**
     * Trades where the given team is a participant, newest first.
     * Supports optional filters: statuses, date range, player/pick involvement, and sort order.
     * Does not hydrate player/pick entities on trade items (list UI only).
     */
    public async getTradesByTeam(
        teamId: string,
        opts: TeamTradeFilters,
        pickDb?: ExtendedPrismaClient["draftPick"]
    ): Promise<{ trades: PrismaTrade[]; total: number }> {
        const { statuses, page, pageSize, dateFrom, dateTo, dateField, playerIds, pick, orderBy } = opts;
        const skip = page * pageSize;

        const baseWhere = buildStaffTradeWhere({ statuses, dateFrom, dateTo, dateField, playerIds });

        const where: Prisma.TradeWhereInput = {
            ...baseWhere,
            tradeParticipants: {
                some: { teamId },
            },
        };

        // If both a player AND clause and a tradeParticipants filter exist, merge the AND arrays
        if (baseWhere.AND) {
            where.AND = baseWhere.AND;
        }

        if (pick && pickDb) {
            const resolvedIds = await resolvePickIds(pickDb, pick);
            if (resolvedIds.length === 0) return { trades: [], total: 0 };
            const andClauses = (where.AND as Prisma.TradeWhereInput[]) ?? [];
            andClauses.push({
                tradeItems: {
                    some: { tradeItemType: TradeItemType.PICK, tradeItemId: { in: resolvedIds } },
                },
            });
            where.AND = andClauses;
        }

        const orderByClause: Prisma.TradeOrderByWithRelationInput =
            orderBy === "SUBMITTED" ? { submittedAt: "desc" } : { dateCreated: "desc" };

        const [trades, total] = await Promise.all([
            this.tradeDb.findMany({
                where,
                include: tradeWithRelations,
                orderBy: orderByClause,
                skip,
                take: pageSize,
            }),
            this.tradeDb.count({ where }),
        ]);

        return { trades, total };
    }

    /**
     * All trades across the league, newest first. Intended for staff (admin/commissioner) views.
     * Supports filtering by status, date range, player involvement, and draft pick involvement.
     * Does not hydrate player/pick entities on trade items (list UI only).
     */
    public async getTradesPaginated(
        opts: StaffTradeFilters,
        pickDb?: ExtendedPrismaClient["draftPick"]
    ): Promise<{ trades: PrismaTrade[]; total: number }> {
        const { statuses, page, pageSize, dateFrom, dateTo, dateField, playerIds, pick } = opts;
        const skip = page * pageSize;

        const where = buildStaffTradeWhere({ statuses, dateFrom, dateTo, dateField, playerIds });

        if (pick && pickDb) {
            const resolvedIds = await resolvePickIds(pickDb, pick);
            if (resolvedIds.length === 0) return { trades: [], total: 0 };
            const andClauses = (where.AND as Prisma.TradeWhereInput[]) ?? [];
            andClauses.push({
                tradeItems: {
                    some: { tradeItemType: TradeItemType.PICK, tradeItemId: { in: resolvedIds } },
                },
            });
            where.AND = andClauses;
        }

        const [trades, total] = await Promise.all([
            this.tradeDb.findMany({
                where,
                include: tradeWithRelations,
                orderBy: { dateCreated: "desc" },
                skip,
                take: pageSize,
            }),
            this.tradeDb.count({ where }),
        ]);

        return { trades, total };
    }

    /**
     * Records acceptance (acceptedBy, acceptedByDetails, acceptedOnDate) and sets status in one update.
     * Use PENDING when not all recipients have accepted; use ACCEPTED when all have accepted.
     */
    public async updateAcceptedBy(
        id: string,
        acceptedBy: string[],
        acceptedByDetails: AcceptedByEntry[],
        status: AcceptStatus
    ): Promise<PrismaTrade> {
        await this.tradeDb.update({
            where: { id },
            data: {
                acceptedBy,
                acceptedByDetails: acceptedByDetails as unknown as Prisma.InputJsonValue,
                acceptedOnDate: new Date(),
                status,
            },
        });
        return this.getTradeById(id);
    }

    /**
     * Records who declined and when, and sets status to REJECTED in one update.
     */
    public async updateDeclinedBy(id: string, declinedById: string, declinedReason?: string): Promise<PrismaTrade> {
        await this.tradeDb.update({
            where: { id },
            data: {
                declinedById,
                declinedAt: new Date(),
                declinedReason: declinedReason ?? null,
                status: TradeStatus.REJECTED,
            },
        });
        return this.getTradeById(id);
    }

    /**
     * Records who submitted and when, and sets status to SUBMITTED in one update.
     */
    public async updateSubmitted(id: string, submittedById: string): Promise<PrismaTrade> {
        await this.tradeDb.update({
            where: { id },
            data: {
                submittedAt: new Date(),
                submittedById,
                status: TradeStatus.SUBMITTED,
            },
        });
        return this.getTradeById(id);
    }

    // ─── Write methods ──────────────────────────────────────────────────────────

    /**
     * Creates a new DRAFT trade with a CREATOR participant and one or more RECIPIENT participants.
     * Returns the fully hydrated trade.
     */
    public async createDraft({
        creatorTeamId,
        participantTeamIds,
    }: {
        creatorTeamId: string;
        participantTeamIds: string[];
    }): Promise<PrismaTrade> {
        const result = await this.tradeDb.create({
            data: {
                status: TradeStatus.DRAFT,
                tradeParticipants: {
                    create: [
                        { participantType: TradeParticipantType.CREATOR, teamId: creatorTeamId },
                        ...participantTeamIds.map(id => ({
                            participantType: TradeParticipantType.RECIPIENT,
                            teamId: id,
                        })),
                    ],
                },
            },
        });
        return this.getTradeById(result.id);
    }

    /**
     * Replaces all RECIPIENT participants on a trade with the given teamIds.
     * The CREATOR participant is left untouched.
     * Returns the fully hydrated trade.
     */
    public async updateDraftParticipants(tradeId: string, participantTeamIds: string[]): Promise<PrismaTrade> {
        await this.tradeDb.update({
            where: { id: tradeId },
            data: {
                tradeParticipants: {
                    deleteMany: { participantType: TradeParticipantType.RECIPIENT },
                    create: participantTeamIds.map(id => ({
                        participantType: TradeParticipantType.RECIPIENT,
                        teamId: id,
                    })),
                },
            },
        });
        return this.getTradeById(tradeId);
    }

    /**
     * Adds a trade item (player or pick) to an existing trade.
     * The @@unique constraint on TradeItem dedupes identical items.
     * Returns the fully hydrated trade.
     */
    public async addTradeItem(
        tradeId: string,
        {
            tradeItemType,
            tradeItemId,
            senderId,
            recipientId,
        }: {
            tradeItemType: TradeItemType;
            tradeItemId: string;
            senderId: string;
            recipientId: string;
        }
    ): Promise<PrismaTrade> {
        await this.tradeDb.update({
            where: { id: tradeId },
            data: {
                tradeItems: {
                    create: { tradeItemType, tradeItemId, senderId, recipientId },
                },
            },
        });
        return this.getTradeById(tradeId);
    }

    /**
     * Updates senderId and/or recipientId on a specific TradeItem (identified by lineId).
     * Uses the provided tradeItemDb delegate to perform the update and resolve the parent tradeId.
     * Returns the fully hydrated parent trade.
     */
    public async updateTradeItem(
        lineId: string,
        updates: { senderId?: string; recipientId?: string },
        tradeItemDb: ExtendedPrismaClient["tradeItem"]
    ): Promise<PrismaTrade> {
        const updated = await tradeItemDb.update({
            where: { id: lineId },
            data: updates,
            select: { tradeId: true },
        });
        if (!updated.tradeId) {
            throw new Error(`updateTradeItem: TradeItem ${lineId} has no associated tradeId`);
        }
        return this.getTradeById(updated.tradeId);
    }

    /**
     * Deletes a specific TradeItem (identified by lineId) from its parent trade.
     * Uses the provided tradeItemDb delegate to find and delete the item.
     * Returns the fully hydrated parent trade.
     */
    public async removeTradeItem(lineId: string, tradeItemDb: ExtendedPrismaClient["tradeItem"]): Promise<PrismaTrade> {
        const item = await tradeItemDb.findUniqueOrThrow({
            where: { id: lineId },
            select: { tradeId: true },
        });
        if (!item.tradeId) {
            throw new Error(`removeTradeItem: TradeItem ${lineId} has no associated tradeId`);
        }
        await tradeItemDb.delete({ where: { id: lineId } });
        return this.getTradeById(item.tradeId);
    }

    /**
     * Deletes a DRAFT trade, guarded by authz checks:
     * - The trade must be in DRAFT status.
     * - requestingUserId must be an owner of the CREATOR team.
     * Throws descriptive errors if either check fails.
     */
    public async deleteDraft(tradeId: string, requestingUserId: string): Promise<void> {
        const trade = await this.getTradeById(tradeId);

        if (trade.status !== TradeStatus.DRAFT) {
            throw new Error(`deleteDraft: trade ${tradeId} is not in DRAFT status (current: ${trade.status})`);
        }

        const creatorParticipant = trade.tradeParticipants.find(
            p => p.participantType === TradeParticipantType.CREATOR
        );
        if (!creatorParticipant?.team) {
            throw new Error(`deleteDraft: trade ${tradeId} has no CREATOR participant with a team`);
        }

        const isOwner = creatorParticipant.team.owners.some(owner => owner.id === requestingUserId);
        if (!isOwner) {
            throw new Error(
                `Unauthorized: user ${requestingUserId} is not an owner of the CREATOR team for trade ${tradeId}`
            );
        }

        await this.tradeDb.delete({ where: { id: tradeId } });
    }

    /**
     * Lists DRAFT trades where any of the given teamIds is a participant.
     * Supports pagination and sort order.
     * Returns matching trades and total count.
     */
    public async listDraftsForUser({
        teamIds,
        skip,
        take,
        sort,
    }: {
        teamIds: string[];
        skip: number;
        take: number;
        sort?: TeamTradeOrderBy;
    }): Promise<{ trades: PrismaTrade[]; total: number }> {
        const where: Prisma.TradeWhereInput = {
            status: TradeStatus.DRAFT,
            tradeParticipants: {
                some: { teamId: { in: teamIds } },
            },
        };

        const orderByClause: Prisma.TradeOrderByWithRelationInput =
            sort === "SUBMITTED" ? { submittedAt: "desc" } : { dateCreated: "desc" };

        const [trades, total] = await Promise.all([
            this.tradeDb.findMany({
                where,
                include: tradeWithRelations,
                orderBy: orderByClause,
                skip,
                take,
            }),
            this.tradeDb.count({ where }),
        ]);

        return { trades, total };
    }

    /**
     * Transitions a trade from DRAFT to REQUESTED status.
     * Throws if the trade is not currently in DRAFT status.
     * Returns the fully hydrated trade. Notification enqueueing is the caller's responsibility.
     */
    public async requestTrade(tradeId: string): Promise<PrismaTrade> {
        const trade = await this.getTradeById(tradeId);

        if (trade.status !== TradeStatus.DRAFT) {
            throw new Error(`requestTrade: trade ${tradeId} is not in DRAFT status (current: ${trade.status})`);
        }

        await this.tradeDb.update({
            where: { id: tradeId },
            data: { status: TradeStatus.REQUESTED },
        });
        return this.getTradeById(tradeId);
    }
}

// ─── Extracted helpers (exported for unit testing) ────────────────────────────

const DATE_FIELD_MAP: Record<DateField, keyof Prisma.TradeWhereInput> = {
    CREATED: "dateCreated",
    SUBMITTED: "submittedAt",
    ACCEPTED: "acceptedOnDate",
    DECLINED: "declinedAt",
};

export function buildStaffTradeWhere(opts: {
    statuses?: TradeStatus[];
    dateFrom?: string;
    dateTo?: string;
    dateField?: DateField;
    playerIds?: string[];
}): Prisma.TradeWhereInput {
    const where: Prisma.TradeWhereInput = {};

    if (opts.statuses && opts.statuses.length > 0) {
        where.status = { in: opts.statuses };
    }

    if (opts.dateFrom || opts.dateTo) {
        const column = DATE_FIELD_MAP[opts.dateField ?? "CREATED"];
        const range: Prisma.DateTimeNullableFilter = {};
        if (opts.dateFrom) range.gte = new Date(opts.dateFrom);
        if (opts.dateTo) range.lte = new Date(opts.dateTo);
        (where as Record<string, unknown>)[column as string] = range;
    }

    if (opts.playerIds && opts.playerIds.length > 0) {
        const andClauses: Prisma.TradeWhereInput[] = (where.AND as Prisma.TradeWhereInput[]) ?? [];
        for (const pid of opts.playerIds) {
            andClauses.push({
                tradeItems: { some: { tradeItemType: TradeItemType.PLAYER, tradeItemId: pid } },
            });
        }
        where.AND = andClauses;
    }

    return where;
}

export async function resolvePickIds(pickDb: ExtendedPrismaClient["draftPick"], pick: PickFilter): Promise<string[]> {
    const where: Prisma.DraftPickWhereInput = {};
    if (pick.pickType) where.type = pick.pickType as Prisma.EnumPickLeagueLevelFilter["equals"];
    if (pick.season !== undefined) where.season = pick.season;
    if (pick.round !== undefined) where.round = new Prisma.Decimal(pick.round);
    if (pick.originalOwnerId) where.originalOwnerId = pick.originalOwnerId;

    const found = await pickDb.findMany({ where, select: { id: true } });
    return found.map(p => p.id);
}
