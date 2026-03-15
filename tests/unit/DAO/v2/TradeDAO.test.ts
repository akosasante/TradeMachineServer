import { PrismaClient, TradeStatus } from "@prisma/client";
import { mockClear, mockDeep } from "jest-mock-extended";
import TradeDAO, { AcceptedByEntry, PrismaTrade } from "../../../../src/DAO/v2/TradeDAO";
import { ExtendedPrismaClient } from "../../../../src/bootstrap/prisma-db";
import logger from "../../../../src/bootstrap/logger";
import { v4 as uuid } from "uuid";

const makeMinimalTrade = (overrides: Partial<PrismaTrade> = {}): PrismaTrade =>
    ({
        id: uuid(),
        dateCreated: new Date(),
        dateModified: new Date(),
        status: TradeStatus.REQUESTED,
        declinedReason: null,
        declinedById: null,
        acceptedBy: null,
        acceptedByDetails: null,
        acceptedOnDate: null,
        submittedAt: null,
        submittedById: null,
        tradeParticipants: [],
        tradeItems: [],
        emails: [],
        ...overrides,
    } as unknown as PrismaTrade);

describe("[PRISMA] TradeDAO", () => {
    const prisma = mockDeep<PrismaClient["trade"]>();
    const dao = new TradeDAO(prisma as unknown as ExtendedPrismaClient["trade"]);
    const tradeId = uuid();
    const testTrade = makeMinimalTrade({ id: tradeId });

    beforeAll(() => {
        logger.debug("~~~~~~PRISMA TRADE DAO TESTS BEGIN~~~~~~");
    });
    afterAll(() => {
        logger.debug("~~~~~~PRISMA TRADE DAO TESTS COMPLETE~~~~~~");
    });
    afterEach(() => {
        mockClear(prisma);
    });

    describe("constructor", () => {
        it("should throw when initialized without a prisma client", () => {
            expect(() => new TradeDAO(undefined)).toThrow(
                "TradeDAO must be initialized with a PrismaClient model instance!"
            );
        });
    });

    describe("getTradeById", () => {
        it("should call findUniqueOrThrow with id and relations", async () => {
            prisma.findUniqueOrThrow.mockResolvedValueOnce(testTrade as any);

            const result = await dao.getTradeById(tradeId);

            expect(prisma.findUniqueOrThrow).toHaveBeenCalledTimes(1);
            expect(prisma.findUniqueOrThrow).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: tradeId },
                    include: expect.objectContaining({
                        tradeParticipants: expect.any(Object),
                        tradeItems: expect.any(Object),
                    }),
                })
            );
            expect(result).toEqual(testTrade);
        });
    });

    describe("updateStatus", () => {
        it("should update status then re-fetch the trade", async () => {
            prisma.update.mockResolvedValueOnce(testTrade as any);
            prisma.findUniqueOrThrow.mockResolvedValueOnce({ ...testTrade, status: TradeStatus.SUBMITTED } as any);

            const result = await dao.updateStatus(tradeId, TradeStatus.SUBMITTED);

            expect(prisma.update).toHaveBeenCalledTimes(1);
            expect(prisma.update).toHaveBeenCalledWith({
                where: { id: tradeId },
                data: { status: TradeStatus.SUBMITTED },
            });
            expect(result.status).toBe(TradeStatus.SUBMITTED);
        });
    });

    describe("updateAcceptedBy", () => {
        it("should write both acceptedBy and acceptedByDetails with a timestamp", async () => {
            const acceptedBy = [uuid()];
            const acceptedByDetails: AcceptedByEntry[] = [{ by: acceptedBy[0], at: new Date().toISOString() }];
            prisma.update.mockResolvedValueOnce(testTrade as any);
            prisma.findUniqueOrThrow.mockResolvedValueOnce(testTrade as any);

            await dao.updateAcceptedBy(tradeId, acceptedBy, acceptedByDetails);

            expect(prisma.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: tradeId },
                    data: expect.objectContaining({
                        acceptedBy,
                        acceptedByDetails,
                        acceptedOnDate: expect.any(Date),
                    }),
                })
            );
        });
    });

    describe("updateDeclinedBy", () => {
        it("should update declinedById and declinedReason", async () => {
            const declinedById = uuid();
            prisma.update.mockResolvedValueOnce(testTrade as any);
            prisma.findUniqueOrThrow.mockResolvedValueOnce(testTrade as any);

            await dao.updateDeclinedBy(tradeId, declinedById, "Not fair");

            expect(prisma.update).toHaveBeenCalledWith({
                where: { id: tradeId },
                data: { declinedById, declinedReason: "Not fair" },
            });
        });

        it("should set declinedReason to null when not provided", async () => {
            const declinedById = uuid();
            prisma.update.mockResolvedValueOnce(testTrade as any);
            prisma.findUniqueOrThrow.mockResolvedValueOnce(testTrade as any);

            await dao.updateDeclinedBy(tradeId, declinedById);

            expect(prisma.update).toHaveBeenCalledWith({
                where: { id: tradeId },
                data: { declinedById, declinedReason: null },
            });
        });
    });

    describe("updateSubmitted", () => {
        it("should set submittedAt and submittedById", async () => {
            const submittedById = uuid();
            prisma.update.mockResolvedValueOnce(testTrade as any);
            prisma.findUniqueOrThrow.mockResolvedValueOnce(testTrade as any);

            await dao.updateSubmitted(tradeId, submittedById);

            expect(prisma.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: tradeId },
                    data: expect.objectContaining({
                        submittedAt: expect.any(Date),
                        submittedById,
                    }),
                })
            );
        });
    });
});
