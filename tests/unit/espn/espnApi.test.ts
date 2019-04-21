import axios, { AxiosPromise } from "axios";
import "jest";
import "jest-extended";
import { NotFoundError } from "routing-controllers";
import { mocked } from "ts-jest/utils";
import EspnAPI from "../../../src/espn/espnApi";

describe("EspnApi Class", () => {
    const mockAxios = mocked(axios);
    const testLeagueId = 545;
    const testMember1 = {id: "some-id", isLeagueManager: true, displayName: "some name"};
    const testTeam1 = {id: 123, abbrev: "AZ", location: "Squirtle", nickname: "Squad", owners: [testMember1.id]};
    const testName = "Team Name";
    const testSettings = {name: testName};

    beforeAll(() => {
        mockAxios.create = jest.fn(() => axios);
        mockAxios.get = jest.fn(() => {
            return Promise.resolve({
                data: {
                    members: [testMember1],
                    teams: [testTeam1],
                    settings: testSettings,
                },
            }) as AxiosPromise;
        });
    });

    it("should construct the API instance and base url with a passed in leagueId", () => {
        const api = new EspnAPI(testLeagueId);
        // tslint:disable-next-line:max-line-length
        expect(api.leagueBaseUrl).toEqual(`http://fantasy.espn.com/apis/v3/games/flb/seasons/2019/segments/0/leagues/${testLeagueId}`);
    });

    it("preloadData - should load the members, teams, leagueName, loaded based on return from axios", async () => {
        const api = new EspnAPI(testLeagueId);
        await api.preloadData();
        expect(api.members).toEqual([testMember1]);
        expect(api.teams).toEqual([testTeam1]);
        expect(api.leagueName).toEqual(testName);
    });

    it("should return a team if it is found in the teams array", async () => {
        const api = new EspnAPI(testLeagueId);
        const getTeam = api.getTeamById.bind(api, testTeam1.id);
        const res = await api.loadAndRun(getTeam);
        expect(res).toEqual(testTeam1);
    });

    it("should throw NotFoundError if a team is not found in the array", async () => {
        const api = new EspnAPI(testLeagueId);
        const getTeam = api.getTeamById.bind(api, 999);
        await expect(api.loadAndRun(getTeam)).rejects.toThrow(NotFoundError);
    });

    it("should return a team name based on the location and nickname", async () => {
        const res = EspnAPI.getTeamName(testTeam1);
        expect(res).toEqual("Squirtle Squad");
    });

    it("should return the owner objects for a team's owners as an array", async () => {
        const api = new EspnAPI(testLeagueId);
        const getOwners = api.getEspnTeamOwners.bind(api, testTeam1);
        const res = await api.loadAndRun(getOwners);
        expect(res).toEqual([testMember1]);
    });

    it("should return an empty array if the team has no owners", async () => {
        const api = new EspnAPI(testLeagueId);
        const testTeamNoOwners = {...testTeam1, owners: []};
        const getOwners = api.getEspnTeamOwners.bind(api, testTeamNoOwners);
        const res = await api.loadAndRun(getOwners);
        expect(res).toEqual([]);
    });

    it("should skip any owners that are not found in the members array", async () => {
        const api = new EspnAPI(testLeagueId);
        const testTeamOtherOwner = {...testTeam1, owners: ["some-other-id"]};
        const getOwners = api.getEspnTeamOwners.bind(api, testTeamOtherOwner);
        const res = await api.loadAndRun(getOwners);
        expect(res).toEqual([]);
    });

    it("should call preload data if not loaded yet and call the function", async () => {
        const api = new EspnAPI(testLeagueId);
        const spy = jest.spyOn(api, "preloadData");

        const getOwners = api.getEspnTeamOwners.bind(api, testTeam1);
        await api.loadAndRun(getOwners);
        expect(spy).toHaveBeenCalledTimes(1);
    });
    //
    it("should not call preload data if it's already loaded, and should call the function", async () => {
        const api = new EspnAPI(testLeagueId);
        await api.preloadData();
        const spy = jest.spyOn(api, "preloadData");

        const getOwners = api.getEspnTeamOwners.bind(api, testTeam1);
        await api.loadAndRun(getOwners);
        expect(spy).toHaveBeenCalledTimes(0);
    });
});
