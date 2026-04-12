import { mockDeep, mockClear } from "jest-mock-extended";
import PlayerDAO, { PlayerWithTeam } from "../../../../src/DAO/v2/PlayerDAO";
import { ExtendedPrismaClient } from "../../../../src/bootstrap/prisma-db";
import logger from "../../../../src/bootstrap/logger";
import { v4 as uuid } from "uuid";
import { PlayerLeagueLevel } from "@prisma/client";

const makePlayer = (overrides: Record<string, unknown> = {}) =>
    ({
        id: uuid(),
        name: "Mike Trout",
        league: PlayerLeagueLevel.MAJORS,
        mlbTeam: "LAA",
        playerDataId: 12345,
        leagueTeamId: null,
        meta: null,
        dateCreated: new Date(),
        dateModified: new Date(),
        ownerTeam: null,
        ...overrides,
    } as unknown as PlayerWithTeam);

describe("[PRISMA] PlayerDAO", () => {
    const prisma = mockDeep<ExtendedPrismaClient["player"]>();
    const dao = new PlayerDAO(prisma as unknown as ExtendedPrismaClient["player"]);

    beforeAll(() => {
        logger.debug("~~~~~~PRISMA PLAYER DAO TESTS BEGIN~~~~~~");
    });
    afterAll(() => {
        logger.debug("~~~~~~PRISMA PLAYER DAO TESTS COMPLETE~~~~~~");
    });
    afterEach(() => {
        mockClear(prisma);
    });

    describe("constructor", () => {
        it("should throw when initialized without a prisma client", () => {
            expect(() => new PlayerDAO(undefined)).toThrow(
                "PlayerDAO must be initialized with a PrismaClient model instance!"
            );
        });
    });

    describe("getAllPlayers", () => {
        it("should return all players ordered by id", async () => {
            const players = [makePlayer(), makePlayer({ name: "Shohei Ohtani" })];
            prisma.findMany.mockResolvedValueOnce(players as any);

            const result = await dao.getAllPlayers();

            expect(prisma.findMany).toHaveBeenCalledWith({ orderBy: { id: "asc" } });
            expect(result).toHaveLength(2);
        });
    });

    describe("searchPlayers", () => {
        it("should search with no filters and use defaults", async () => {
            prisma.findMany.mockResolvedValueOnce([]);
            prisma.count.mockResolvedValueOnce(0);

            const result = await dao.searchPlayers();

            expect(prisma.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: {},
                    orderBy: { name: "asc" },
                    skip: 0,
                    take: 50,
                    include: { ownerTeam: { select: { id: true, name: true } } },
                })
            );
            expect(prisma.count).toHaveBeenCalledWith({ where: {} });
            expect(result).toEqual({ players: [], total: 0 });
        });

        it("should filter by league when provided", async () => {
            prisma.findMany.mockResolvedValueOnce([]);
            prisma.count.mockResolvedValueOnce(0);

            await dao.searchPlayers({ league: PlayerLeagueLevel.MINORS });

            expect(prisma.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { league: PlayerLeagueLevel.MINORS },
                })
            );
        });

        it("should filter by search name (case-insensitive contains)", async () => {
            prisma.findMany.mockResolvedValueOnce([]);
            prisma.count.mockResolvedValueOnce(0);

            await dao.searchPlayers({ search: "trout" });

            expect(prisma.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { name: { contains: "trout", mode: "insensitive" } },
                })
            );
        });

        it("should combine league and search filters", async () => {
            prisma.findMany.mockResolvedValueOnce([]);
            prisma.count.mockResolvedValueOnce(0);

            await dao.searchPlayers({ search: "ohtani", league: PlayerLeagueLevel.MAJORS });

            expect(prisma.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: {
                        league: PlayerLeagueLevel.MAJORS,
                        name: { contains: "ohtani", mode: "insensitive" },
                    },
                })
            );
        });

        it("should respect skip and take for pagination", async () => {
            const players = [makePlayer()];
            prisma.findMany.mockResolvedValueOnce(players as any);
            prisma.count.mockResolvedValueOnce(100);

            const result = await dao.searchPlayers({ skip: 20, take: 10 });

            expect(prisma.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 20, take: 10 }));
            expect(result).toEqual({ players, total: 100 });
        });
    });

    describe("getPlayerById", () => {
        it("should find a player by id with ownerTeam included", async () => {
            const player = makePlayer();
            prisma.findUniqueOrThrow.mockResolvedValueOnce(player as any);

            const result = await dao.getPlayerById(player.id);

            expect(prisma.findUniqueOrThrow).toHaveBeenCalledWith({
                where: { id: player.id },
                include: { ownerTeam: { select: { id: true, name: true } } },
            });
            expect(result.id).toBe(player.id);
        });
    });

    describe("createPlayer", () => {
        it("should create a player with all fields", async () => {
            const teamId = uuid();
            const player = makePlayer({ leagueTeamId: teamId });
            prisma.create.mockResolvedValueOnce(player as any);

            await dao.createPlayer({
                name: "New Player",
                league: PlayerLeagueLevel.MAJORS,
                mlbTeam: "NYY",
                playerDataId: 999,
                leagueTeamId: teamId,
            });

            expect(prisma.create).toHaveBeenCalledWith({
                data: {
                    name: "New Player",
                    league: PlayerLeagueLevel.MAJORS,
                    mlbTeam: "NYY",
                    playerDataId: 999,
                    leagueTeamId: teamId,
                },
                include: { ownerTeam: { select: { id: true, name: true } } },
            });
        });

        it("should default optional fields to null", async () => {
            const player = makePlayer();
            prisma.create.mockResolvedValueOnce(player as any);

            await dao.createPlayer({ name: "Minimal Player" });

            expect(prisma.create).toHaveBeenCalledWith({
                data: {
                    name: "Minimal Player",
                    league: null,
                    mlbTeam: null,
                    playerDataId: null,
                    leagueTeamId: null,
                },
                include: { ownerTeam: { select: { id: true, name: true } } },
            });
        });
    });

    describe("updatePlayer", () => {
        it("should update player fields and return player with team", async () => {
            const player = makePlayer({ name: "Updated Name" });
            prisma.update.mockResolvedValueOnce(player as any);

            const result = await dao.updatePlayer(player.id, { name: "Updated Name" });

            expect(prisma.update).toHaveBeenCalledWith({
                where: { id: player.id },
                data: { name: "Updated Name" },
                include: { ownerTeam: { select: { id: true, name: true } } },
            });
            expect(result.name).toBe("Updated Name");
        });
    });

    describe("deletePlayer", () => {
        it("should delete player by id", async () => {
            const player = makePlayer();
            prisma.delete.mockResolvedValueOnce(player as any);

            const result = await dao.deletePlayer(player.id);

            expect(prisma.delete).toHaveBeenCalledWith({ where: { id: player.id } });
            expect(result.id).toBe(player.id);
        });
    });

    describe("findPlayers", () => {
        it("should query with AND conditions from parsed params", async () => {
            prisma.findMany.mockResolvedValueOnce([]);

            await dao.findPlayers(["name.Trout", "mlbTeam.LAA"]);

            expect(prisma.findMany).toHaveBeenCalledWith({
                where: {
                    AND: [{ name: "Trout" }, { mlbTeam: "LAA" }],
                },
                orderBy: { id: "asc" },
            });
        });

        it("should normalize league values (MAJOR → MAJORS)", async () => {
            prisma.findMany.mockResolvedValueOnce([]);

            await dao.findPlayers(["league.MAJOR"]);

            expect(prisma.findMany).toHaveBeenCalledWith({
                where: { AND: [{ league: "MAJORS" }] },
                orderBy: { id: "asc" },
            });
        });

        it("should normalize numeric league values (1 → MAJORS, 2 → MINORS)", async () => {
            prisma.findMany.mockResolvedValueOnce([]);
            await dao.findPlayers(["league.1"]);
            expect(prisma.findMany).toHaveBeenCalledWith({
                where: { AND: [{ league: "MAJORS" }] },
                orderBy: { id: "asc" },
            });

            mockClear(prisma);
            prisma.findMany.mockResolvedValueOnce([]);
            await dao.findPlayers(["league.2"]);
            expect(prisma.findMany).toHaveBeenCalledWith({
                where: { AND: [{ league: "MINORS" }] },
                orderBy: { id: "asc" },
            });
        });

        it("should drop meta params from the query", async () => {
            prisma.findMany.mockResolvedValueOnce([]);

            await dao.findPlayers(["meta.something", "name.Trout"]);

            expect(prisma.findMany).toHaveBeenCalledWith({
                where: { AND: [{ name: "Trout" }] },
                orderBy: { id: "asc" },
            });
        });
    });
});
