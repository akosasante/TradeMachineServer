import "jest";
import "jest-extended";
import { mocked } from "ts-jest/utils";
import { EntityNotFoundError } from "typeorm/error/EntityNotFoundError";
import PlayerController from "../../../../src/api/routes/PlayerController";
import { processMinorLeagueCsv } from "../../../../src/csv/PlayerParser";
import PlayerDAO from "../../../../src/DAO/PlayerDAO";
import TeamDAO from "../../../../src/DAO/TeamDAO";
import Player, { PlayerLeagueType } from "../../../../src/models/player";
import { PlayerFactory } from "../../../factories/PlayerFactory";
import { TeamFactory } from "../../../factories/TeamFactory";
import logger from "../../../../src/bootstrap/logger";
import { v4 as uuid } from "uuid";

jest.mock("../../../../src/csv/PlayerParser");
const mockedCsvParser = mocked(processMinorLeagueCsv);

describe("PlayerController", () => {
    const mockPlayerDAO = {
        getAllPlayers: jest.fn(),
        getPlayerById: jest.fn(),
        findPlayers: jest.fn(),
        createPlayers: jest.fn(),
        updatePlayer: jest.fn(),
        deletePlayer: jest.fn(),
    };
    const mockTeamDAO = {
        getAllTeams: jest.fn(),
    };

    const testPlayer = PlayerFactory.getPlayer();
    const playerController = new PlayerController(mockPlayerDAO as unknown as PlayerDAO,
        mockTeamDAO as unknown as TeamDAO);

    beforeAll(() => {
        logger.debug("~~~~~~PLAYER CONTROLLER TESTS BEGIN~~~~~~");
    });
    afterAll(() => {
        logger.debug("~~~~~~PLAYER CONTROLLER TESTS COMPLETE~~~~~~");
    });
    afterEach(() => {
        [mockPlayerDAO, mockTeamDAO].forEach(mockedThing =>
            Object.entries(mockedThing).forEach((kvp: [string, jest.Mock<any, any>]) => {
                kvp[1].mockClear();
            }));
        mockedCsvParser.mockClear();
    });

    describe("getAllPlayers method", () => {
        it("should return an array of players if no params is passed", async () => {
            mockPlayerDAO.getAllPlayers.mockResolvedValueOnce([testPlayer]);
            const res = await playerController.getAllPlayers();

            expect(mockPlayerDAO.findPlayers).toHaveBeenCalledTimes(0);
            expect(mockPlayerDAO.getAllPlayers).toHaveBeenCalledTimes(1);
            expect(mockPlayerDAO.getAllPlayers).toHaveBeenCalledWith();
            expect(res).toEqual([testPlayer]);
        });
        it("should return an array of players if a param is passed and call the find method", async () => {
            mockPlayerDAO.findPlayers.mockResolvedValueOnce([testPlayer]);
            const res = await playerController.getAllPlayers(["minors", "majors"]);

            expect(mockPlayerDAO.getAllPlayers).toHaveBeenCalledTimes(0);
            expect(mockPlayerDAO.findPlayers).toHaveBeenCalledTimes(1);
            expect(mockPlayerDAO.findPlayers).toHaveBeenCalledWith([
                {league: PlayerLeagueType.MINOR},
                {league: PlayerLeagueType.MAJOR}]);
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
            await expect(playerController.getOnePlayer(uuid()))
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

    describe("createPlayers method", () => {
        it("should create a player", async () => {
            mockPlayerDAO.createPlayers.mockReturnValue(testPlayer);
            const res = await playerController.createPlayers([testPlayer.parse()]);

            expect(mockPlayerDAO.createPlayers).toHaveBeenCalledTimes(1);
            expect(mockPlayerDAO.createPlayers).toHaveBeenCalledWith([testPlayer.parse()]);
            expect(res).toEqual(testPlayer);
        });
        it("should bubble up any errors from the DAO", async () => {
            mockPlayerDAO.createPlayers.mockImplementation(() => {
                throw new Error("Generic Error");
            });
            await expect(playerController.createPlayers([testPlayer.parse()]))
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
            await expect(playerController.updatePlayer(uuid(), testPlayer.parse()))
                .rejects.toThrow(EntityNotFoundError);
        });
    });

    describe("deletePlayer method", () => {
        it("should delete a player by id from the db", async () => {
            mockPlayerDAO.deletePlayer.mockReturnValue({raw: [ {id: testPlayer.id} ], affected: 1});
            const res = await playerController.deletePlayer(testPlayer.id!);

            expect(mockPlayerDAO.deletePlayer).toHaveBeenCalledTimes(1);
            expect(mockPlayerDAO.deletePlayer).toHaveBeenCalledWith(testPlayer.id);
            expect(res).toEqual({deleteCount: 1, id: testPlayer.id});
        });
        it("should throw an error if entity is not found in db", async () => {
            mockPlayerDAO.deletePlayer.mockImplementation(() => {
                throw new EntityNotFoundError(Player, "ID not found.");
            });
            await expect(playerController.deletePlayer(uuid()))
                .rejects.toThrow(EntityNotFoundError);
        });
    });

    describe("batchUploadMinorLeaguePlayers method", () => {
        const overwriteMode = "overwrite";
        const testFile = {path: "/test/path/to.csv"};

        it("should get all existing teams from the db", async () => {
            await playerController.batchUploadMinorLeaguePlayers(testFile, overwriteMode);
            expect(mockTeamDAO.getAllTeams).toHaveBeenCalledTimes(1);
            expect(mockTeamDAO.getAllTeams).toHaveBeenCalledWith();
        });
        it("should call the minor league player processor method", async () => {
            const teams = [TeamFactory.getTeam()];
            mockTeamDAO.getAllTeams.mockResolvedValueOnce(teams);
            mockedCsvParser.mockResolvedValueOnce([testPlayer]);

            const res = await playerController.batchUploadMinorLeaguePlayers(testFile, overwriteMode);

            expect(mockedCsvParser).toHaveBeenCalledTimes(1);
            expect(mockedCsvParser).toHaveBeenCalledWith(testFile.path, teams, mockPlayerDAO, overwriteMode);
            expect(res).toEqual([testPlayer]);
        });
        it("should reject if teamDAO throws an error", async () => {
            mockTeamDAO.getAllTeams.mockImplementationOnce(() => {
                throw new Error();
            });
            await expect(playerController.batchUploadMinorLeaguePlayers(testFile, overwriteMode))
                .rejects.toThrow(Error);
        });
        it("should reject if processMinorLeagueCsv throws an error", async () => {
            mockedCsvParser.mockImplementationOnce(() => {
                throw new Error();
            });
            await expect(playerController.batchUploadMinorLeaguePlayers(testFile, overwriteMode))
                .rejects.toThrow(Error);
        });
    });
});
