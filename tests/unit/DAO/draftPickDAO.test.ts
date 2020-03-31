import "jest";
import "jest-extended";
import { Repository } from "typeorm";
import DraftPickDAO from "../../../src/DAO/DraftPickDAO";
import { LeagueLevel } from "../../../src/models/player";
import { DraftPickFactory } from "../../factories/DraftPickFactory";
import { mockDeleteChain, mockExecute, MockObj, mockWhereInIds } from "./daoHelpers";
import DraftPick from "../../../src/models/draftPick";
import logger from "../../../src/bootstrap/logger";


describe("DraftPickDAO", () => {
    const mockPickDb: MockObj = {
        find: jest.fn(),
        findOneOrFail: jest.fn(),
        save: jest.fn(),
        insert: jest.fn(),
        update: jest.fn(),
        remove: jest.fn(),
        createQueryBuilder: jest.fn(),
    };

    const testPick1 = DraftPickFactory.getPick();
    const draftPickDAO = new DraftPickDAO(mockPickDb as unknown as Repository<DraftPick>);

    afterEach(() => {
        Object.keys(mockPickDb).forEach((action: string) => {
            (mockPickDb[action as keyof MockObj] as jest.Mock).mockClear();
        });

        mockExecute.mockClear();
        mockWhereInIds.mockClear();
    });

    beforeAll(() => {
        logger.debug("~~~~~~DRAFT PICK DAO TESTS BEGIN~~~~~~");
    });
    afterAll(() => {
        logger.debug("~~~~~~DRAFT PICK DAO TESTS COMPLETE~~~~~~");
    });

    it("getAllPicks - should call the db find method once with option args", async () => {
        mockPickDb.find.mockReturnValueOnce([testPick1]);
        const defaultOpts = {order: {id: "ASC"}};
        const res = await draftPickDAO.getAllPicks();

        expect(mockPickDb.find).toHaveBeenCalledTimes(1);
        expect(mockPickDb.find).toHaveBeenCalledWith(defaultOpts);
        expect(res).toEqual([testPick1]);
    });

    it("getPickById - should call the db findOneOrFail once with id", async () => {
        mockPickDb.findOneOrFail.mockReturnValueOnce(testPick1);
        const res = await draftPickDAO.getPickById(testPick1.id!);

        expect(mockPickDb.findOneOrFail).toHaveBeenCalledTimes(1);
        expect(mockPickDb.findOneOrFail).toHaveBeenCalledWith(testPick1.id);
        expect(res).toEqual(testPick1);
    });

    it("findPicks - should call the db find once with query", async () => {
        const query = {type: LeagueLevel.HIGH};
        mockPickDb.find.mockReturnValueOnce([testPick1]);
        const res = await draftPickDAO.findPicks(query);

        expect(mockPickDb.find).toHaveBeenCalledTimes(1);
        expect(mockPickDb.find).toHaveBeenCalledWith({where: query});
        expect(res).toEqual([testPick1]);
    });

    it("createPick - should call the db save once with pickObj", async () => {
        mockPickDb.insert.mockReturnValueOnce({identifiers: [{id: testPick1.id!}], generatedMaps: [], raw: []});
        mockPickDb.find.mockReturnValueOnce(testPick1);
        const res = await draftPickDAO.createPicks([testPick1]);

        expect(mockPickDb.insert).toHaveBeenCalledTimes(1);
        expect(mockPickDb.insert).toHaveBeenCalledWith([testPick1.parse()]);
        expect(mockPickDb.find).toHaveBeenCalledTimes(1);
        expect(mockPickDb.find).toHaveBeenCalledWith({"id": {"_multipleParameters": true, "_type": "in", "_useParameter": true, "_value": [testPick1.id]}});

        expect(res).toEqual(testPick1);
    });

    it("updatePick - should call the db update and findOneOrFail once with id and teamObj", async () => {
        mockPickDb.findOneOrFail.mockReturnValueOnce(testPick1);
        const res = await draftPickDAO.updatePick(testPick1.id!, testPick1.parse());

        expect(mockPickDb.update).toHaveBeenCalledTimes(1);
        expect(mockPickDb.update).toHaveBeenCalledWith({id: testPick1.id}, testPick1.parse());
        expect(mockPickDb.findOneOrFail).toHaveBeenCalledTimes(1);
        expect(mockPickDb.findOneOrFail).toHaveBeenCalledWith(testPick1.id);
        expect(res).toEqual(testPick1);
    });

    it("deletePick - should call the db delete once with id", async () => {
        mockPickDb.findOneOrFail.mockReturnValueOnce(testPick1);
        mockPickDb.createQueryBuilder.mockReturnValueOnce(mockDeleteChain);
        const deleteResult = { affected: 1, raw: {id: testPick1.id!} };
        mockExecute.mockReturnValueOnce(deleteResult);
        const res = await draftPickDAO.deletePick(testPick1.id!);

        expect(mockPickDb.findOneOrFail).toHaveBeenCalledTimes(1);
        expect(mockPickDb.findOneOrFail).toHaveBeenCalledWith(testPick1.id!);
        expect(mockPickDb.createQueryBuilder).toHaveBeenCalledTimes(1);
        expect(mockWhereInIds).toHaveBeenCalledWith(testPick1.id!);

        expect(res).toEqual(deleteResult);
    });

    describe("deleteAllPicks - delete all the picks in chunks", () => {
        it("should delete all draft picks if no query passed in", async () => {
            const query = {type: LeagueLevel.LOW};
            mockPickDb.find.mockReturnValueOnce([testPick1]);
            await draftPickDAO.deleteAllPicks(query);

            expect(mockPickDb.find).toHaveBeenCalledTimes(1);
            expect(mockPickDb.find).toHaveBeenCalledWith({where: query});
            expect(mockPickDb.remove).toHaveBeenCalledTimes(1);
            expect(mockPickDb.remove).toHaveBeenCalledWith([testPick1], {chunk: 10});
        });
        it("should delete queried draft picks if no query passed in", async () => {
            mockPickDb.find.mockReturnValueOnce([testPick1]);
            await draftPickDAO.deleteAllPicks();

            expect(mockPickDb.find).toHaveBeenCalledTimes(1);
            expect(mockPickDb.find).toHaveBeenCalledWith({order: {id: "ASC"}});
            expect(mockPickDb.remove).toHaveBeenCalledTimes(1);
            expect(mockPickDb.remove).toHaveBeenCalledWith([testPick1], {chunk: 10});
        });
    });

    it("batchCreatePicks - should call the db save once with pickObjs", async () => {
        mockPickDb.save.mockReturnValueOnce([testPick1]);
        const res = await draftPickDAO.batchCreatePicks([testPick1]);

        expect(mockPickDb.save).toHaveBeenCalledTimes(1);
        expect(mockPickDb.save).toHaveBeenCalledWith([testPick1], {chunk: 10});
        expect(res).toEqual([testPick1]);
    });
});
