import "jest";
import "jest-extended";
import { NotFoundError } from "routing-controllers";
import { mocked } from "ts-jest/utils";
import EspnController from "../../../../src/api/routes/EspnController";
import EspnAPI from "../../../../src/espn/espnApi";

jest.mock("../../../../src/espn/espnApi");
const mockAPI = mocked(EspnAPI);

describe("EspnController", () => {
    beforeEach(() => {
        mockAPI.mockClear();
    });
    const FFLeagueId = 545;

    it("should create a new ESPNApi instance when constructed with the FF League ID", async () => {
        const _ = new EspnController();
        expect(mockAPI).toHaveBeenCalledTimes(1);
        expect(mockAPI).toHaveBeenCalledWith(FFLeagueId);
    });

    describe("getTeamName method", () => {
        const testTeam = {name: "testTeam"};
        const teamId = 1;
        it("should return the location + nickname of the given team based on id", async () => {
            const loadAndRunSpy = jest.fn().mockImplementation((func: any) => func());
            const getTeamByIdSpy = jest.fn().mockReturnValue(Promise.resolve(testTeam));

            // @ts-ignore
            mockAPI.mockImplementation(() => {
                return {
                    loadAndRun: loadAndRunSpy,
                    getTeamById: getTeamByIdSpy,
                };
            });
            mockAPI.getTeamName.mockReturnValue(testTeam.name);

            const router = new EspnController();
            const res = await router.getTeamName(teamId);

            expect(mockAPI).toHaveBeenCalledTimes(1);
            expect(mockAPI).toHaveBeenCalledWith(FFLeagueId);
            expect(loadAndRunSpy).toHaveBeenCalledTimes(1);
            expect(getTeamByIdSpy).toHaveBeenCalledTimes(1);
            expect(getTeamByIdSpy).toHaveBeenCalledWith(teamId);
            expect(mockAPI.getTeamName).toHaveBeenCalledTimes(1);
            expect(mockAPI.getTeamName).toHaveBeenCalledWith(testTeam);
            expect(res).toEqual(testTeam.name);
        });
        it("should throw a NotFoundError if there is no team with that Id", async () => {
            const loadAndRunSpy = jest.fn().mockImplementation((func: any) => func());
            const getTeamByIdSpy = jest.fn().mockImplementation(() => {
                throw new NotFoundError("Id Not Found.");
            });

            // @ts-ignore
            mockAPI.mockImplementation(() => {
                return {
                    loadAndRun: loadAndRunSpy,
                    getTeamById: getTeamByIdSpy,
                };
            });
            mockAPI.getTeamName.mockClear();

            const router = new EspnController();
            await expect(router.getTeamName(999)).rejects.toThrow(NotFoundError);

            expect(mockAPI).toHaveBeenCalledTimes(1);
            expect(mockAPI).toHaveBeenCalledWith(FFLeagueId);
            expect(loadAndRunSpy).toHaveBeenCalledTimes(1);
            expect(getTeamByIdSpy).toHaveBeenCalledTimes(1);
            expect(getTeamByIdSpy).toHaveBeenCalledWith(999);
            expect(mockAPI.getTeamName).toHaveBeenCalledTimes(0);
        });
    });
});
