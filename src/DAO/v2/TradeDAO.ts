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
            sender: true,
            recipient: true,
        },
    },
} as const;

export type PrismaTrade = Prisma.TradeGetPayload<{ include: typeof tradeWithRelations }>;

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

    public async updateStatus(id: string, status: TradeStatus): Promise<PrismaTrade> {
        await this.tradeDb.update({
            where: { id },
            data: { status },
        });
        return this.getTradeById(id);
    }

    /**
     * Updates both the legacy acceptedBy (string[]) column and the new acceptedByDetails
     * ([{by, at}]) column. Also sets acceptedOnDate to the current timestamp.
     */
    public async updateAcceptedBy(
        id: string,
        acceptedBy: string[],
        acceptedByDetails: AcceptedByEntry[]
    ): Promise<PrismaTrade> {
        await this.tradeDb.update({
            where: { id },
            data: {
                acceptedBy,
                acceptedByDetails: acceptedByDetails as unknown as Prisma.InputJsonValue,
                acceptedOnDate: new Date(),
            },
        });
        return this.getTradeById(id);
    }

    public async updateDeclinedBy(id: string, declinedById: string, declinedReason?: string): Promise<PrismaTrade> {
        await this.tradeDb.update({
            where: { id },
            data: {
                declinedById,
                declinedReason: declinedReason ?? null,
            },
        });
        return this.getTradeById(id);
    }

    /**
     * Records who submitted the trade and when. Call before updateStatus(SUBMITTED).
     */
    public async updateSubmitted(id: string, submittedById: string): Promise<PrismaTrade> {
        await this.tradeDb.update({
            where: { id },
            data: {
                submittedAt: new Date(),
                submittedById,
            },
        });
        return this.getTradeById(id);
    }
}
