import { PrismaClient, Player } from "@prisma/client";
import { PlayerFactory } from "../../../factories/PlayerFactory";
import { mockDeep, mockClear } from "jest-mock-extended";
import PlayerDAO from "../../../../src/DAO/v2/PlayerDAO";
import logger from "../../../../src/bootstrap/logger";

describe("[PRISMA] PlayerDAO", () => {
    const testPlayer: Player = PlayerFactory.getPrismaPlayer();
    const prisma = mockDeep<PrismaClient["player"]>();
    const Players: PlayerDAO = new PlayerDAO(prisma);

    afterEach(() => {
        mockClear(prisma);
    });

    beforeAll(() => {
        logger.debug("~~~~~~PRISMA PLAYER DAO TESTS BEGIN~~~~~~");
    });
    afterAll(() => {
        logger.debug("~~~~~~PRISMA PLAYER DAO TESTS COMPLETE~~~~~~");
    });

    describe("getAllPlayers", () => {
        it("should return an array of players by calling the db", async () => {
            prisma.findMany.mockResolvedValueOnce([testPlayer]);
            const sortOptions = { orderBy: { id: "asc" } };

            const res = await Players.getAllPlayers();

            expect(prisma.findMany).toHaveBeenCalledTimes(1);
            expect(prisma.findMany).toHaveBeenCalledWith(sortOptions);
            expect(res).toEqual([testPlayer]);
        });
    });

    describe("findPlayers", () => {
        it("should return an array of players matching the given filter using a Where AND query", async () => {
            prisma.findMany.mockResolvedValueOnce([testPlayer]);
            const sortOptions = { orderBy: { id: "asc" } };
            const expectedWhere = { where: { AND: [{ mlbTeam: "LAD" }] } };
            const inputParam = ["mlbTeam.LAD"];

            const res = await Players.findPlayers(inputParam);

            expect(prisma.findMany).toHaveBeenCalledTimes(1);
            expect(prisma.findMany).toHaveBeenCalledWith({ ...sortOptions, ...expectedWhere });
            expect(res).toEqual([testPlayer]);
        });

        it("should return pass in an array of WHERE AND objects if multiple input params are given", async () => {
            prisma.findMany.mockResolvedValueOnce([testPlayer]);
            const sortOptions = { orderBy: { id: "asc" } };
            const expectedWhere = { where: { AND: [{ mlbTeam: "LAD"}, {name: "Joseph" }] } };
            const inputParam = ["mlbTeam.LAD", "name.Joseph"];

            const res = await Players.findPlayers(inputParam);

            expect(prisma.findMany).toHaveBeenCalledTimes(1);
            expect(prisma.findMany).toHaveBeenCalledWith({ ...sortOptions, ...expectedWhere });
            expect(res).toEqual([testPlayer]);
        });
    });
});
