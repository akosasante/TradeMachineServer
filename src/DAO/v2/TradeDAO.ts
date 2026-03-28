import { Prisma, TradeStatus } from "@prisma/client";
import { ExtendedPrismaClient } from "../../bootstrap/prisma-db";

export interface AcceptedByEntry {
    by: string;
    at: string;
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
