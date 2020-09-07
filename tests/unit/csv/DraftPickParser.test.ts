import "jest";
import "jest-extended";
import { processDraftPickCsv } from "../../../src/csv/DraftPickParser";
import DraftPickDAO from "../../../src/DAO/DraftPickDAO";
import DraftPick from "../../../src/models/draftPick";
import { TeamFactory } from "../../factories/TeamFactory";
import { UserFactory } from "../../factories/UserFactory";
import logger from "../../../src/bootstrap/logger";

describe("DraftPickParser", () => {
    beforeAll(() => {
        logger.debug("~~~~~~DRAFT PICK PARSER TESTS BEGIN~~~~~~");
    });
    afterAll(() => {
        logger.debug("~~~~~~DRAFT PICK PARSER TESTS COMPLETE~~~~~~");
    });
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

    const threePlayerCsv = `${process.env.BASE_DIR}/tests/resources/three-player-50-picks.csv`;
    const twoPlayerCsv = `${process.env.BASE_DIR}/tests/resources/two-player-less-picks.csv`;
    const invalidRowCsv = `${process.env.BASE_DIR}/tests/resources/three-player-50-picks-with-invalid.csv`;
    const invalidHeadersCsv = `${process.env.BASE_DIR}/tests/resources/three-player-50-picks-invalid-headers.csv`;
    const threePlayersWithDupeCsv = `${process.env.BASE_DIR}/tests/resources/three-player-10-picks-with-dupe.csv`;

    const mockDAO = {
        deleteAllPicks: jest.fn(),
        batchUpsertPicks: jest.fn(),
    };

    beforeEach(() => {
        mockDAO.batchUpsertPicks.mockImplementation((arr: Partial<DraftPick>[]) =>
            Promise.resolve(arr.map(draftPickObj => new DraftPick(draftPickObj as DraftPick))));
    });
    afterEach(() => {
        Object.values(mockDAO).forEach(mockFn => mockFn.mockReset());
    });

    const draftPickObjKeys = ["currentOwner", "originalOwner", "round", "type", "season"];
    const pickPredicate = (pick: DraftPick) => Object.keys(pick).every(k => draftPickObjKeys.includes(k));


    describe("deal with maybeDeleteExistingPicks/2 correctly", () => {
        it("should not call deleteAllPicks if mode is undefined", async () => {
            await processDraftPickCsv(threePlayerCsv, [testTeam1, testTeam2, testTeam3],
                mockDAO as unknown as DraftPickDAO);
            expect(mockDAO.deleteAllPicks).toHaveBeenCalledTimes(0);
        });
        it("should not call deleteAllPicks if mode is append", async () => {
            await processDraftPickCsv(threePlayerCsv, [testTeam1, testTeam2, testTeam3],
                mockDAO as unknown as DraftPickDAO, "append");
            expect(mockDAO.deleteAllPicks).toHaveBeenCalledTimes(0);
        });
        it("should call deleteAllPicks if mode is overwrite", async () => {
            await processDraftPickCsv(threePlayerCsv, [testTeam1, testTeam2, testTeam3],
                mockDAO as unknown as DraftPickDAO, "overwrite");
            expect(mockDAO.deleteAllPicks).toHaveBeenCalledTimes(1);
            expect(mockDAO.deleteAllPicks).toHaveBeenCalledWith();
        });

        it("should return an error if error occurs while deleting existing picks", async () => {
            mockDAO.deleteAllPicks.mockImplementationOnce(() => {
                throw new Error("Error deleting draft picks");
            });
            await expect(processDraftPickCsv(threePlayerCsv, [testTeam1, testTeam2, testTeam3],
                mockDAO as unknown as DraftPickDAO, "overwrite")).rejects.toThrow(Error);
            expect(mockDAO.deleteAllPicks).toHaveBeenCalledTimes(1);
            expect(mockDAO.batchUpsertPicks).toHaveBeenCalledTimes(0);
        });
    });

    it("should call DAO.batchUpsertPicks once if less than 50 rows", async () => {
        await processDraftPickCsv(twoPlayerCsv, [testTeam1, testTeam2],
            mockDAO as unknown as DraftPickDAO);
        expect(mockDAO.deleteAllPicks).toHaveBeenCalledTimes(0);
        expect(mockDAO.batchUpsertPicks).toHaveBeenCalledTimes(1);
        expect(mockDAO.batchUpsertPicks).toHaveBeenCalledWith(expect.toBeArrayOfSize(6));
        expect(mockDAO.batchUpsertPicks.mock.calls[0][0]).toSatisfyAll(pickPredicate);
    });
    it("should call DAO.batchUpsertPicks once even if more than 50 rows", async () => {
         await processDraftPickCsv(threePlayerCsv, [testTeam1, testTeam2, testTeam3],
             mockDAO as unknown as DraftPickDAO);
         expect(mockDAO.deleteAllPicks).toHaveBeenCalledTimes(0);
         expect(mockDAO.batchUpsertPicks).toHaveBeenCalledTimes(1);
         expect(mockDAO.batchUpsertPicks).toHaveBeenCalledWith(expect.toBeArrayOfSize(50));
         expect(mockDAO.batchUpsertPicks.mock.calls[0][0]).toSatisfyAll(pickPredicate);
    });

    it("should return all the rows from the csv as draft picks", async () => {
        const res = await processDraftPickCsv(threePlayerCsv, [testTeam1, testTeam2, testTeam3],
            mockDAO as unknown as DraftPickDAO);
        await expect(res).toBeArrayOfSize(50);
        expect(res).toSatisfyAll(p => p instanceof DraftPick);
        expect(res).toSatisfyAll(pickPredicate);
    });
    it("should skip any rows from the csv that don't have a user in the db", async () => {
        const res = await processDraftPickCsv(threePlayerCsv, [testTeam1, testTeam2],
            mockDAO as unknown as DraftPickDAO);
        await expect(res).toBeArrayOfSize(32);
    });
    it("should skip any rows from the csv that don't have required props", async () => {
        const res1 = await processDraftPickCsv(invalidRowCsv, [testTeam1, testTeam2, testTeam3],
            mockDAO as unknown as DraftPickDAO);
        await expect(res1).toBeArrayOfSize(46);

        const res2 = await processDraftPickCsv(invalidHeadersCsv, [testTeam1, testTeam2, testTeam3],
            mockDAO as unknown as DraftPickDAO);
        await expect(res2).toEqual([]);
    });

    it("should filter out duplicate picks - picks with the same pick owner, league level, and round", async () => {
        const res = await processDraftPickCsv(threePlayersWithDupeCsv,
            [testTeam1, testTeam2, testTeam3], mockDAO as unknown as DraftPickDAO);
        expect(res).toBeArrayOfSize(9);
    });
});
