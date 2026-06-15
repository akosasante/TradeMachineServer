import { PrismaClient, TradeItemType, TradeParticipantType, TradeStatus } from "@prisma/client";
import { mockClear, mockDeep } from "jest-mock-extended";
import TradeDAO, {
    AcceptedByEntry,
    buildStaffTradeWhere,
    resolvePickIds,
    tradeWithRelations,
} from "../../../../src/DAO/v2/TradeDAO";
import { ExtendedPrismaClient } from "../../../../src/bootstrap/prisma-db";
import { TradeFactory } from "../../../factories/TradeFactory";
import { daoTestLifecycle, expectDaoRequiresPrismaClient } from "./daoTestHelpers";
import { v4 as uuid } from "uuid";

const makeMinimalTrade = (...args: Parameters<typeof TradeFactory.getPrismaTrade>) =>
    TradeFactory.getPrismaTrade(...args);

describe("[PRISMA] TradeDAO", () => {
    const prisma = mockDeep<PrismaClient["trade"]>();
    const tradeItemDb = mockDeep<ExtendedPrismaClient["tradeItem"]>();
    const dao = new TradeDAO(prisma as unknown as ExtendedPrismaClient["trade"]);
    const tradeId = uuid();
    const testTrade = makeMinimalTrade({ id: tradeId });

    daoTestLifecycle("TRADE");
    afterEach(() => {
        mockClear(prisma);
        mockClear(tradeItemDb);
    });

    expectDaoRequiresPrismaClient(TradeDAO, "TradeDAO");

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
                    where: expect.objectContaining({
                        tradeParticipants: { some: { teamId } },
                        status: { in: [TradeStatus.REQUESTED, TradeStatus.PENDING] },
                    }),
                })
            );
        });

        it("should omit status filter when statuses is empty", async () => {
            prisma.findMany.mockResolvedValueOnce([] as any);
            prisma.count.mockResolvedValueOnce(0);

            await dao.getTradesByTeam(teamId, { statuses: [], page: 0, pageSize: 20 });

            const call = prisma.findMany.mock.calls[0][0] as { where: Record<string, unknown> };
            expect(call.where).toHaveProperty("tradeParticipants");
            expect(call.where).not.toHaveProperty("status");
        });

        it("should order by submittedAt desc when orderBy is SUBMITTED", async () => {
            prisma.findMany.mockResolvedValueOnce([tradeA] as any);
            prisma.count.mockResolvedValueOnce(1);

            await dao.getTradesByTeam(teamId, {
                statuses: [TradeStatus.SUBMITTED],
                page: 0,
                pageSize: 10,
                orderBy: "SUBMITTED",
            });

            expect(prisma.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    orderBy: { submittedAt: "desc" },
                })
            );
        });

        it("should order by dateCreated desc when orderBy is CREATED (explicit)", async () => {
            prisma.findMany.mockResolvedValueOnce([tradeA] as any);
            prisma.count.mockResolvedValueOnce(1);

            await dao.getTradesByTeam(teamId, { page: 0, pageSize: 10, orderBy: "CREATED" });

            expect(prisma.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    orderBy: { dateCreated: "desc" },
                })
            );
        });

        it("should filter by date range on submittedAt when dateField is SUBMITTED", async () => {
            prisma.findMany.mockResolvedValueOnce([] as any);
            prisma.count.mockResolvedValueOnce(0);

            await dao.getTradesByTeam(teamId, {
                dateFrom: "2026-01-01",
                dateField: "SUBMITTED",
                page: 0,
                pageSize: 20,
            });

            const call = prisma.findMany.mock.calls[0][0] as { where: Record<string, unknown> };
            expect(call.where).toHaveProperty("submittedAt");
            expect(call.where).not.toHaveProperty("dateCreated");
            expect(call.where).toHaveProperty("tradeParticipants");
        });

        it("should filter by playerIds using AND tradeItems.some constraint", async () => {
            const playerId = uuid();
            prisma.findMany.mockResolvedValueOnce([tradeA] as any);
            prisma.count.mockResolvedValueOnce(1);

            await dao.getTradesByTeam(teamId, {
                playerIds: [playerId],
                page: 0,
                pageSize: 20,
            });

            const call = prisma.findMany.mock.calls[0][0] as { where: { AND: unknown[] } };
            expect(call.where).toHaveProperty("tradeParticipants");
            expect(call.where.AND).toContainEqual({
                tradeItems: { some: { tradeItemType: TradeItemType.PLAYER, tradeItemId: playerId } },
            });
        });

        it("should resolve pick filter and include tradeItems.some with PICK type", async () => {
            const pickDb = mockDeep<PrismaClient["draftPick"]>();
            const resolvedId = uuid();
            pickDb.findMany.mockResolvedValueOnce([{ id: resolvedId }] as any);
            prisma.findMany.mockResolvedValueOnce([tradeA] as any);
            prisma.count.mockResolvedValueOnce(1);

            await dao.getTradesByTeam(
                teamId,
                { pick: { pickType: "MAJORS", season: 2026 }, page: 0, pageSize: 20 },
                pickDb as unknown as ExtendedPrismaClient["draftPick"]
            );

            expect(pickDb.findMany).toHaveBeenCalledTimes(1);
            const call = prisma.findMany.mock.calls[0][0] as { where: { AND: unknown[] } };
            expect(call.where).toHaveProperty("tradeParticipants");
            expect(call.where.AND).toContainEqual({
                tradeItems: {
                    some: { tradeItemType: TradeItemType.PICK, tradeItemId: { in: [resolvedId] } },
                },
            });
        });

        it("should return empty when pick filter resolves to no picks", async () => {
            const pickDb = mockDeep<PrismaClient["draftPick"]>();
            pickDb.findMany.mockResolvedValueOnce([]);

            const result = await dao.getTradesByTeam(
                teamId,
                { pick: { pickType: "MAJORS", season: 2099 }, page: 0, pageSize: 20 },
                pickDb as unknown as ExtendedPrismaClient["draftPick"]
            );

            expect(result).toEqual({ trades: [], total: 0 });
            expect(prisma.findMany).not.toHaveBeenCalled();
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

        it("should pass single playerIds filter as AND tradeItems.some constraint", async () => {
            const playerId = uuid();
            prisma.findMany.mockResolvedValueOnce([tradeA] as any);
            prisma.count.mockResolvedValueOnce(1);

            await dao.getTradesPaginated({ playerIds: [playerId], page: 0, pageSize: 20 });

            expect(prisma.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        AND: [
                            {
                                tradeItems: {
                                    some: { tradeItemType: TradeItemType.PLAYER, tradeItemId: playerId },
                                },
                            },
                        ],
                    }),
                })
            );
        });

        it("should use AND logic for multiple playerIds (trade must involve all)", async () => {
            const playerA = uuid();
            const playerB = uuid();
            prisma.findMany.mockResolvedValueOnce([tradeA] as any);
            prisma.count.mockResolvedValueOnce(1);

            await dao.getTradesPaginated({ playerIds: [playerA, playerB], page: 0, pageSize: 20 });

            const call = prisma.findMany.mock.calls[0][0] as { where: { AND: unknown[] } };
            expect(call.where.AND).toHaveLength(2);
            expect(call.where.AND).toEqual([
                { tradeItems: { some: { tradeItemType: TradeItemType.PLAYER, tradeItemId: playerA } } },
                { tradeItems: { some: { tradeItemType: TradeItemType.PLAYER, tradeItemId: playerB } } },
            ]);
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

        it("should resolve pick and filter when pick + pickDb provided (full pick)", async () => {
            const pickDb = mockDeep<PrismaClient["draftPick"]>();
            const resolvedId = uuid();
            pickDb.findMany.mockResolvedValueOnce([{ id: resolvedId }] as any);
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

            expect(pickDb.findMany).toHaveBeenCalledTimes(1);
            expect(prisma.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        AND: [
                            {
                                tradeItems: {
                                    some: { tradeItemType: TradeItemType.PICK, tradeItemId: { in: [resolvedId] } },
                                },
                            },
                        ],
                    }),
                })
            );
        });

        it("should resolve partial pick (type-only) and use IN filter", async () => {
            const pickDb = mockDeep<PrismaClient["draftPick"]>();
            const idA = uuid();
            const idB = uuid();
            pickDb.findMany.mockResolvedValueOnce([{ id: idA }, { id: idB }] as any);
            prisma.findMany.mockResolvedValueOnce([tradeA] as any);
            prisma.count.mockResolvedValueOnce(1);

            await dao.getTradesPaginated(
                {
                    pick: { pickType: "HIGHMINORS" },
                    page: 0,
                    pageSize: 20,
                },
                pickDb as unknown as ExtendedPrismaClient["draftPick"]
            );

            expect(pickDb.findMany).toHaveBeenCalledTimes(1);
            const pickCall = pickDb.findMany.mock.calls[0][0] as { where: Record<string, unknown> };
            expect(pickCall.where).not.toHaveProperty("season");
            expect(pickCall.where).not.toHaveProperty("round");
            expect(pickCall.where).not.toHaveProperty("originalOwnerId");

            expect(prisma.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        AND: [
                            {
                                tradeItems: {
                                    some: { tradeItemType: TradeItemType.PICK, tradeItemId: { in: [idA, idB] } },
                                },
                            },
                        ],
                    }),
                })
            );
        });

        it("should resolve partial pick (type + season) and use IN filter", async () => {
            const pickDb = mockDeep<PrismaClient["draftPick"]>();
            const idA = uuid();
            pickDb.findMany.mockResolvedValueOnce([{ id: idA }] as any);
            prisma.findMany.mockResolvedValueOnce([tradeA] as any);
            prisma.count.mockResolvedValueOnce(1);

            await dao.getTradesPaginated(
                {
                    pick: { pickType: "MAJORS", season: 2026 },
                    page: 0,
                    pageSize: 20,
                },
                pickDb as unknown as ExtendedPrismaClient["draftPick"]
            );

            const pickCall = pickDb.findMany.mock.calls[0][0] as { where: Record<string, unknown> };
            expect(pickCall.where).toHaveProperty("type", "MAJORS");
            expect(pickCall.where).toHaveProperty("season", 2026);
            expect(pickCall.where).not.toHaveProperty("round");
            expect(pickCall.where).not.toHaveProperty("originalOwnerId");
        });

        it("should return empty when no picks match partial filter", async () => {
            const pickDb = mockDeep<PrismaClient["draftPick"]>();
            pickDb.findMany.mockResolvedValueOnce([]);

            const result = await dao.getTradesPaginated(
                {
                    pick: { pickType: "MAJORS", season: 2099 },
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
                playerIds: [playerId],
                page: 0,
                pageSize: 10,
            });

            const call = prisma.findMany.mock.calls[0][0] as { where: Record<string, unknown> };
            expect(call.where).toHaveProperty("status", { in: [TradeStatus.SUBMITTED] });
            expect(call.where).toHaveProperty("acceptedOnDate");
            expect(call.where).toHaveProperty("AND");
        });
    });

    // ─── New draft/trade-item methods ────────────────────────────────────────────

    describe("createDraft", () => {
        it("should call prisma.create with DRAFT status, CREATOR participant, and RECIPIENT participants", async () => {
            const creatorTeamId = uuid();
            const recipientTeamId1 = uuid();
            const recipientTeamId2 = uuid();
            const createdTrade = makeMinimalTrade({ id: tradeId });

            prisma.create.mockResolvedValueOnce(createdTrade as any);
            prisma.findUniqueOrThrow.mockResolvedValueOnce(createdTrade as any);

            await dao.createDraft({ creatorTeamId, participantTeamIds: [recipientTeamId1, recipientTeamId2] });

            expect(prisma.create).toHaveBeenCalledTimes(1);
            expect(prisma.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        status: TradeStatus.DRAFT,
                        tradeParticipants: expect.objectContaining({
                            create: expect.arrayContaining([
                                expect.objectContaining({
                                    participantType: TradeParticipantType.CREATOR,
                                    teamId: creatorTeamId,
                                }),
                                expect.objectContaining({
                                    participantType: TradeParticipantType.RECIPIENT,
                                    teamId: recipientTeamId1,
                                }),
                                expect.objectContaining({
                                    participantType: TradeParticipantType.RECIPIENT,
                                    teamId: recipientTeamId2,
                                }),
                            ]),
                        }),
                    }),
                })
            );

            expect(prisma.findUniqueOrThrow).toHaveBeenCalledWith(
                expect.objectContaining({ where: { id: createdTrade.id } })
            );
        });

        it("should create with only CREATOR participant when participantTeamIds is empty", async () => {
            const creatorTeamId = uuid();
            const createdTrade = makeMinimalTrade({ id: tradeId });

            prisma.create.mockResolvedValueOnce(createdTrade as any);
            prisma.findUniqueOrThrow.mockResolvedValueOnce(createdTrade as any);

            await dao.createDraft({ creatorTeamId, participantTeamIds: [] });

            expect(prisma.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        status: TradeStatus.DRAFT,
                        tradeParticipants: expect.objectContaining({
                            create: [
                                expect.objectContaining({
                                    participantType: TradeParticipantType.CREATOR,
                                    teamId: creatorTeamId,
                                }),
                            ],
                        }),
                    }),
                })
            );
        });
    });

    describe("updateDraftParticipants", () => {
        it("should deleteMany RECIPIENT participants and create new ones, then hydrate", async () => {
            const newRecipientId1 = uuid();
            const newRecipientId2 = uuid();

            prisma.update.mockResolvedValueOnce(testTrade as any);
            prisma.findUniqueOrThrow.mockResolvedValueOnce(testTrade as any);

            await dao.updateDraftParticipants(tradeId, [newRecipientId1, newRecipientId2]);

            expect(prisma.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: tradeId },
                    data: expect.objectContaining({
                        tradeParticipants: expect.objectContaining({
                            deleteMany: { participantType: TradeParticipantType.RECIPIENT },
                            create: expect.arrayContaining([
                                expect.objectContaining({
                                    participantType: TradeParticipantType.RECIPIENT,
                                    teamId: newRecipientId1,
                                }),
                                expect.objectContaining({
                                    participantType: TradeParticipantType.RECIPIENT,
                                    teamId: newRecipientId2,
                                }),
                            ]),
                        }),
                    }),
                })
            );

            expect(prisma.findUniqueOrThrow).toHaveBeenCalledWith(expect.objectContaining({ where: { id: tradeId } }));
        });

        it("should call deleteMany with no create entries when recipientTeamIds is empty", async () => {
            prisma.update.mockResolvedValueOnce(testTrade as any);
            prisma.findUniqueOrThrow.mockResolvedValueOnce(testTrade as any);

            await dao.updateDraftParticipants(tradeId, []);

            expect(prisma.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        tradeParticipants: expect.objectContaining({
                            deleteMany: { participantType: TradeParticipantType.RECIPIENT },
                            create: [],
                        }),
                    }),
                })
            );
        });
    });

    describe("addTradeItem", () => {
        it("should call prisma.update with tradeItems.create containing all fields, then hydrate", async () => {
            const itemId = uuid();
            const senderId = uuid();
            const recipientId = uuid();

            prisma.update.mockResolvedValueOnce(testTrade as any);
            prisma.findUniqueOrThrow.mockResolvedValueOnce(testTrade as any);

            await dao.addTradeItem(tradeId, {
                tradeItemType: TradeItemType.PLAYER,
                tradeItemId: itemId,
                senderId,
                recipientId,
            });

            expect(prisma.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: tradeId },
                    data: expect.objectContaining({
                        tradeItems: expect.objectContaining({
                            create: expect.objectContaining({
                                tradeItemType: TradeItemType.PLAYER,
                                tradeItemId: itemId,
                                senderId,
                                recipientId,
                            }),
                        }),
                    }),
                })
            );

            expect(prisma.findUniqueOrThrow).toHaveBeenCalledWith(expect.objectContaining({ where: { id: tradeId } }));
        });

        it("should pass the PICK tradeItemType to the create data", async () => {
            const itemId = uuid();
            const senderId = uuid();
            const recipientId = uuid();

            prisma.update.mockResolvedValueOnce(testTrade as any);
            prisma.findUniqueOrThrow.mockResolvedValueOnce(testTrade as any);

            await dao.addTradeItem(tradeId, {
                tradeItemType: TradeItemType.PICK,
                tradeItemId: itemId,
                senderId,
                recipientId,
            });

            expect(prisma.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        tradeItems: expect.objectContaining({
                            create: expect.objectContaining({
                                tradeItemType: TradeItemType.PICK,
                                tradeItemId: itemId,
                            }),
                        }),
                    }),
                })
            );
        });
    });

    describe("updateTradeItem", () => {
        it("should update tradeItem by lineId and hydrate via tradeId", async () => {
            const lineId = uuid();
            const senderId = uuid();
            const recipientId = uuid();
            const updatedItem = { id: lineId, tradeId };

            tradeItemDb.update.mockResolvedValueOnce(updatedItem as any);
            prisma.findUniqueOrThrow.mockResolvedValueOnce(testTrade as any);

            await dao.updateTradeItem(
                lineId,
                { senderId, recipientId },
                tradeItemDb as unknown as ExtendedPrismaClient["tradeItem"]
            );

            expect(tradeItemDb.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: lineId },
                    data: expect.objectContaining({ senderId, recipientId }),
                })
            );

            expect(prisma.findUniqueOrThrow).toHaveBeenCalledWith(expect.objectContaining({ where: { id: tradeId } }));
        });

        it("should work with a partial update (senderId only)", async () => {
            const lineId = uuid();
            const senderId = uuid();
            const updatedItem = { id: lineId, tradeId };

            tradeItemDb.update.mockResolvedValueOnce(updatedItem as any);
            prisma.findUniqueOrThrow.mockResolvedValueOnce(testTrade as any);

            await dao.updateTradeItem(
                lineId,
                { senderId },
                tradeItemDb as unknown as ExtendedPrismaClient["tradeItem"]
            );

            expect(tradeItemDb.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({ senderId }),
                })
            );
        });

        it("should throw when updated tradeItem has no tradeId", async () => {
            const lineId = uuid();
            const updatedItem = { id: lineId, tradeId: null };

            tradeItemDb.update.mockResolvedValueOnce(updatedItem as any);

            await expect(
                dao.updateTradeItem(
                    lineId,
                    { senderId: uuid() },
                    tradeItemDb as unknown as ExtendedPrismaClient["tradeItem"]
                )
            ).rejects.toThrow();

            expect(prisma.findUniqueOrThrow).not.toHaveBeenCalled();
        });
    });

    describe("removeTradeItem", () => {
        it("should find tradeItem, delete it, then hydrate via tradeId", async () => {
            const lineId = uuid();

            tradeItemDb.findUniqueOrThrow.mockResolvedValueOnce({ tradeId } as any);
            tradeItemDb.delete.mockResolvedValueOnce({} as any);
            prisma.findUniqueOrThrow.mockResolvedValueOnce(testTrade as any);

            await dao.removeTradeItem(lineId, tradeItemDb as unknown as ExtendedPrismaClient["tradeItem"]);

            expect(tradeItemDb.findUniqueOrThrow).toHaveBeenCalledWith(
                expect.objectContaining({ where: { id: lineId } })
            );
            expect(tradeItemDb.delete).toHaveBeenCalledWith(expect.objectContaining({ where: { id: lineId } }));
            expect(prisma.findUniqueOrThrow).toHaveBeenCalledWith(expect.objectContaining({ where: { id: tradeId } }));
        });

        it("should propagate error when tradeItem is not found", async () => {
            const lineId = uuid();

            tradeItemDb.findUniqueOrThrow.mockRejectedValueOnce(new Error("Record not found"));

            await expect(
                dao.removeTradeItem(lineId, tradeItemDb as unknown as ExtendedPrismaClient["tradeItem"])
            ).rejects.toThrow("Record not found");

            expect(tradeItemDb.delete).not.toHaveBeenCalled();
            expect(prisma.findUniqueOrThrow).not.toHaveBeenCalled();
        });
    });

    describe("deleteDraft", () => {
        const ownerId = uuid();
        const creatorTeamId = uuid();

        const makeDraftTradeWithOwner = (
            overrides: Partial<{ status: TradeStatus; participantType: TradeParticipantType; ownerId: string }> = {}
        ) => {
            const participantType = overrides.participantType ?? TradeParticipantType.CREATOR;
            const ownerIdToUse = overrides.ownerId ?? ownerId;
            const status = overrides.status ?? TradeStatus.DRAFT;
            return {
                id: tradeId,
                status,
                tradeParticipants: [
                    {
                        participantType,
                        teamId: creatorTeamId,
                        team: {
                            id: creatorTeamId,
                            owners: [{ id: ownerIdToUse }],
                        },
                    },
                ],
                tradeItems: [],
                emails: [],
            };
        };

        it("should delete the trade when status is DRAFT and user is an owner of the creator team", async () => {
            prisma.findUniqueOrThrow.mockResolvedValueOnce(makeDraftTradeWithOwner() as any);
            prisma.delete.mockResolvedValueOnce(testTrade as any);

            await dao.deleteDraft(tradeId, ownerId);

            expect(prisma.delete).toHaveBeenCalledWith({ where: { id: tradeId } });
        });

        it("should throw when trade status is not DRAFT", async () => {
            prisma.findUniqueOrThrow.mockResolvedValueOnce(
                makeDraftTradeWithOwner({ status: TradeStatus.REQUESTED }) as any
            );

            await expect(dao.deleteDraft(tradeId, ownerId)).rejects.toThrow();

            expect(prisma.delete).not.toHaveBeenCalled();
        });

        it("should throw when user is not an owner of the creator team", async () => {
            const differentOwnerId = uuid();
            prisma.findUniqueOrThrow.mockResolvedValueOnce(
                makeDraftTradeWithOwner({ ownerId: differentOwnerId }) as any
            );

            await expect(dao.deleteDraft(tradeId, ownerId)).rejects.toThrow();

            expect(prisma.delete).not.toHaveBeenCalled();
        });

        it("should throw when no CREATOR participant exists", async () => {
            const tradeWithNoCreator = {
                id: tradeId,
                status: TradeStatus.DRAFT,
                tradeParticipants: [
                    {
                        participantType: TradeParticipantType.RECIPIENT,
                        teamId: uuid(),
                        team: { id: uuid(), owners: [{ id: ownerId }] },
                    },
                ],
                tradeItems: [],
                emails: [],
            };
            prisma.findUniqueOrThrow.mockResolvedValueOnce(tradeWithNoCreator as any);

            await expect(dao.deleteDraft(tradeId, ownerId)).rejects.toThrow();

            expect(prisma.delete).not.toHaveBeenCalled();
        });
    });

    describe("listDraftsForUser", () => {
        it("should query by team ids with DRAFT status, paginate, and return count", async () => {
            const teamIds = [uuid(), uuid()];
            const tradeA = makeMinimalTrade({ id: uuid(), status: TradeStatus.DRAFT });
            const tradeB = makeMinimalTrade({ id: uuid(), status: TradeStatus.DRAFT });

            prisma.findMany.mockResolvedValueOnce([tradeA, tradeB] as any);
            prisma.count.mockResolvedValueOnce(2);

            const result = await dao.listDraftsForUser({ teamIds, skip: 0, take: 10 });

            expect(prisma.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        tradeParticipants: { some: { teamId: { in: teamIds } } },
                        status: TradeStatus.DRAFT,
                    }),
                    skip: 0,
                    take: 10,
                })
            );

            expect(prisma.count).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        status: TradeStatus.DRAFT,
                    }),
                })
            );

            expect(result).toEqual({ trades: [tradeA, tradeB], total: 2 });
        });

        it("should calculate skip based on page and pageSize", async () => {
            const teamIds = [uuid()];

            prisma.findMany.mockResolvedValueOnce([] as any);
            prisma.count.mockResolvedValueOnce(0);

            await dao.listDraftsForUser({ teamIds, skip: 10, take: 5 });

            expect(prisma.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    skip: 10,
                    take: 5,
                })
            );
        });
    });

    describe("requestTrade", () => {
        it("should transition DRAFT trade to REQUESTED status and return hydrated trade", async () => {
            prisma.findUniqueOrThrow.mockResolvedValueOnce({ status: TradeStatus.DRAFT } as any);
            prisma.update.mockResolvedValueOnce(testTrade as any);
            prisma.findUniqueOrThrow.mockResolvedValueOnce(testTrade as any);

            const result = await dao.requestTrade(tradeId);

            expect(prisma.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: tradeId },
                    data: expect.objectContaining({ status: TradeStatus.REQUESTED }),
                })
            );

            // Second findUniqueOrThrow is the hydration call
            expect(prisma.findUniqueOrThrow).toHaveBeenCalledTimes(2);
            expect(result).toEqual(testTrade);
        });

        it("should throw when trade status is not DRAFT", async () => {
            prisma.findUniqueOrThrow.mockResolvedValueOnce({ status: TradeStatus.REQUESTED } as any);

            await expect(dao.requestTrade(tradeId)).rejects.toThrow();

            expect(prisma.update).not.toHaveBeenCalled();
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

    it("should add single playerIds as AND tradeItems.some filter", () => {
        const pid = uuid();
        const where = buildStaffTradeWhere({ playerIds: [pid] });
        expect(where.AND).toEqual([
            { tradeItems: { some: { tradeItemType: TradeItemType.PLAYER, tradeItemId: pid } } },
        ]);
    });

    it("should use AND logic for multiple playerIds", () => {
        const pidA = uuid();
        const pidB = uuid();
        const where = buildStaffTradeWhere({ playerIds: [pidA, pidB] });
        expect(where.AND as unknown[]).toHaveLength(2);
    });

    it("should not add AND clause when playerIds is empty", () => {
        const where = buildStaffTradeWhere({ playerIds: [] });
        expect(where).not.toHaveProperty("AND");
    });
});

describe("resolvePickIds", () => {
    const pickDb = mockDeep<PrismaClient["draftPick"]>();

    afterEach(() => mockClear(pickDb));

    it("should return ids when matching picks exist (full filter)", async () => {
        const id = uuid();
        pickDb.findMany.mockResolvedValueOnce([{ id }] as any);

        const result = await resolvePickIds(pickDb as unknown as ExtendedPrismaClient["draftPick"], {
            pickType: "MAJORS",
            season: 2026,
            round: 1,
            originalOwnerId: uuid(),
        });

        expect(result).toEqual([id]);
    });

    it("should return empty array when no matching picks exist", async () => {
        pickDb.findMany.mockResolvedValueOnce([]);

        const result = await resolvePickIds(pickDb as unknown as ExtendedPrismaClient["draftPick"], {
            pickType: "HIGHMINORS",
            season: 2099,
        });

        expect(result).toEqual([]);
    });

    it("should query only provided fields (partial filter)", async () => {
        pickDb.findMany.mockResolvedValueOnce([{ id: uuid() }, { id: uuid() }] as any);

        await resolvePickIds(pickDb as unknown as ExtendedPrismaClient["draftPick"], {
            pickType: "HIGHMINORS",
        });

        const call = pickDb.findMany.mock.calls[0][0] as { where: Record<string, unknown> };
        expect(call.where).toHaveProperty("type", "HIGHMINORS");
        expect(call.where).not.toHaveProperty("season");
        expect(call.where).not.toHaveProperty("round");
        expect(call.where).not.toHaveProperty("originalOwnerId");
    });

    it("should return multiple ids for partial filter (type + season)", async () => {
        const idA = uuid();
        const idB = uuid();
        const idC = uuid();
        pickDb.findMany.mockResolvedValueOnce([{ id: idA }, { id: idB }, { id: idC }] as any);

        const result = await resolvePickIds(pickDb as unknown as ExtendedPrismaClient["draftPick"], {
            pickType: "MAJORS",
            season: 2026,
        });

        expect(result).toEqual([idA, idB, idC]);
    });
});
