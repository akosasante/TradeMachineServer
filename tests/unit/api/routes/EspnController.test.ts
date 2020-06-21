import "jest";
import "jest-extended";
import { MockObj } from "../../DAO/daoHelpers";
import EspnController from "../../../../src/api/routes/EspnController";
import EspnAPI from "../../../../src/espn/espnApi";
import logger from "../../../../src/bootstrap/logger";
import { EspnFactory } from "../../../factories/EspnFactory";

describe("EspnController", () => {
    const mockEspnApi: MockObj = {
        getAllMembers: jest.fn(),
        getAllLeagueTeams: jest.fn(),
    };
    const espnController = new EspnController(mockEspnApi as unknown as EspnAPI);
    const member = EspnFactory.getMember();
    const team = EspnFactory.getTeam();

    beforeAll(() => {
        logger.debug("~~~~~~ESPN CONTROLLER TESTS BEGIN~~~~~~");
    });
    afterAll(() => {
        logger.debug("~~~~~~ESPN CONTROLLER TESTS COMPLETE~~~~~~");
    });
    afterEach(() => {
        Object.values(mockEspnApi).forEach(mockFn =>  mockFn.mockReset());
    });

    describe("getAllEspnMembers method", () => {
        it("should return an array of ESPN members", async () => {
            const year = 2018;
            mockEspnApi.getAllMembers.mockResolvedValueOnce([member]);
            const res = await espnController.getAllEspnMembers(year);

            expect(mockEspnApi.getAllMembers).toHaveBeenCalledTimes(1);
            expect(mockEspnApi.getAllMembers).toHaveBeenCalledWith(year);
            expect(res).toEqual([member]);
        });
        it("should pass the current year by default if nothing is passed in", async () => {
            const currentYear = new Date().getFullYear();
            mockEspnApi.getAllMembers.mockResolvedValueOnce([member]);
            const res = await espnController.getAllEspnMembers();

            expect(mockEspnApi.getAllMembers).toHaveBeenCalledTimes(1);
            expect(mockEspnApi.getAllMembers).toHaveBeenCalledWith(currentYear);
            expect(res).toEqual([member]);
        });
    });

    describe("getAllEspnTeams method", () => {
        it("should return an array of ESPN teams", async () => {
            const year = 2018;
            mockEspnApi.getAllLeagueTeams.mockResolvedValueOnce([team]);
            const res = await espnController.getAllEspnTeams(year);

            expect(mockEspnApi.getAllLeagueTeams).toHaveBeenCalledTimes(1);
            expect(mockEspnApi.getAllLeagueTeams).toHaveBeenCalledWith(year);
            expect(res).toEqual([team]);
        });
        it("should pass the current year by default if nothing is passed in", async () => {
            const currentYear = new Date().getFullYear();
            mockEspnApi.getAllLeagueTeams.mockResolvedValueOnce([team]);
            const res = await espnController.getAllEspnTeams();

            expect(mockEspnApi.getAllLeagueTeams).toHaveBeenCalledTimes(1);
            expect(mockEspnApi.getAllLeagueTeams).toHaveBeenCalledWith(currentYear);
            expect(res).toEqual([team]);
        });
    });
});
