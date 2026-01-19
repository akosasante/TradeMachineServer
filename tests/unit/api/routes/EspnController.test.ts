import { MockObj } from "../../DAO/daoHelpers";
import EspnController, { getDefaultEspnYear } from "../../../../src/api/routes/EspnController";
import EspnAPI from "../../../../src/espn/espnApi";
import logger from "../../../../src/bootstrap/logger";
import { EspnFactory } from "../../../factories/EspnFactory";

describe("getDefaultEspnYear", () => {
    it("should return previous year in January", () => {
        const januaryDate = new Date(2026, 0, 15); // January 15, 2026
        expect(getDefaultEspnYear(januaryDate)).toBe(2025);
    });

    it("should return previous year in February", () => {
        const februaryDate = new Date(2026, 1, 15); // February 15, 2026
        expect(getDefaultEspnYear(februaryDate)).toBe(2025);
    });

    it("should return previous year in March", () => {
        const marchDate = new Date(2026, 2, 15); // March 15, 2026
        expect(getDefaultEspnYear(marchDate)).toBe(2025);
    });

    it("should return current year in April", () => {
        const aprilDate = new Date(2026, 3, 15); // April 15, 2026
        expect(getDefaultEspnYear(aprilDate)).toBe(2026);
    });

    it("should return current year in later months", () => {
        const julyDate = new Date(2026, 6, 15); // July 15, 2026
        expect(getDefaultEspnYear(julyDate)).toBe(2026);

        const decemberDate = new Date(2026, 11, 15); // December 15, 2026
        expect(getDefaultEspnYear(decemberDate)).toBe(2026);
    });
});

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
        Object.values(mockEspnApi).forEach(mockFn => mockFn.mockReset());
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
        it("should pass the smart default year if nothing is passed in", async () => {
            const expectedYear = getDefaultEspnYear();
            mockEspnApi.getAllMembers.mockResolvedValueOnce([member]);
            const res = await espnController.getAllEspnMembers();

            expect(mockEspnApi.getAllMembers).toHaveBeenCalledTimes(1);
            expect(mockEspnApi.getAllMembers).toHaveBeenCalledWith(expectedYear);
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
        it("should pass the smart default year if nothing is passed in", async () => {
            const expectedYear = getDefaultEspnYear();
            mockEspnApi.getAllLeagueTeams.mockResolvedValueOnce([team]);
            const res = await espnController.getAllEspnTeams();

            expect(mockEspnApi.getAllLeagueTeams).toHaveBeenCalledTimes(1);
            expect(mockEspnApi.getAllLeagueTeams).toHaveBeenCalledWith(expectedYear);
            expect(res).toEqual([team]);
        });
    });
});
