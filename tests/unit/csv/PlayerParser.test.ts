import "jest";
import "jest-extended";
import { processMinorLeagueCsv } from "../../../src/csv/PlayerParser";
import PlayerDAO from "../../../src/DAO/PlayerDAO";
import Player from "../../../src/models/player";
import Team from "../../../src/models/team";
import User from "../../../src/models/user";

describe("PlayerParser", () => {
    const testTeam1 = new Team({owners: [new User({shortName: "Akos"}), new User({shortName: "Kwasi"})]});
    const testTeam2 = new Team({owners: [new User({shortName: "Squad"})]});
    const testTeam3 = new Team({owners: [new User({shortName: "Cam"})]});
    const playerKeys = ["name", "mlbTeam", "league", "leagueTeam", "meta"];
    const threeOwnerCsv = `${process.env.BASE_DIR}/tests/resources/three-teams-three-owners-minor-players.csv`;
    const fourOwnerCsv = `${process.env.BASE_DIR}/tests/resources/three-teams-four-owners-minor-players.csv`;
    const invalidPlayersCsv = `${process.env.BASE_DIR}/tests/resources/three-teams-three-owners-invalid-props.csv`;

    const mockDAO = {
        deleteAllPlayers: jest.fn(),
        batchCreatePlayers: jest.fn(),
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
    it("should return ann error if error occurs while deleting existing players", async () => {
        mockDAO.deleteAllPlayers.mockImplementationOnce(() => {
            throw new Error("Error deleting players");
        });
        await expect(processMinorLeagueCsv(threeOwnerCsv, [testTeam1, testTeam2, testTeam3],
            mockDAO as unknown as PlayerDAO, "overwrite")).rejects.toThrow(Error);
        expect(mockDAO.deleteAllPlayers).toHaveBeenCalledTimes(1);
        expect(mockDAO.deleteAllPlayers).toHaveBeenCalledWith("minor");
        expect(mockDAO.batchCreatePlayers).toHaveBeenCalledTimes(0);
    });
    it("should call DAO.batchCreatePlayers", async () => {
        await processMinorLeagueCsv(threeOwnerCsv, [testTeam1, testTeam2, testTeam3], mockDAO as unknown as PlayerDAO);
        expect(mockDAO.deleteAllPlayers).toHaveBeenCalledTimes(0);
        expect(mockDAO.batchCreatePlayers).toHaveBeenCalledTimes(1);
        expect(mockDAO.batchCreatePlayers).toHaveBeenCalledWith(expect.toBeArrayOfSize(99));
        expect(mockDAO.batchCreatePlayers.mock.calls[0][0][0]).toEqual(expect.toContainAllKeys(playerKeys));
    });
    it("should return all the rows from the csv as players", async () => {
        mockDAO.batchCreatePlayers.mockImplementationOnce((arr: Array<Partial<Player>>) =>
            Promise.resolve(arr.map(player => new Player(player))));
        const res = await processMinorLeagueCsv(threeOwnerCsv,
            [testTeam1, testTeam2, testTeam3], mockDAO as unknown as PlayerDAO);
        await expect(res).toBeArrayOfSize(99);
        expect(res[0]).toBeInstanceOf(Player);
        expect(res[0]).toEqual(expect.toContainKeys(playerKeys));
    });
    it("should skip any rows from the csv that don't have a team with that owner in the db", async () => {
        mockDAO.batchCreatePlayers.mockImplementationOnce((arr: Array<Partial<Player>>) =>
            Promise.resolve(arr.map(player => new Player(player))));
        const res = await processMinorLeagueCsv(threeOwnerCsv,
            [testTeam1, testTeam2], mockDAO as unknown as PlayerDAO);
        await expect(res).toBeArrayOfSize(64);
    });
    it("should find owners that aren't the first one in the array", async () => {
        mockDAO.batchCreatePlayers.mockImplementationOnce((arr: Array<Partial<Player>>) =>
            Promise.resolve(arr.map(player => new Player(player))));
        const res = await processMinorLeagueCsv(fourOwnerCsv,
            [testTeam1, testTeam2, testTeam3], mockDAO as unknown as PlayerDAO);
        await expect(res).toBeArrayOfSize(99);
    });
    it("should skip any rows that don't have the required props", async () => {
        mockDAO.batchCreatePlayers.mockImplementationOnce((arr: Array<Partial<Player>>) =>
            Promise.resolve(arr.map(player => new Player(player))));
        const res = await processMinorLeagueCsv(invalidPlayersCsv,
            [testTeam1, testTeam2, testTeam3], mockDAO as unknown as PlayerDAO);
        await expect(res).toBeArrayOfSize(89);
    });
});
