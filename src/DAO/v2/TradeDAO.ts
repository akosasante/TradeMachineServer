import { Prisma, TradeItemType, TradeStatus } from "@prisma/client";
import { ExtendedPrismaClient } from "../../bootstrap/prisma-db";

export interface AcceptedByEntry {
    by: string;
    at: string;
}

export type DateField = "CREATED" | "SUBMITTED" | "ACCEPTED" | "DECLINED";

export interface PickFilter {
    pickType: string;
    season: number;
    round: number;
    originalOwnerId: string;
}

export interface StaffTradeFilters {
    statuses?: TradeStatus[];
    page: number;
    pageSize: number;
    dateFrom?: string;
    dateTo?: string;
    dateField?: DateField;
    playerId?: string;
    pick?: PickFilter;
}

/** The Prisma include shape used consistently across all DAO methods */
const tradeWithRelations = {
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
     * Does not hydrate player/pick entities on trade items (list UI only).
     */
    public async getTradesByTeam(
        teamId: string,
        opts: { statuses?: TradeStatus[]; page: number; pageSize: number }
    ): Promise<{ trades: PrismaTrade[]; total: number }> {
        const { statuses, page, pageSize } = opts;
        const skip = page * pageSize;

        const where: Prisma.TradeWhereInput = {
            tradeParticipants: {
                some: { teamId },
            },
            ...(statuses && statuses.length > 0 ? { status: { in: statuses } } : {}),
        };

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
     * All trades across the league, newest first. Intended for staff (admin/commissioner) views.
     * Supports filtering by status, date range, player involvement, and draft pick involvement.
     * Does not hydrate player/pick entities on trade items (list UI only).
     */
    public async getTradesPaginated(
        opts: StaffTradeFilters,
        pickDb?: ExtendedPrismaClient["draftPick"]
    ): Promise<{ trades: PrismaTrade[]; total: number }> {
        const { statuses, page, pageSize, dateFrom, dateTo, dateField, playerId, pick } = opts;
        const skip = page * pageSize;

        const where = buildStaffTradeWhere({ statuses, dateFrom, dateTo, dateField, playerId });

        if (pick && pickDb) {
            const resolvedPickId = await resolvePickId(pickDb, pick);
            if (!resolvedPickId) return { trades: [], total: 0 };
            where.tradeItems = {
                ...((where.tradeItems as Prisma.TradeItemListRelationFilter) ?? {}),
                some: {
                    ...((where.tradeItems as Prisma.TradeItemListRelationFilter)?.some ?? {}),
                    tradeItemType: TradeItemType.PICK,
                    tradeItemId: resolvedPickId,
                },
            };
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
    playerId?: string;
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

    if (opts.playerId) {
        where.tradeItems = {
            some: { tradeItemType: TradeItemType.PLAYER, tradeItemId: opts.playerId },
        };
    }

    return where;
}

export async function resolvePickId(
    pickDb: ExtendedPrismaClient["draftPick"],
    pick: PickFilter
): Promise<string | null> {
    const found = await pickDb.findFirst({
        where: {
            type: pick.pickType as Prisma.EnumPickLeagueLevelFilter["equals"],
            season: pick.season,
            round: new Prisma.Decimal(pick.round),
            originalOwnerId: pick.originalOwnerId,
        },
        select: { id: true },
    });
    return found?.id ?? null;
}
