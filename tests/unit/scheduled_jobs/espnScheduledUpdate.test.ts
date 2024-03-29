import logger from "../../../src/bootstrap/logger";
import TeamDAO from "../../../src/DAO/TeamDAO";
import PlayerDAO from "../../../src/DAO/PlayerDAO";
import EspnAPI from "../../../src/espn/espnApi";
import { EspnUpdateDaos, updateEspnData } from "../../../src/scheduled_jobs/espnScheduledUpdate";

const mockPlayerDao = {} as unknown as PlayerDAO;
const mockTeamDao = {} as unknown as TeamDAO;
const mockEspnApi = {
    updateEspnTeamInfo: jest.fn(),
    updateMajorLeaguePlayers: jest.fn(),
} as unknown as EspnAPI;
const mockDeps = {
    playerDao: mockPlayerDao,
    teamDao: mockTeamDao,
    espnApi: mockEspnApi,
} as unknown as EspnUpdateDaos;

describe("Espn Scheduled Update Jobs", () => {
    beforeAll(() => {
        logger.debug("~~~~~ESPN JOB SCHEDULER TESTS BEGIN~~~~~~");
    });

    afterAll(() => {
        logger.debug("~~~~~~~ESPN JOB SCHEDULER TESTS COMPLETE~~~~~");
    });
    afterEach(() => {
        [mockTeamDao, mockEspnApi, mockPlayerDao].forEach(mockedThing =>
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-return
            Object.values(mockedThing).forEach(mockFn => mockFn.mockReset())
        );
    });

    test("updateEspnData - should call the correct DAO methods to update ESPN data", async () => {
        const currentYear = new Date().getFullYear();
        await updateEspnData(mockDeps);

        expect(mockEspnApi.updateEspnTeamInfo).toHaveBeenCalledTimes(1);
        expect(mockEspnApi.updateMajorLeaguePlayers).toHaveBeenCalledTimes(1);
        expect(mockEspnApi.updateEspnTeamInfo).toHaveBeenCalledWith(currentYear, mockTeamDao);
        expect(mockEspnApi.updateMajorLeaguePlayers).toHaveBeenCalledWith(currentYear, mockPlayerDao, mockTeamDao);
    });
});
