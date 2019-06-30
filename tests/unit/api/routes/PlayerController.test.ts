import "jest";
import "jest-extended";
import { EntityNotFoundError } from "typeorm/error/EntityNotFoundError";
import PlayerController from "../../../../src/api/routes/PlayerController";
import PlayerDAO from "../../../../src/DAO/PlayerDAO";
import Player, { LeagueLevel } from "../../../../src/models/player";

describe("PlayerController", () => {
    const mockPlayerDAO = {
        getAllPlayers: jest.fn(),
        getPlayerById: jest.fn(),
        findPlayers: jest.fn(),
        createPlayer: jest.fn(),
        updatePlayer: jest.fn(),
        deletePlayer: jest.fn(),
    };
    const testPlayer = new Player({id: 1, name: "Honus Wiener", league: LeagueLevel.HIGH});
    const playerController = new PlayerController(mockPlayerDAO as unknown as PlayerDAO);

    afterEach(() => {
        Object.entries(mockPlayerDAO).forEach((kvp: [string, jest.Mock<any, any>]) => {
            kvp[1].mockClear();
        });
    });

    describe("getAllPlayers method", () => {
        it("should return an array of players if no params is passed", async () => {
            mockPlayerDAO.getAllPlayers.mockReturnValueOnce([testPlayer]);
            const res = await playerController.getAllPlayers();

            expect(mockPlayerDAO.findPlayers).toHaveBeenCalledTimes(0);
            expect(mockPlayerDAO.getAllPlayers).toHaveBeenCalledTimes(1);
            expect(mockPlayerDAO.getAllPlayers).toHaveBeenCalledWith();
            expect(res).toEqual([testPlayer]);
        });
        it("should return an array of players if a param is passed and call the find method", async () => {
            mockPlayerDAO.findPlayers.mockReturnValueOnce([testPlayer]);
            const res = await playerController.getAllPlayers(["high", "majors"]);

            expect(mockPlayerDAO.getAllPlayers).toHaveBeenCalledTimes(0);
            expect(mockPlayerDAO.findPlayers).toHaveBeenCalledTimes(1);
            expect(mockPlayerDAO.findPlayers).toHaveBeenCalledWith([
                {league: LeagueLevel.HIGH},
                {league: LeagueLevel.MAJOR}]);
            expect(res).toEqual([testPlayer]);
        });
        it("should bubble up any errors from the DAO", async () => {
            mockPlayerDAO.getAllPlayers.mockImplementation(() => {
                throw new Error("Generic Error");
            });
            await expect(playerController.getAllPlayers())
                .rejects.toThrow(Error);
        });
    });

    describe("getOnePlayer method", () => {
        it("should return a player by id", async () => {
            mockPlayerDAO.getPlayerById.mockReturnValue(testPlayer);
            const res = await playerController.getOnePlayer(testPlayer.id!);

            expect(mockPlayerDAO.getPlayerById).toHaveBeenCalledTimes(1);
            expect(mockPlayerDAO.getPlayerById).toHaveBeenCalledWith(testPlayer.id);
            expect(res).toEqual(testPlayer);
        });
        it("should throw an error if entity is not found in db", async () => {
            mockPlayerDAO.getPlayerById.mockImplementation(() => {
                throw new EntityNotFoundError(Player, "ID not found.");
            });
            await expect(playerController.getOnePlayer(9999))
                .rejects.toThrow(EntityNotFoundError);
        });
    });

    describe("findPlayersByQuery method", () => {
        const query = {mlbTeam: "Boston Red Sox"};
        it("should find players by the given query options", async () => {
            mockPlayerDAO.findPlayers.mockReturnValue([testPlayer]);
            const res = await playerController.findPlayersByQuery(query);

            expect(mockPlayerDAO.findPlayers).toHaveBeenCalledTimes(1);
            expect(mockPlayerDAO.findPlayers).toHaveBeenCalledWith(query);
            expect(res).toEqual([testPlayer]);
        });
        it("should throw an error if entity is not found in db", async () => {
            mockPlayerDAO.findPlayers.mockImplementation(() => {
                throw new EntityNotFoundError(Player, "ID not found.");
            });
            await expect(playerController.findPlayersByQuery(query)).rejects.toThrow(EntityNotFoundError);
        });
    });

    describe("createPlayer method", () => {
        it("should create a player", async () => {
            mockPlayerDAO.createPlayer.mockReturnValue(testPlayer);
            const res = await playerController.createPlayer(testPlayer.parse());

            expect(mockPlayerDAO.createPlayer).toHaveBeenCalledTimes(1);
            expect(mockPlayerDAO.createPlayer).toHaveBeenCalledWith(testPlayer.parse());
            expect(res).toEqual(testPlayer);
        });
        it("should bubble up any errors from the DAO", async () => {
            mockPlayerDAO.createPlayer.mockImplementation(() => {
                throw new Error("Generic Error");
            });
            await expect(playerController.createPlayer(testPlayer.parse()))
                .rejects.toThrow(Error);
        });
    });

    describe("updatePlayer method", () => {
        it("should return updated player with the given id", async () => {
            mockPlayerDAO.updatePlayer.mockReturnValue(testPlayer);
            const res = await playerController.updatePlayer(testPlayer.id!, testPlayer.parse());

            expect(mockPlayerDAO.updatePlayer).toHaveBeenCalledTimes(1);
            expect(mockPlayerDAO.updatePlayer).toHaveBeenCalledWith(testPlayer.id, testPlayer.parse());
            expect(res).toEqual(testPlayer);
        });
        it("should throw an error if entity is not found in db", async () => {
            mockPlayerDAO.updatePlayer.mockImplementation(() => {
                throw new EntityNotFoundError(Player, "ID not found.");
            });
            await expect(playerController.updatePlayer(9999, testPlayer.parse()))
                .rejects.toThrow(EntityNotFoundError);
        });
    });

    describe("deletePlayer method", () => {
        it("should delete a player by id from the db", async () => {
            mockPlayerDAO.deletePlayer.mockReturnValue({raw: [ [], testPlayer.id ]});
            const res = await playerController.deletePlayer(testPlayer.id!);

            expect(mockPlayerDAO.deletePlayer).toHaveBeenCalledTimes(1);
            expect(mockPlayerDAO.deletePlayer).toHaveBeenCalledWith(testPlayer.id);
            expect(res).toEqual({deleteResult: true, id: testPlayer.id});
        });
        it("should throw an error if entity is not found in db", async () => {
            mockPlayerDAO.deletePlayer.mockImplementation(() => {
                throw new EntityNotFoundError(Player, "ID not found.");
            });
            await expect(playerController.deletePlayer(9999))
                .rejects.toThrow(EntityNotFoundError);
        });
    });
});
