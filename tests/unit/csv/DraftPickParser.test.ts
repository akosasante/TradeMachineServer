import "jest";
import "jest-extended";
import { processDraftPickCsv } from "../../../src/csv/DraftPickParser";
import DraftPickDAO from "../../../src/DAO/DraftPickDAO";
import DraftPick from "../../../src/models/draftPick";
import { TeamFactory } from "../../factories/TeamFactory";
import { UserFactory } from "../../factories/UserFactory";
import { config as dotenvConfig } from "dotenv";
import { resolve as resolvePath } from "path";
import logger from "../../../src/bootstrap/logger";
import {inspect} from "util";

dotenvConfig({path: resolvePath(__dirname, "../../.env")});

describe("DraftPickParser", () => {
    logger.debug(inspect(process.env.BASE_DIR));
    const owner1 = UserFactory.getUser(undefined, undefined, undefined, undefined, {csvName: "Akos"});
    const owner2 = UserFactory.getUser(undefined, undefined, undefined, undefined, {csvName: "Kwasi"});
    const owner3 = UserFactory.getUser(undefined, undefined, undefined, undefined, {csvName: "Cam"});
    const owner4 = UserFactory.getUser(undefined, undefined, undefined, undefined, {csvName: "Jatheesh"});
    const testTeam1 = TeamFactory.getTeam(undefined, undefined,
        {owners: [owner1]});
    const testTeam2 = TeamFactory.getTeam(undefined, undefined,
        {owners: [owner2]});
    const testTeam3 = TeamFactory.getTeam(undefined, undefined,
        {owners: [owner3, owner4]});

    const mockDAO = {
        deleteAllPicks: jest.fn(),
        batchCreatePicks: jest.fn(),
    };

    afterEach(() => {
        Object.entries(mockDAO).forEach((kvp: [string, jest.Mock<any, any>]) => {
            kvp[1].mockClear();
        });
    });

    const draftPickObjKeys = ["currentOwner", "originalOwner", "round", "type", "season"];
    const pickPredicate = (pick: DraftPick) => Object.keys(pick).every(k => draftPickObjKeys.includes(k));

    it("should not call deleteAllPicks if mode is undefined", async () => {
        const csv = `${process.env.BASE_DIR}/tests/resources/three-player-50-picks.csv`;
        await processDraftPickCsv(csv, [testTeam1, testTeam2, testTeam3],
            mockDAO as unknown as DraftPickDAO);
        expect(mockDAO.deleteAllPicks).toHaveBeenCalledTimes(0);
    });
    it("should not call deleteAllPicks if mode is append", async () => {
        const csv = `${process.env.BASE_DIR}/tests/resources/three-player-50-picks.csv`;
        await processDraftPickCsv(csv, [testTeam1, testTeam2, testTeam3],
            mockDAO as unknown as DraftPickDAO, "append");
        expect(mockDAO.deleteAllPicks).toHaveBeenCalledTimes(0);
    });
    it("should call deleteAllPicks if mode is overwrite", async () => {
        const csv = `${process.env.BASE_DIR}/tests/resources/three-player-50-picks.csv`;
        await processDraftPickCsv(csv, [testTeam1, testTeam2, testTeam3],
            mockDAO as unknown as DraftPickDAO, "overwrite");
        expect(mockDAO.deleteAllPicks).toHaveBeenCalledTimes(1);
        expect(mockDAO.deleteAllPicks).toHaveBeenCalledWith();
    });

    it("should return an error if error while deleting existing picks", async () => {
        mockDAO.deleteAllPicks.mockImplementationOnce(() => {
            throw new Error("Error deleting draft picks");
        });
        const csv = `${process.env.BASE_DIR}/tests/resources/three-player-50-picks.csv`;
        await expect(processDraftPickCsv(csv, [testTeam1, testTeam2, testTeam3],
            mockDAO as unknown as DraftPickDAO, "overwrite")).rejects.toThrow(Error);
        expect(mockDAO.deleteAllPicks).toHaveBeenCalledTimes(1);
        expect(mockDAO.batchCreatePicks).toHaveBeenCalledTimes(0);
    });

    it("should call DAO.batchCreatePicks once if less than 50 rows", async () => {
        const csv = `${process.env.BASE_DIR}/tests/resources/two-player-less-picks.csv`;
        await processDraftPickCsv(csv, [testTeam1, testTeam2],
            mockDAO as unknown as DraftPickDAO);
        expect(mockDAO.deleteAllPicks).toHaveBeenCalledTimes(0);
        expect(mockDAO.batchCreatePicks).toHaveBeenCalledTimes(1);
        expect(mockDAO.batchCreatePicks).toHaveBeenCalledWith(expect.toBeArrayOfSize(6));
        expect(mockDAO.batchCreatePicks.mock.calls[0][0]).toSatisfyAll(pickPredicate);
    });
    it("should call DAO.batchCreatePicks once even if more than 50 rows", async () => {
         const csv = `${process.env.BASE_DIR}/tests/resources/three-player-50-picks.csv`;
         await processDraftPickCsv(csv, [testTeam1, testTeam2, testTeam3],
             mockDAO as unknown as DraftPickDAO);
         expect(mockDAO.deleteAllPicks).toHaveBeenCalledTimes(0);
         expect(mockDAO.batchCreatePicks).toHaveBeenCalledTimes(1);
         expect(mockDAO.batchCreatePicks).toHaveBeenCalledWith(expect.toBeArrayOfSize(50));
         expect(mockDAO.batchCreatePicks.mock.calls[0][0]).toSatisfyAll(pickPredicate);
    });

    it("should return all the rows from the csv as draft picks", async () => {
        mockDAO.batchCreatePicks.mockImplementationOnce((arr: Partial<DraftPick>[]) =>
            Promise.resolve(arr.map(draftPickObj => new DraftPick(draftPickObj as DraftPick))));
        const csv = `${process.env.BASE_DIR}/tests/resources/three-player-50-picks.csv`;
        const res = await processDraftPickCsv(csv, [testTeam1, testTeam2, testTeam3],
            mockDAO as unknown as DraftPickDAO);
        await expect(res).toBeArrayOfSize(50);
        expect(res).toSatisfyAll(p => p instanceof DraftPick);
        expect(res).toSatisfyAll(pickPredicate);
    });
    it("should skip any rows from the csv that don't have a user in the db", async () => {
        mockDAO.batchCreatePicks.mockImplementationOnce((arr: Partial<DraftPick>[]) =>
            Promise.resolve(arr.map(draftPickObj => new DraftPick(draftPickObj as DraftPick))));
        const csv = `${process.env.BASE_DIR}/tests/resources/three-player-50-picks.csv`;
        const res = await processDraftPickCsv(csv, [testTeam1, testTeam2],
            mockDAO as unknown as DraftPickDAO);
        await expect(res).toBeArrayOfSize(32);
    });
    it("should skip any rows from the csv that don't have required props", async () => {
        mockDAO.batchCreatePicks.mockImplementationOnce((arr: Partial<DraftPick>[]) =>
            Promise.resolve(arr.map(draftPickObj => new DraftPick(draftPickObj as DraftPick))));
        const csv1 = `${process.env.BASE_DIR}/tests/resources/three-player-50-picks-with-invalid.csv`;
        const res1 = await processDraftPickCsv(csv1, [testTeam1, testTeam2, testTeam3],
            mockDAO as unknown as DraftPickDAO);
        await expect(res1).toBeArrayOfSize(46);

        const csv2 = `${process.env.BASE_DIR}/tests/resources/three-player-50-picks-invalid-headers.csv`;
        const res2 = await processDraftPickCsv(csv2, [testTeam1, testTeam2, testTeam3],
            mockDAO as unknown as DraftPickDAO);
        await expect(res2).toBeUndefined();
    });
});
