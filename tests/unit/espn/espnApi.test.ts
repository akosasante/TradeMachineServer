import axios, { AxiosPromise } from "axios";
import EspnAPI from "../../../src/espn/espnApi";
import allDataJson from "../../resources/espn-general-resp.json";
import membersJson from "../../resources/espn-members-resp.json";
import teamsJson from "../../resources/espn-teams-resp.json";
import playersJson from "../../resources/espn-all-players.json";
import scheduleJson from "../../resources/espn-schedule.json";
import rosterJson from "../../resources/espn-roster.json";
import { TeamFactory } from "../../factories/TeamFactory";
import PlayerDAO from "../../../src/DAO/PlayerDAO";
import TeamDAO from "../../../src/DAO/TeamDAO";
import Team from "../../../src/models/team";
import logger from "../../../src/bootstrap/logger";

const mockedGet = jest.fn();
const headers = {
    "x-fantasy-filter-player-count": 1,
};

jest.mock("axios", () => ({
    create: jest.fn(() => ({
        get: mockedGet,
    })),
}) as unknown as AxiosPromise);

const team = TeamFactory.getTeam();

const mockTeamDao = {
    getAllTeams: jest.fn(() => [team]),
    updateTeam: jest.fn(),
    findTeams: jest.fn(),
};

const mockPlayerDao = {
    batchUpsertPlayers: jest.fn(),
};

beforeAll(() => {
    logger.debug("~~~~~ESPN API TESTS BEGIN~~~~~~");
});

afterAll(() => {
    logger.debug("~~~~~~~ESPN API TESTS COMPLETE~~~~~");
});
describe("EspnApi Class", () => {
    const testLeagueId = 545;
    const Api = new EspnAPI(testLeagueId);

    it("getAllLeagueData/1 - should return general league data", async () => {
        mockedGet.mockResolvedValueOnce({data: allDataJson} as unknown as AxiosPromise);
        const res = await Api.getAllLeagueData(2019);
        expect(res).toEqual(allDataJson);
    });

    it("getAllMembers/1 - should return league member data", async () => {
        mockedGet.mockResolvedValueOnce({data: membersJson} as unknown as AxiosPromise);
        const res = await Api.getAllMembers(2019);
        expect(res).toEqual(membersJson);
    });

    it("getAllLeagueTeams/1 - should return league member data", async () => {
        mockedGet.mockResolvedValueOnce({data: teamsJson} as unknown as AxiosPromise);
        const res = await Api.getAllLeagueTeams(2019);
        expect(res).toEqual(teamsJson);
    });

    it("getAllMajorLeaguePlayers/1 - should return league member data", async () => {
        mockedGet.mockResolvedValueOnce({data: playersJson, headers} as unknown as AxiosPromise);
        const res = await Api.getAllMajorLeaguePlayers(2019);
        expect(res).toEqual(playersJson.players);
    }, 6000);

    it("getScheduleForYear/1 - should return league member data", async () => {
        mockedGet.mockResolvedValueOnce({data: scheduleJson} as unknown as AxiosPromise);
        const res = await Api.getScheduleForYear(2019);
        expect(res).toEqual(scheduleJson);
    });

    it("getRosterForTeamAndDay/1 - should return league member data", async () => {
        mockedGet.mockResolvedValueOnce({data: rosterJson} as unknown as AxiosPromise);
        const res = await Api.getRosterForTeamAndDay(2019, 2, 0);
        expect(res).toEqual(rosterJson.teams[0].roster);
    });

    it("updateMajorLeaguePlayers/2 - should prepare and perform a batch upsert of major league players", async () => {
        mockedGet.mockResolvedValueOnce({data: playersJson, headers} as unknown as AxiosPromise);
        const fakeTeamsWithIds = Array.from(Array(10).keys()).map(espnId => new Team({
            name: "Fake Team",
            espnId: espnId + 1,
        }));
        mockTeamDao.findTeams.mockReturnValueOnce(fakeTeamsWithIds);
        await Api.updateMajorLeaguePlayers(2019, mockPlayerDao as unknown as PlayerDAO, mockTeamDao as unknown as TeamDAO);

        expect(mockPlayerDao.batchUpsertPlayers).toBeCalledTimes(1);
        expect(mockPlayerDao.batchUpsertPlayers).toBeCalledWith(expect.toBeArrayOfSize(4));
    }, 6000);

    it("updateEspnTeamInfo/2 - should prepare and perform many updates of espn league teams", async () => {
        mockedGet.mockResolvedValueOnce({data: teamsJson} as unknown as AxiosPromise);
        const fakeTeamsWithIds = Array.from(Array(10).keys()).map(espnId => new Team({
            name: "Fake Team",
            espnId: espnId + 1,
        }));
        mockTeamDao.getAllTeams.mockReturnValueOnce(fakeTeamsWithIds);
        await Api.updateEspnTeamInfo(2019, mockTeamDao as unknown as TeamDAO);

        expect(mockTeamDao.getAllTeams).toBeCalledTimes(1);
        expect(mockTeamDao.updateTeam).toBeCalledTimes(10);
    });
});
