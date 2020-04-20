import axios, { AxiosPromise, AxiosInstance } from "axios";
import "jest";
import "jest-extended";
import { mocked } from "ts-jest/utils";
import EspnAPI from "../../../src/espn/espnApi";
import allDataJson from "../../resources/espn-general-resp.json";
import membersJson from "../../resources/espn-members-resp.json";
import teamsJson from "../../resources/espn-teams-resp.json";
import playersJson from "../../resources/espn-all-players.json";
import scheduleJson from "../../resources/espn-schedule.json";
import rosterJson from "../../resources/espn-roster.json";
let mockedGet = jest.fn();
jest.mock("axios", () => ({
    create: jest.fn(() => ({
        get: mockedGet,
    })),
}) as unknown as AxiosPromise);

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
        mockedGet.mockResolvedValueOnce({data: playersJson} as unknown as AxiosPromise);
        const res = await Api.getAllMajorLeaguePlayers(2019);
        expect(res).toEqual(playersJson.players);
    });

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
});
