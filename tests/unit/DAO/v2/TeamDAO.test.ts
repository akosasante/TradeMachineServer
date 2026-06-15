import { mockDeep, mockClear } from "jest-mock-extended";
import TeamDAO, { teamInclude } from "../../../../src/DAO/v2/TeamDAO";
import { ExtendedPrismaClient } from "../../../../src/bootstrap/prisma-db";
import { TeamFactory } from "../../../factories/TeamFactory";
import { daoTestLifecycle, expectDaoRequiresPrismaClient } from "./daoTestHelpers";
import { TeamStatus } from "@prisma/client";

const makeTeam = (...args: Parameters<typeof TeamFactory.getPrismaTeamWithOwners>) =>
    TeamFactory.getPrismaTeamWithOwners(...args);

describe("[PRISMA] TeamDAO", () => {
    const prisma = mockDeep<ExtendedPrismaClient["team"]>();
    const dao = new TeamDAO(prisma as unknown as ExtendedPrismaClient["team"]);

    daoTestLifecycle("TEAM");
    afterEach(() => {
        mockClear(prisma);
    });

    expectDaoRequiresPrismaClient(TeamDAO, "TeamDAO");

    describe("getAllTeams", () => {
        it("should return teams ordered by name with owners included", async () => {
            const teams = [makeTeam({ name: "Alpha" }), makeTeam({ name: "Beta" })];
            prisma.findMany.mockResolvedValueOnce(teams as any);

            const result = await dao.getAllTeams();

            expect(prisma.findMany).toHaveBeenCalledWith({
                orderBy: { name: "asc" },
                include: teamInclude,
            });
            expect(result).toHaveLength(2);
        });
    });

    describe("getTeamById", () => {
        it("should find a team by id with owners included", async () => {
            const team = makeTeam();
            prisma.findUniqueOrThrow.mockResolvedValueOnce(team as any);

            const result = await dao.getTeamById(team.id);

            expect(prisma.findUniqueOrThrow).toHaveBeenCalledWith({
                where: { id: team.id },
                include: teamInclude,
            });
            expect(result.id).toBe(team.id);
        });
    });

    describe("createTeam", () => {
        it("should create a team with the provided data and include owners", async () => {
            const team = makeTeam({ name: "New Team", espnId: 5 });
            prisma.create.mockResolvedValueOnce(team as any);

            const result = await dao.createTeam({ name: "New Team", espnId: 5 });

            expect(prisma.create).toHaveBeenCalledWith({
                data: { name: "New Team", espnId: 5, status: TeamStatus.ACTIVE },
                include: teamInclude,
            });
            expect(result.name).toBe("New Team");
        });

        it("should default espnId to null and status to ACTIVE", async () => {
            const team = makeTeam({ name: "Minimal Team", espnId: null });
            prisma.create.mockResolvedValueOnce(team as any);

            await dao.createTeam({ name: "Minimal Team" });

            expect(prisma.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: { name: "Minimal Team", espnId: null, status: TeamStatus.ACTIVE },
                })
            );
        });
    });

    describe("updateTeam", () => {
        it("should update team fields and return team with owners", async () => {
            const team = makeTeam({ name: "Updated" });
            prisma.update.mockResolvedValueOnce(team as any);

            const result = await dao.updateTeam(team.id, { name: "Updated" });

            expect(prisma.update).toHaveBeenCalledWith({
                where: { id: team.id },
                data: { name: "Updated" },
                include: teamInclude,
            });
            expect(result.name).toBe("Updated");
        });

        it("should allow updating status", async () => {
            const team = makeTeam({ status: TeamStatus.DISABLED });
            prisma.update.mockResolvedValueOnce(team as any);

            await dao.updateTeam(team.id, { status: TeamStatus.DISABLED });

            expect(prisma.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: { status: TeamStatus.DISABLED },
                })
            );
        });
    });

    describe("deleteTeam", () => {
        it("should delete team by id and return deleted team with owners", async () => {
            const team = makeTeam();
            prisma.delete.mockResolvedValueOnce(team as any);

            const result = await dao.deleteTeam(team.id);

            expect(prisma.delete).toHaveBeenCalledWith({
                where: { id: team.id },
                include: teamInclude,
            });
            expect(result.id).toBe(team.id);
        });
    });

    describe("searchTeams", () => {
        it("should search by name and owner csvName with correct query structure", async () => {
            const teams = [makeTeam({ name: "Alpha Team" }), makeTeam({ name: "Alpha Wolves" })];
            prisma.findMany.mockResolvedValueOnce(teams as any);

            const result = await dao.searchTeams({ q: "Alpha" });

            expect(prisma.findMany).toHaveBeenCalledWith({
                where: {
                    OR: [
                        { name: { contains: "Alpha", mode: "insensitive" } },
                        { owners: { some: { csvName: { contains: "Alpha", mode: "insensitive" } } } },
                    ],
                },
                orderBy: { name: "asc" },
                include: teamInclude,
            });
            expect(result).toHaveLength(2);
        });

        it("should include id notIn filter when excludeTeamIds is non-empty", async () => {
            const team = makeTeam();
            prisma.findMany.mockResolvedValueOnce([team] as any);
            const excludeIds = ["id-to-exclude-1", "id-to-exclude-2"];

            await dao.searchTeams({ q: "Squad", excludeTeamIds: excludeIds });

            expect(prisma.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        id: { notIn: excludeIds },
                    }),
                })
            );
        });

        it("should NOT include id filter when excludeTeamIds is empty", async () => {
            prisma.findMany.mockResolvedValueOnce([]);

            await dao.searchTeams({ q: "Squad", excludeTeamIds: [] });

            const callArg = prisma.findMany.mock.calls[0][0] as unknown as { where: Record<string, unknown> };
            expect(callArg.where).not.toHaveProperty("id");
        });

        it("should NOT include id filter when excludeTeamIds is omitted", async () => {
            prisma.findMany.mockResolvedValueOnce([]);

            await dao.searchTeams({ q: "Squad" });

            const callArg = prisma.findMany.mock.calls[0][0] as unknown as { where: Record<string, unknown> };
            expect(callArg.where).not.toHaveProperty("id");
        });

        it("should return an empty array when no teams match", async () => {
            prisma.findMany.mockResolvedValueOnce([]);

            const result = await dao.searchTeams({ q: "ZZZNoMatch" });

            expect(result).toEqual([]);
        });
    });
});
