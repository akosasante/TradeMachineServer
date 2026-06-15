import { mockDeep, mockClear } from "jest-mock-extended";
import DraftPickDAO, { draftPickInclude } from "../../../../src/DAO/v2/DraftPickDAO";
import { ExtendedPrismaClient } from "../../../../src/bootstrap/prisma-db";
import { DraftPickFactory } from "../../../factories/DraftPickFactory";
import { daoTestLifecycle, expectDaoRequiresPrismaClient } from "./daoTestHelpers";
import { v4 as uuid } from "uuid";
import { Prisma, PickLeagueLevel } from "@prisma/client";

const makePick = (...args: Parameters<typeof DraftPickFactory.getPrismaPickWithTeams>) =>
    DraftPickFactory.getPrismaPickWithTeams(...args);
const expectedInclude = draftPickInclude;

describe("[PRISMA] DraftPickDAO", () => {
    const prisma = mockDeep<ExtendedPrismaClient["draftPick"]>();
    const dao = new DraftPickDAO(prisma as unknown as ExtendedPrismaClient["draftPick"]);

    daoTestLifecycle("DRAFTPICK");
    afterEach(() => {
        mockClear(prisma);
    });

    expectDaoRequiresPrismaClient(DraftPickDAO, "DraftPickDAO");

    describe("getAllPicks", () => {
        it("should return all picks with team relations when no filters are provided", async () => {
            const picks = [makePick(), makePick({ season: 2027 })];
            prisma.findMany.mockResolvedValueOnce(picks as any);

            const result = await dao.getAllPicks();

            expect(prisma.findMany).toHaveBeenCalledWith({
                where: {},
                orderBy: [{ season: "desc" }, { round: "asc" }, { pickNumber: "asc" }],
                include: expectedInclude,
            });
            expect(result).toHaveLength(2);
        });

        it("should filter by season when provided", async () => {
            prisma.findMany.mockResolvedValueOnce([]);

            await dao.getAllPicks({ season: 2026 });

            expect(prisma.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { season: 2026 },
                })
            );
        });

        it("should filter by type when provided", async () => {
            prisma.findMany.mockResolvedValueOnce([]);

            await dao.getAllPicks({ type: PickLeagueLevel.HIGHMINORS });

            expect(prisma.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { type: PickLeagueLevel.HIGHMINORS },
                })
            );
        });

        it("should combine season and type filters", async () => {
            prisma.findMany.mockResolvedValueOnce([]);

            await dao.getAllPicks({ season: 2027, type: PickLeagueLevel.LOWMINORS });

            expect(prisma.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { season: 2027, type: PickLeagueLevel.LOWMINORS },
                })
            );
        });
    });

    describe("getPickById", () => {
        it("should find a pick by id with team relations", async () => {
            const pick = makePick();
            prisma.findUniqueOrThrow.mockResolvedValueOnce(pick as any);

            const result = await dao.getPickById(pick.id);

            expect(prisma.findUniqueOrThrow).toHaveBeenCalledWith({
                where: { id: pick.id },
                include: expectedInclude,
            });
            expect(result.id).toBe(pick.id);
        });
    });

    describe("createPick", () => {
        it("should create a pick with all fields", async () => {
            const ownerId = uuid();
            const pick = makePick({ currentOwnerId: ownerId, originalOwnerId: ownerId });
            prisma.create.mockResolvedValueOnce(pick as any);

            await dao.createPick({
                round: 2,
                season: 2026,
                type: PickLeagueLevel.MAJORS,
                currentOwnerId: ownerId,
                originalOwnerId: ownerId,
                pickNumber: 5,
            });

            expect(prisma.create).toHaveBeenCalledWith({
                data: {
                    round: new Prisma.Decimal(2),
                    season: 2026,
                    type: PickLeagueLevel.MAJORS,
                    pickNumber: 5,
                    currentOwnerId: ownerId,
                    originalOwnerId: ownerId,
                },
                include: expectedInclude,
            });
        });

        it("should default optional fields to null", async () => {
            const pick = makePick();
            prisma.create.mockResolvedValueOnce(pick as any);

            await dao.createPick({ round: 1, season: 2026, type: PickLeagueLevel.MAJORS });

            expect(prisma.create).toHaveBeenCalledWith({
                data: {
                    round: new Prisma.Decimal(1),
                    season: 2026,
                    type: PickLeagueLevel.MAJORS,
                    pickNumber: null,
                    currentOwnerId: null,
                    originalOwnerId: null,
                },
                include: expectedInclude,
            });
        });
    });

    describe("updatePick", () => {
        it("should update scalar fields", async () => {
            const pick = makePick();
            prisma.update.mockResolvedValueOnce(pick as any);

            await dao.updatePick(pick.id, {
                round: 3,
                season: 2027,
                type: PickLeagueLevel.HIGHMINORS,
                pickNumber: 10,
            });

            expect(prisma.update).toHaveBeenCalledWith({
                where: { id: pick.id },
                data: {
                    round: new Prisma.Decimal(3),
                    season: 2027,
                    type: PickLeagueLevel.HIGHMINORS,
                    pickNumber: 10,
                },
                include: expectedInclude,
            });
        });

        it("should connect currentOwner when id is provided", async () => {
            const pick = makePick();
            const newOwnerId = uuid();
            prisma.update.mockResolvedValueOnce(pick as any);

            await dao.updatePick(pick.id, { currentOwnerId: newOwnerId });

            expect(prisma.update).toHaveBeenCalledWith({
                where: { id: pick.id },
                data: {
                    currentOwner: { connect: { id: newOwnerId } },
                },
                include: expectedInclude,
            });
        });

        it("should disconnect currentOwner when set to null", async () => {
            const pick = makePick();
            prisma.update.mockResolvedValueOnce(pick as any);

            await dao.updatePick(pick.id, { currentOwnerId: null });

            expect(prisma.update).toHaveBeenCalledWith({
                where: { id: pick.id },
                data: {
                    currentOwner: { disconnect: true },
                },
                include: expectedInclude,
            });
        });

        it("should connect originalOwner when id is provided", async () => {
            const pick = makePick();
            const ownerId = uuid();
            prisma.update.mockResolvedValueOnce(pick as any);

            await dao.updatePick(pick.id, { originalOwnerId: ownerId });

            expect(prisma.update).toHaveBeenCalledWith({
                where: { id: pick.id },
                data: {
                    originalOwner: { connect: { id: ownerId } },
                },
                include: expectedInclude,
            });
        });

        it("should disconnect originalOwner when set to null", async () => {
            const pick = makePick();
            prisma.update.mockResolvedValueOnce(pick as any);

            await dao.updatePick(pick.id, { originalOwnerId: null });

            expect(prisma.update).toHaveBeenCalledWith({
                where: { id: pick.id },
                data: {
                    originalOwner: { disconnect: true },
                },
                include: expectedInclude,
            });
        });

        it("should not include owner fields when they are not in the update data", async () => {
            const pick = makePick();
            prisma.update.mockResolvedValueOnce(pick as any);

            await dao.updatePick(pick.id, { season: 2028 });

            const call = prisma.update.mock.calls[0][0];
            expect(call.data).toEqual({ season: 2028 });
            expect(call.data).not.toHaveProperty("currentOwner");
            expect(call.data).not.toHaveProperty("originalOwner");
        });
    });

    describe("deletePick", () => {
        it("should delete pick by id and return deleted pick with teams", async () => {
            const pick = makePick();
            prisma.delete.mockResolvedValueOnce(pick as any);

            const result = await dao.deletePick(pick.id);

            expect(prisma.delete).toHaveBeenCalledWith({
                where: { id: pick.id },
                include: expectedInclude,
            });
            expect(result.id).toBe(pick.id);
        });
    });
});
