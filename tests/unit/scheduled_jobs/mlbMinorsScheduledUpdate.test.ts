import "jest";
import "jest-extended";
import logger from "../../../src/bootstrap/logger";
import { doUpdate } from "../../../src/scheduled_jobs/mlbMinorsScheduledUpdate";
import PlayerDAO from "../../../src/DAO/PlayerDAO";
import { AxiosPromise } from "axios";


const mockedGet = jest.fn().mockResolvedValue(
    {data: {ops_team_players: {queryResults: {row: []}}}}
);
const mockPlayerDao = {
    getAllPlayers: jest.fn(),
    batchUpsertPlayers: jest.fn().mockResolvedValue([]),
} as unknown as PlayerDAO;

jest.mock("axios", () => ({
    create: jest.fn(() => ({
        get: mockedGet,
    })),
}) as unknown as AxiosPromise);


beforeAll(() => {
    logger.debug("~~~~~MINOR LEAGUE PLAYER UPDATER JOB SCHEDULER TESTS BEGIN~~~~~~");
});

afterAll(() => {
    logger.debug("~~~~~~~MINOR LEAGUE PLAYER UPDATE JOB SCHEDULER TESTS COMPLETE~~~~~");
});

describe("Minor League Scheduled Jobs", () => {
    test("doUpdate/1 - should make an axios call and then insert into the db", async () => {
        await doUpdate(mockPlayerDao);
        expect(mockedGet).toBeCalledTimes(3); // once for each league level
        expect(mockPlayerDao.getAllPlayers).toBeCalledTimes(1);
        expect(mockPlayerDao.batchUpsertPlayers).toBeCalledTimes(1);
    });
});