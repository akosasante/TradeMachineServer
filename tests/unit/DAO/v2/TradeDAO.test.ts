import { PrismaClient, TradeItemType, TradeStatus } from "@prisma/client";
import { mockClear, mockDeep } from "jest-mock-extended";
import TradeDAO, {
    AcceptedByEntry,
    PrismaTrade,
    buildStaffTradeWhere,
    resolvePickId,
} from "../../../../src/DAO/v2/TradeDAO";
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

    describe("updateAcceptedBy", () => {
        it("should write acceptedBy, acceptedByDetails, acceptedOnDate and status in one update", async () => {
            const acceptedBy = [uuid()];
            const acceptedByDetails: AcceptedByEntry[] = [{ by: acceptedBy[0], at: new Date().toISOString() }];
            prisma.update.mockResolvedValueOnce(testTrade as any);
            prisma.findUniqueOrThrow.mockResolvedValueOnce(testTrade as any);

            await dao.updateAcceptedBy(tradeId, acceptedBy, acceptedByDetails, TradeStatus.ACCEPTED);

            expect(prisma.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: tradeId },
                    data: expect.objectContaining({
                        acceptedBy,
                        acceptedByDetails,
                        acceptedOnDate: expect.any(Date),
                        status: TradeStatus.ACCEPTED,
                    }),
                })
            );
        });

        it("should allow PENDING status when not all recipients have accepted", async () => {
            const acceptedBy = [uuid()];
            const acceptedByDetails: AcceptedByEntry[] = [{ by: acceptedBy[0], at: new Date().toISOString() }];
            prisma.update.mockResolvedValueOnce(testTrade as any);
            prisma.findUniqueOrThrow.mockResolvedValueOnce({ ...testTrade, status: TradeStatus.PENDING } as any);

            const result = await dao.updateAcceptedBy(tradeId, acceptedBy, acceptedByDetails, TradeStatus.PENDING);

            expect(prisma.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({ status: TradeStatus.PENDING }),
                })
            );
            expect(result.status).toBe(TradeStatus.PENDING);
        });
    });

    describe("updateDeclinedBy", () => {
        it("should update declinedById, declinedReason and set status to REJECTED in one update", async () => {
            const declinedById = uuid();
            prisma.update.mockResolvedValueOnce(testTrade as any);
            prisma.findUniqueOrThrow.mockResolvedValueOnce(testTrade as any);

            await dao.updateDeclinedBy(tradeId, declinedById, "Not fair");

            expect(prisma.update).toHaveBeenCalledWith({
                where: { id: tradeId },
                data: {
                    declinedById,
                    declinedAt: expect.any(Date),
                    declinedReason: "Not fair",
                    status: TradeStatus.REJECTED,
                },
            });
        });

        it("should set declinedReason to null when not provided", async () => {
            const declinedById = uuid();
            prisma.update.mockResolvedValueOnce(testTrade as any);
            prisma.findUniqueOrThrow.mockResolvedValueOnce(testTrade as any);

            await dao.updateDeclinedBy(tradeId, declinedById);

            expect(prisma.update).toHaveBeenCalledWith({
                where: { id: tradeId },
                data: {
                    declinedById,
                    declinedAt: expect.any(Date),
                    declinedReason: null,
                    status: TradeStatus.REJECTED,
                },
            });
        });
    });

    describe("getTradesByTeam", () => {
        const teamId = uuid();
        const tradeA = makeMinimalTrade({ id: uuid() });
        const tradeB = makeMinimalTrade({ id: uuid() });

        it("should query by team participant, order newest first, and paginate", async () => {
            prisma.findMany.mockResolvedValueOnce([tradeA, tradeB] as any);
            prisma.count.mockResolvedValueOnce(42);

            const result = await dao.getTradesByTeam(teamId, { page: 1, pageSize: 10 });

            expect(prisma.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: {
                        tradeParticipants: { some: { teamId } },
                    },
                    orderBy: { dateCreated: "desc" },
                    skip: 10,
                    take: 10,
                })
            );
            expect(prisma.count).toHaveBeenCalledWith({
                where: {
                    tradeParticipants: { some: { teamId } },
                },
            });
            expect(result).toEqual({ trades: [tradeA, tradeB], total: 42 });
        });

        it("should filter by statuses when provided", async () => {
            prisma.findMany.mockResolvedValueOnce([tradeA] as any);
            prisma.count.mockResolvedValueOnce(1);

            await dao.getTradesByTeam(teamId, {
                statuses: [TradeStatus.REQUESTED, TradeStatus.PENDING],
                page: 0,
                pageSize: 20,
            });

            expect(prisma.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: {
                        tradeParticipants: { some: { teamId } },
                        status: { in: [TradeStatus.REQUESTED, TradeStatus.PENDING] },
                    },
                })
            );
        });

        it("should omit status filter when statuses is empty", async () => {
            prisma.findMany.mockResolvedValueOnce([] as any);
            prisma.count.mockResolvedValueOnce(0);

            await dao.getTradesByTeam(teamId, { statuses: [], page: 0, pageSize: 20 });

            expect(prisma.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: {
                        tradeParticipants: { some: { teamId } },
                    },
                })
            );
            const call = prisma.findMany.mock.calls[0][0] as { where: Record<string, unknown> };
            expect(call.where).not.toHaveProperty("status");
        });
    });

    describe("getTradesPaginated", () => {
        const tradeA = makeMinimalTrade({ id: uuid() });
        const tradeB = makeMinimalTrade({ id: uuid() });

        it("should query without team constraint, order newest first, and paginate", async () => {
            prisma.findMany.mockResolvedValueOnce([tradeA, tradeB] as any);
            prisma.count.mockResolvedValueOnce(55);

            const result = await dao.getTradesPaginated({ page: 2, pageSize: 10 });

            expect(prisma.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: {},
                    orderBy: { dateCreated: "desc" },
                    skip: 20,
                    take: 10,
                })
            );
            expect(prisma.count).toHaveBeenCalledWith({ where: {} });
            expect(result).toEqual({ trades: [tradeA, tradeB], total: 55 });
        });

        it("should not include tradeParticipants constraint in the where clause", async () => {
            prisma.findMany.mockResolvedValueOnce([] as any);
            prisma.count.mockResolvedValueOnce(0);

            await dao.getTradesPaginated({ page: 0, pageSize: 20 });

            const call = prisma.findMany.mock.calls[0][0] as { where: Record<string, unknown> };
            expect(call.where).not.toHaveProperty("tradeParticipants");
        });

        it("should filter by statuses when provided", async () => {
            prisma.findMany.mockResolvedValueOnce([tradeA] as any);
            prisma.count.mockResolvedValueOnce(1);

            await dao.getTradesPaginated({
                statuses: [TradeStatus.REQUESTED, TradeStatus.PENDING],
                page: 0,
                pageSize: 20,
            });

            expect(prisma.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: {
                        status: { in: [TradeStatus.REQUESTED, TradeStatus.PENDING] },
                    },
                })
            );
        });

        it("should omit status filter when statuses is empty", async () => {
            prisma.findMany.mockResolvedValueOnce([] as any);
            prisma.count.mockResolvedValueOnce(0);

            await dao.getTradesPaginated({ statuses: [], page: 0, pageSize: 20 });

            const call = prisma.findMany.mock.calls[0][0] as { where: Record<string, unknown> };
            expect(call.where).not.toHaveProperty("status");
        });

        it("should include tradeWithRelations in findMany", async () => {
            prisma.findMany.mockResolvedValueOnce([] as any);
            prisma.count.mockResolvedValueOnce(0);

            await dao.getTradesPaginated({ page: 0, pageSize: 5 });

            expect(prisma.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    include: expect.objectContaining({
                        tradeParticipants: expect.any(Object),
                        tradeItems: expect.any(Object),
                    }),
                })
            );
        });
    });

    describe("updateSubmitted", () => {
        it("should set submittedAt, submittedById and status to SUBMITTED in one update", async () => {
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
                        status: TradeStatus.SUBMITTED,
                    }),
                })
            );
        });
    });

    describe("getTradesPaginated (extended filters)", () => {
        const tradeA = makeMinimalTrade({ id: uuid() });

        it("should pass playerId filter as tradeItems.some constraint", async () => {
            const playerId = uuid();
            prisma.findMany.mockResolvedValueOnce([tradeA] as any);
            prisma.count.mockResolvedValueOnce(1);

            await dao.getTradesPaginated({ playerId, page: 0, pageSize: 20 });

            expect(prisma.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        tradeItems: {
                            some: { tradeItemType: TradeItemType.PLAYER, tradeItemId: playerId },
                        },
                    }),
                })
            );
        });

        it("should pass date range filter on dateCreated by default", async () => {
            prisma.findMany.mockResolvedValueOnce([] as any);
            prisma.count.mockResolvedValueOnce(0);

            await dao.getTradesPaginated({
                dateFrom: "2026-01-01T00:00:00.000Z",
                dateTo: "2026-06-01T00:00:00.000Z",
                page: 0,
                pageSize: 20,
            });

            const call = prisma.findMany.mock.calls[0][0] as { where: Record<string, unknown> };
            expect(call.where).toHaveProperty("dateCreated");
            expect(call.where.dateCreated).toEqual({
                gte: new Date("2026-01-01T00:00:00.000Z"),
                lte: new Date("2026-06-01T00:00:00.000Z"),
            });
        });

        it("should filter on submittedAt when dateField is SUBMITTED", async () => {
            prisma.findMany.mockResolvedValueOnce([] as any);
            prisma.count.mockResolvedValueOnce(0);

            await dao.getTradesPaginated({
                dateFrom: "2026-03-01",
                dateField: "SUBMITTED",
                page: 0,
                pageSize: 20,
            });

            const call = prisma.findMany.mock.calls[0][0] as { where: Record<string, unknown> };
            expect(call.where).toHaveProperty("submittedAt");
            expect(call.where).not.toHaveProperty("dateCreated");
        });

        it("should resolve pick and filter when pick + pickDb provided", async () => {
            const pickDb = mockDeep<PrismaClient["draftPick"]>();
            const resolvedPickId = uuid();
            pickDb.findFirst.mockResolvedValueOnce({ id: resolvedPickId } as any);
            prisma.findMany.mockResolvedValueOnce([tradeA] as any);
            prisma.count.mockResolvedValueOnce(1);

            await dao.getTradesPaginated(
                {
                    pick: { pickType: "MAJORS", season: 2026, round: 1, originalOwnerId: uuid() },
                    page: 0,
                    pageSize: 20,
                },
                pickDb as unknown as ExtendedPrismaClient["draftPick"]
            );

            expect(pickDb.findFirst).toHaveBeenCalledTimes(1);
            expect(prisma.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        tradeItems: expect.objectContaining({
                            some: expect.objectContaining({
                                tradeItemType: TradeItemType.PICK,
                                tradeItemId: resolvedPickId,
                            }),
                        }),
                    }),
                })
            );
        });

        it("should return empty when pick cannot be resolved", async () => {
            const pickDb = mockDeep<PrismaClient["draftPick"]>();
            pickDb.findFirst.mockResolvedValueOnce(null);

            const result = await dao.getTradesPaginated(
                {
                    pick: { pickType: "MAJORS", season: 2026, round: 99, originalOwnerId: uuid() },
                    page: 0,
                    pageSize: 20,
                },
                pickDb as unknown as ExtendedPrismaClient["draftPick"]
            );

            expect(result).toEqual({ trades: [], total: 0 });
            expect(prisma.findMany).not.toHaveBeenCalled();
        });

        it("should combine status + date + player filters", async () => {
            const playerId = uuid();
            prisma.findMany.mockResolvedValueOnce([] as any);
            prisma.count.mockResolvedValueOnce(0);

            await dao.getTradesPaginated({
                statuses: [TradeStatus.SUBMITTED],
                dateFrom: "2026-01-01",
                dateField: "ACCEPTED",
                playerId,
                page: 0,
                pageSize: 10,
            });

            const call = prisma.findMany.mock.calls[0][0] as { where: Record<string, unknown> };
            expect(call.where).toHaveProperty("status", { in: [TradeStatus.SUBMITTED] });
            expect(call.where).toHaveProperty("acceptedOnDate");
            expect(call.where).toHaveProperty("tradeItems");
        });
    });
});

// ─── Extracted helpers ────────────────────────────────────────────────────────

describe("buildStaffTradeWhere", () => {
    it("should return empty object when no filters provided", () => {
        expect(buildStaffTradeWhere({})).toEqual({});
    });

    it("should include status filter", () => {
        const where = buildStaffTradeWhere({ statuses: [TradeStatus.DRAFT, TradeStatus.REQUESTED] });
        expect(where).toEqual({ status: { in: [TradeStatus.DRAFT, TradeStatus.REQUESTED] } });
    });

    it("should not include status when array is empty", () => {
        const where = buildStaffTradeWhere({ statuses: [] });
        expect(where).not.toHaveProperty("status");
    });

    it("should add dateCreated range when dateField omitted", () => {
        const where = buildStaffTradeWhere({
            dateFrom: "2026-01-01T00:00:00Z",
            dateTo: "2026-12-31T23:59:59Z",
        });
        expect(where).toHaveProperty("dateCreated");
        expect((where.dateCreated as { gte: Date; lte: Date }).gte).toEqual(new Date("2026-01-01T00:00:00Z"));
    });

    it("should map dateField DECLINED to declinedAt", () => {
        const where = buildStaffTradeWhere({ dateFrom: "2026-06-01", dateField: "DECLINED" });
        expect(where).toHaveProperty("declinedAt");
        expect(where).not.toHaveProperty("dateCreated");
    });

    it("should add playerId as tradeItems.some filter", () => {
        const pid = uuid();
        const where = buildStaffTradeWhere({ playerId: pid });
        expect(where.tradeItems).toEqual({
            some: { tradeItemType: TradeItemType.PLAYER, tradeItemId: pid },
        });
    });
});

describe("resolvePickId", () => {
    const pickDb = mockDeep<PrismaClient["draftPick"]>();

    afterEach(() => mockClear(pickDb));

    it("should return the id when a matching pick exists", async () => {
        const id = uuid();
        pickDb.findFirst.mockResolvedValueOnce({ id } as any);

        const result = await resolvePickId(pickDb as unknown as ExtendedPrismaClient["draftPick"], {
            pickType: "MAJORS",
            season: 2026,
            round: 1,
            originalOwnerId: uuid(),
        });

        expect(result).toBe(id);
    });

    it("should return null when no matching pick exists", async () => {
        pickDb.findFirst.mockResolvedValueOnce(null);

        const result = await resolvePickId(pickDb as unknown as ExtendedPrismaClient["draftPick"], {
            pickType: "HIGHMINORS",
            season: 2026,
            round: 5,
            originalOwnerId: uuid(),
        });

        expect(result).toBeNull();
    });
});
