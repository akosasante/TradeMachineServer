import "jest";
import "jest-extended";
import { processDraftPickCsv } from "../../../src/csv/DraftPickParser";
import DraftPickDAO from "../../../src/DAO/DraftPickDAO";
import DraftPick from "../../../src/models/draftPick";
import User from "../../../src/models/user";

describe("DraftPickParser", () => {
    const testUser1 = new User({shortName: "Akos"});
    const testUser2 = new User({shortName: "Kwasi"});
    const testUser3 = new User({shortName: "Cam"});
    const mockDAO = {
        deleteAllPicks: jest.fn(),
        batchCreatePicks: jest.fn(),
    };

    afterEach(() => {
        Object.entries(mockDAO).forEach((kvp: [string, jest.Mock<any, any>]) => {
            kvp[1].mockClear();
        });
    });

    it("should not call deleteAllPicks if mode is undefined", async () => {
        const csv = `${process.env.BASE_DIR}/tests/resources/three-player-50-picks.csv`;
        await processDraftPickCsv(csv, [testUser1, testUser2, testUser3],
            mockDAO as unknown as DraftPickDAO);
        expect(mockDAO.deleteAllPicks).toHaveBeenCalledTimes(0);
    });
    it("should not call deleteAllPicks if mode is append", async () => {
        const csv = `${process.env.BASE_DIR}/tests/resources/three-player-50-picks.csv`;
        await processDraftPickCsv(csv, [testUser1, testUser2, testUser3],
            mockDAO as unknown as DraftPickDAO, "append");
        expect(mockDAO.deleteAllPicks).toHaveBeenCalledTimes(0);
    });
    it("should call deleteAllPicks if mode is overwrite", async () => {
        const csv = `${process.env.BASE_DIR}/tests/resources/three-player-50-picks.csv`;
        await processDraftPickCsv(csv, [testUser1, testUser2, testUser3],
            mockDAO as unknown as DraftPickDAO, "overwrite");
        expect(mockDAO.deleteAllPicks).toHaveBeenCalledTimes(1);
        expect(mockDAO.deleteAllPicks).toHaveBeenCalledWith();
    });
    it("should return an error if error while deleting existing picks", async () => {
        mockDAO.deleteAllPicks.mockImplementationOnce(() => {
            throw new Error("Error deleting draft picks");
        });
        const csv = `${process.env.BASE_DIR}/tests/resources/three-player-50-picks.csv`;
        await expect(processDraftPickCsv(csv, [testUser1, testUser2, testUser3],
            mockDAO as unknown as DraftPickDAO, "overwrite")).rejects.toThrow(Error);
        expect(mockDAO.deleteAllPicks).toHaveBeenCalledTimes(1);
    });
    it("should call DAO.batchCreatePicks once if less than 50 rows", async () => {
        const csv = `${process.env.BASE_DIR}/tests/resources/two-player-less-picks.csv`;
        const draftPickObjKeys = ["currentOwner", "originalOwner", "round", "type"];
        await processDraftPickCsv(csv, [testUser1, testUser2],
            mockDAO as unknown as DraftPickDAO);
        expect(mockDAO.deleteAllPicks).toHaveBeenCalledTimes(0);
        expect(mockDAO.batchCreatePicks).toHaveBeenCalledTimes(1);
        expect(mockDAO.batchCreatePicks).toHaveBeenCalledWith(expect.toBeArrayOfSize(6));
        expect(mockDAO.batchCreatePicks.mock.calls[0][0][0]).toEqual(expect.toContainAllKeys(draftPickObjKeys));
    });
    it("should call DAO.batchCreatePicks every time we get to 50 rows", async () => {
         const csv = `${process.env.BASE_DIR}/tests/resources/three-player-50-picks.csv`;
         const draftPickObjKeys = ["currentOwner", "originalOwner", "round", "type"];
         await processDraftPickCsv(csv, [testUser1, testUser2, testUser3],
             mockDAO as unknown as DraftPickDAO);
         expect(mockDAO.deleteAllPicks).toHaveBeenCalledTimes(0);
         expect(mockDAO.batchCreatePicks).toHaveBeenCalledTimes(2);
         expect(mockDAO.batchCreatePicks).toHaveBeenCalledWith(expect.toBeArrayOfSize(50));
         expect(mockDAO.batchCreatePicks).toHaveBeenCalledWith(expect.toBeArrayOfSize(0));
         expect(mockDAO.batchCreatePicks.mock.calls[0][0][0]).toEqual(expect.toContainAllKeys(draftPickObjKeys));
    });
    it("should return all the rows from the csv as draft picks", async () => {
        mockDAO.batchCreatePicks.mockImplementationOnce((arr: Array<Partial<DraftPick>>) =>
            Promise.resolve(arr.map(draftPickObj => new DraftPick(draftPickObj))));
        const csv = `${process.env.BASE_DIR}/tests/resources/three-player-50-picks.csv`;
        const draftPickObjKeys = ["currentOwner", "originalOwner", "round", "type"];
        const res = await processDraftPickCsv(csv, [testUser1, testUser2, testUser3],
            mockDAO as unknown as DraftPickDAO);
        await expect(res).toBeArrayOfSize(50);
        expect(res[0]).toBeInstanceOf(DraftPick);
        expect(res[0]).toEqual(expect.toContainKeys(draftPickObjKeys));
    });
    it("should skip any  rows from the csv that don't have a user in the db", async () => {
        mockDAO.batchCreatePicks.mockImplementationOnce((arr: Array<Partial<DraftPick>>) =>
            Promise.resolve(arr.map(draftPickObj => new DraftPick(draftPickObj))));
        const csv = `${process.env.BASE_DIR}/tests/resources/three-player-50-picks.csv`;
        const res = await processDraftPickCsv(csv, [testUser1, testUser2],
            mockDAO as unknown as DraftPickDAO);
        await expect(res).toBeArrayOfSize(32);
    });
    it("should skip any  rows from the csv that don't have required props", async () => {
        mockDAO.batchCreatePicks.mockImplementationOnce((arr: Array<Partial<DraftPick>>) =>
            Promise.resolve(arr.map(draftPickObj => new DraftPick(draftPickObj))));
        const csv1 = `${process.env.BASE_DIR}/tests/resources/three-player-50-picks-with-invalid.csv`;
        const res1 = await processDraftPickCsv(csv1, [testUser1, testUser2, testUser3],
            mockDAO as unknown as DraftPickDAO);
        await expect(res1).toBeArrayOfSize(47);

        const csv2 = `${process.env.BASE_DIR}/tests/resources/three-player-50-picks-invalid-headers.csv`;
        const res2 = await processDraftPickCsv(csv2, [testUser1, testUser2, testUser3],
            mockDAO as unknown as DraftPickDAO);
        await expect(res2).toBeArrayOfSize(0);
    });
});
