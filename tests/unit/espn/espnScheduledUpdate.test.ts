import "jest";
import "jest-extended";
import logger from "../../../src/bootstrap/logger";
import { EspnUpdateDaos, updateEspnData } from "../../../src/jobs/espnScheduledUpdate";
import { TeamFactory } from "../../factories/TeamFactory";

const mockPlayerDao = {
    batchUpsertPlayers: jest.fn(),
};

const team = TeamFactory.getTeam();
const espnTeam = {"abbrev": "CCCP", "currentProjectedRank": 0, "divisionId": 1, "draftDayProjectedRank": 0, "id": 1, "isActive": false, "location": "Congo Community", "logo": "https://media.giphy.com/media/Boujd32NBBovTic265/giphy.gif", "nickname": "College Program", "owners": ["{CB3115AD-3035-4BE2-B40B-800517A78C26}"], "primaryOwner": "{CB3115AD-3035-4BE2-B40B-800517A78C26}"};

const mockTeamDao = {
    getAllTeams: jest.fn(() => [team]),
    updateTeam: jest.fn(),
};

const mockEspnApi = {
    getAllMajorLeaguePlayers: jest.fn(() => [
        {"player": {"fullName": "Joe Hudson", "proTeamId": 13}, "id": 2966},
    ]),
    getAllLeagueTeams: jest.fn(() => [espnTeam]),
};

const mockDeps = {
    playerDao: mockPlayerDao,
    teamDao: mockTeamDao,
    espnApi: mockEspnApi,
};


describe("Espn Scheduled Update Jobs", () => {

    beforeAll(() => {
        logger.debug("~~~~~ESPN JOB SCHEDULER TESTS BEGIN~~~~~~");
    });

    afterAll(() => {
        logger.debug("~~~~~~~ESPN JOB SCHEDULER TESTS COMPLETE~~~~~");
    });
    afterEach(() => {
        [mockTeamDao, mockEspnApi, mockPlayerDao].forEach(mockedThing =>
            Object.entries(mockedThing).forEach((kvp: [string, jest.Mock<any, any>]) => {
                kvp[1].mockClear();
            }));
    });

    test("updateEspnData - should call the correct DAO methods to update ESPN data", async () => {
        await updateEspnData(mockDeps as unknown as EspnUpdateDaos);

        expect(mockEspnApi.getAllMajorLeaguePlayers).toHaveBeenCalledTimes(1);
        expect(mockEspnApi.getAllMajorLeaguePlayers).toHaveBeenCalledWith(new Date().getFullYear());

        expect(mockEspnApi.getAllLeagueTeams).toHaveBeenCalledTimes(1);
        expect(mockEspnApi.getAllLeagueTeams).toHaveBeenCalledWith(new Date().getFullYear());
        expect(mockTeamDao.getAllTeams).toHaveBeenCalledTimes(1);
        expect(mockTeamDao.getAllTeams).toHaveBeenCalledWith();
        expect(mockTeamDao.updateTeam).toHaveBeenCalledTimes(1);
        expect(mockTeamDao.updateTeam).toHaveBeenCalledWith(team.id, { espnTeam });
    });

    test("updateEspnData - should, if no matching espnId is found, keep the existing espnTeam, and not update", async () => {
        mockTeamDao.getAllTeams.mockImplementationOnce(() => {
            return [TeamFactory.getTeam(undefined, 200)];
        });
        await updateEspnData(mockDeps as unknown as EspnUpdateDaos);

        expect(mockEspnApi.getAllMajorLeaguePlayers).toHaveBeenCalledTimes(1);
        expect(mockEspnApi.getAllMajorLeaguePlayers).toHaveBeenCalledWith(new Date().getFullYear());

        expect(mockEspnApi.getAllLeagueTeams).toHaveBeenCalledTimes(1);
        expect(mockEspnApi.getAllLeagueTeams).toHaveBeenCalledWith(new Date().getFullYear());
        expect(mockTeamDao.getAllTeams).toHaveBeenCalledTimes(1);
        expect(mockTeamDao.getAllTeams).toHaveBeenCalledWith();
        expect(mockTeamDao.updateTeam).toHaveBeenCalledTimes(0);
    });
});
