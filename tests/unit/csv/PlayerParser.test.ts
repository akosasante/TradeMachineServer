import "jest";
import "jest-extended";
import { processMinorLeagueCsv } from "../../../src/csv/PlayerParser";
import PlayerDAO from "../../../src/DAO/PlayerDAO";
import Player from "../../../src/models/player";
import { TeamFactory } from "../../factories/TeamFactory";
import { config as dotenvConfig } from "dotenv";
import { resolve as resolvePath } from "path";
import { UserFactory } from "../../factories/UserFactory";
import {PlayerFactory} from "../../factories/PlayerFactory";
import logger from "../../../src/bootstrap/logger";
import {inspect} from "util";

dotenvConfig({path: resolvePath(__dirname, "../../.env")});

describe("PlayerParser", () => {
    const owner1 = UserFactory.getUser(undefined, undefined, undefined, undefined, {csvName: "Akos"});
    const owner2 = UserFactory.getUser(undefined, undefined, undefined, undefined, {csvName: "Squad"});
    const owner3 = UserFactory.getUser(undefined, undefined, undefined, undefined, {csvName: "Cam"});
    const owner4 = UserFactory.getUser(undefined, undefined, undefined, undefined, {csvName: "Kwasi"});
    const testTeam1 = TeamFactory.getTeam(undefined, undefined,
        {owners: [owner1]});
    const testTeam2 = TeamFactory.getTeam(undefined, undefined,
        {owners: [owner2]});
    const testTeam3 = TeamFactory.getTeam(undefined, undefined,
        {owners: [owner3, owner4]});

    const playerKeys = ["name", "mlbTeam", "league", "leagueTeam", "meta", "playerDataId"];
    const playerPredicate = (player: Player) => Object.keys(player).every(k => playerKeys.includes(k));

    const threeOwnerCsv = `${process.env.BASE_DIR}/tests/resources/three-teams-three-owners-minor-players.csv`;
    const fourOwnerCsv = `${process.env.BASE_DIR}/tests/resources/three-teams-four-owners-minor-players.csv`;
    const invalidPlayersCsv = `${process.env.BASE_DIR}/tests/resources/three-teams-three-owners-invalid-props.csv`;
    const dupedPlayersCsv = `${process.env.BASE_DIR}/tests/resources/three-teams-three-owners-minor-players-with-dupes.csv`;

    const mockDAO = {
        getAllPlayers: jest.fn().mockResolvedValue([]),
        deleteAllPlayers: jest.fn(),
        batchUpsertPlayers: jest.fn().mockImplementation((arr: Partial<Player>[]) =>
            Promise.resolve(arr.map(player => new Player(player as Player)))),
    };

    afterEach(() => {
        Object.entries(mockDAO).forEach((kvp: [string, jest.Mock<any, any>]) => {
            kvp[1].mockClear();
        });
    });

    it("should not call deleteAllPlayers if mode is undefined", async () => {
        await processMinorLeagueCsv(threeOwnerCsv, [testTeam1, testTeam2, testTeam3], mockDAO as unknown as PlayerDAO);
        expect(mockDAO.deleteAllPlayers).toHaveBeenCalledTimes(0);
    });
    it("should not call deleteAllPlayers if mode is append", async () => {
        await processMinorLeagueCsv(threeOwnerCsv, [testTeam1, testTeam2, testTeam3],
            mockDAO as unknown as PlayerDAO, "append");
        expect(mockDAO.deleteAllPlayers).toHaveBeenCalledTimes(0);
    });
    it("should call deleteAllPlayers if mode is overwrite", async () => {
        await processMinorLeagueCsv(threeOwnerCsv, [testTeam1, testTeam2, testTeam3],
            mockDAO as unknown as PlayerDAO, "overwrite");
        expect(mockDAO.deleteAllPlayers).toHaveBeenCalledTimes(1);
        expect(mockDAO.deleteAllPlayers).toHaveBeenCalledWith("minor");
    });

    it("should return an error if error occurs while deleting existing players", async () => {
        mockDAO.deleteAllPlayers.mockImplementationOnce(() => {
            throw new Error("Error deleting players");
        });
        await expect(processMinorLeagueCsv(threeOwnerCsv, [testTeam1, testTeam2, testTeam3],
            mockDAO as unknown as PlayerDAO, "overwrite")).rejects.toThrow(Error);
        expect(mockDAO.deleteAllPlayers).toHaveBeenCalledTimes(1);
        expect(mockDAO.deleteAllPlayers).toHaveBeenCalledWith("minor");
        expect(mockDAO.batchUpsertPlayers).toHaveBeenCalledTimes(0);
    });

    it("should call DAO.batchUpsertPlayers", async () => {
        await processMinorLeagueCsv(threeOwnerCsv, [testTeam1, testTeam2, testTeam3], mockDAO as unknown as PlayerDAO);
        expect(mockDAO.deleteAllPlayers).toHaveBeenCalledTimes(0);
        expect(mockDAO.batchUpsertPlayers).toHaveBeenCalledTimes(1);
        expect(mockDAO.batchUpsertPlayers).toHaveBeenCalledWith(expect.toBeArrayOfSize(99));
        expect(mockDAO.batchUpsertPlayers.mock.calls[0][0]).toSatisfyAll(playerPredicate);
    });
    it("should return all the rows from the csv as players", async () => {
        const res = await processMinorLeagueCsv(threeOwnerCsv,
            [testTeam1, testTeam2, testTeam3], mockDAO as unknown as PlayerDAO);
        expect(res).toBeArrayOfSize(99);
        expect(res).toSatisfyAll(player => player instanceof Player);
        expect(res).toSatisfyAll(playerPredicate);
    });

    it("should skip any rows from the csv that don't have a team with that owner in the db", async () => {
        const res = await processMinorLeagueCsv(threeOwnerCsv,
            [testTeam1, testTeam2], mockDAO as unknown as PlayerDAO);
        expect(res).toBeArrayOfSize(64);
    });
    it("should find owners that aren't the first one in the array", async () => {
        const res = await processMinorLeagueCsv(fourOwnerCsv,
            [testTeam1, testTeam2, testTeam3], mockDAO as unknown as PlayerDAO);
        expect(res).toBeArrayOfSize(99);
    });
    it("should skip any rows that don't have the required props", async () => {
        const res = await processMinorLeagueCsv(invalidPlayersCsv,
            [testTeam1, testTeam2, testTeam3], mockDAO as unknown as PlayerDAO);
        expect(res).toBeArrayOfSize(89);
    });

    it("should filter out duplicate players - players with the same name and team", async () => {
        const res = await processMinorLeagueCsv(dupedPlayersCsv,
            [testTeam1, testTeam2, testTeam3], mockDAO as unknown as PlayerDAO);
        expect(res).toBeArrayOfSize(9);
    });
    it("should add the playerDataId to players that we've previously added to the database so that we can dedupe at the db level", async () => {
        const existingPlayer = PlayerFactory.getPlayer("Josh Naylor");
        existingPlayer.playerDataId = 1234;
        mockDAO.getAllPlayers.mockResolvedValueOnce([existingPlayer]);

        const res = await processMinorLeagueCsv(dupedPlayersCsv,
            [testTeam1, testTeam2, testTeam3], mockDAO as unknown as PlayerDAO);
        expect(res).toBeArrayOfSize(9);
        expect(res.find(p => p.name === "Josh Naylor")).toBeDefined();
        expect(res.find(p => p.name === "Josh Naylor")?.playerDataId).toBeDefined();
        expect(res.find(p => p.name === "Josh Naylor")?.playerDataId).toEqual(existingPlayer.playerDataId);
    });
});
