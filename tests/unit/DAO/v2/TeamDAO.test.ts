import { mockDeep, mockClear } from "jest-mock-extended";
import TeamDAO, { TeamWithOwners } from "../../../../src/DAO/v2/TeamDAO";
import { ExtendedPrismaClient } from "../../../../src/bootstrap/prisma-db";
import logger from "../../../../src/bootstrap/logger";
import { v4 as uuid } from "uuid";
import { TeamStatus } from "@prisma/client";

const makeTeam = (overrides: Record<string, unknown> = {}): TeamWithOwners =>
    ({
        id: uuid(),
        name: "Test Team",
        espnId: 1,
        status: TeamStatus.ACTIVE,
        dateCreated: new Date(),
        dateModified: new Date(),
        owners: [],
        ...overrides,
    } as unknown as TeamWithOwners);

describe("[PRISMA] TeamDAO", () => {
    const prisma = mockDeep<ExtendedPrismaClient["team"]>();
    const dao = new TeamDAO(prisma as unknown as ExtendedPrismaClient["team"]);

    beforeAll(() => {
        logger.debug("~~~~~~PRISMA TEAM DAO TESTS BEGIN~~~~~~");
    });
    afterAll(() => {
        logger.debug("~~~~~~PRISMA TEAM DAO TESTS COMPLETE~~~~~~");
    });
    afterEach(() => {
        mockClear(prisma);
    });

    describe("constructor", () => {
        it("should throw when initialized without a prisma client", () => {
            expect(() => new TeamDAO(undefined)).toThrow(
                "TeamDAO must be initialized with a PrismaClient model instance!"
            );
        });
    });

    describe("getAllTeams", () => {
        it("should return teams ordered by name with owners included", async () => {
            const teams = [makeTeam({ name: "Alpha" }), makeTeam({ name: "Beta" })];
            prisma.findMany.mockResolvedValueOnce(teams as any);

            const result = await dao.getAllTeams();

            expect(prisma.findMany).toHaveBeenCalledWith({
                orderBy: { name: "asc" },
                include: {
                    owners: { select: { id: true, displayName: true, email: true, role: true, status: true } },
                },
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
                include: {
                    owners: { select: { id: true, displayName: true, email: true, role: true, status: true } },
                },
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
                include: {
                    owners: { select: { id: true, displayName: true, email: true, role: true, status: true } },
                },
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
                include: {
                    owners: { select: { id: true, displayName: true, email: true, role: true, status: true } },
                },
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
                include: {
                    owners: { select: { id: true, displayName: true, email: true, role: true, status: true } },
                },
            });
            expect(result.id).toBe(team.id);
        });
    });
});
