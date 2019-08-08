import "jest";
import "jest-extended";
import { NotFoundError } from "routing-controllers";
import * as typeorm from "typeorm";
import { IsNull, Not } from "typeorm";
import DraftPickDAO from "../../../src/DAO/DraftPickDAO";
import DraftPick from "../../../src/models/draftPick";
import { LeagueLevel } from "../../../src/models/player";
import { mockDeleteChain, mockExecute, mockWhereInIds } from "./daoHelpers";

const mockPickDb = {
    find: jest.fn(),
    findOneOrFail: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    createQueryBuilder: jest.fn(),
};

// @ts-ignore
jest.spyOn(typeorm, "getConnection").mockReturnValue({
    getRepository: jest.fn().mockReturnValue(mockPickDb)});

describe("DraftPickDAO", () => {
    const draftPickDAO = new DraftPickDAO();
    const testPick1 = new DraftPick({round: 1, pickNumber: 12, type: LeagueLevel.LOW});

    afterEach(() => {
        Object.entries(mockPickDb).forEach((kvp: [string, jest.Mock<any, any>]) => {
            kvp[1].mockClear();
        });

        mockExecute.mockClear();
        mockWhereInIds.mockClear();
    });

    it("getAllPicks - should call the db find method once with no args", async () => {
        mockPickDb.find.mockReturnValueOnce([testPick1.parse()]);
        const defaultOpts = {order: {id: "ASC"}};
        const res = await draftPickDAO.getAllPicks();

        expect(mockPickDb.find).toHaveBeenCalledTimes(1);
        expect(mockPickDb.find).toHaveBeenCalledWith(defaultOpts);
        expect(res).toEqual([testPick1]);
    });

    it("getPickById - should throw NotFoundError if no id is passed in", async () => {
        // @ts-ignore
        await expect(draftPickDAO.getPickById(undefined)).rejects.toThrow(NotFoundError);
        expect(mockPickDb.findOneOrFail).toHaveBeenCalledTimes(0);
    });

    it("getPickById - should call the db findOneOrFail once with id", async () => {
        mockPickDb.findOneOrFail.mockReturnValueOnce(testPick1.parse());
        const res = await draftPickDAO.getPickById(1);

        expect(mockPickDb.findOneOrFail).toHaveBeenCalledTimes(1);
        expect(mockPickDb.findOneOrFail).toHaveBeenCalledWith(1);
        expect(res).toEqual(testPick1);
    });

    it("findPicks - should call the db find once with query", async () => {
        const query = {type: LeagueLevel.HIGH};
        mockPickDb.find.mockReturnValueOnce([testPick1.parse()]);
        const res = await draftPickDAO.findPicks(query);

        expect(mockPickDb.find).toHaveBeenCalledTimes(1);
        expect(mockPickDb.find).toHaveBeenCalledWith({where: query, order: {id: "ASC"}});
        expect(res).toEqual([testPick1]);
    });

    it("createPick - should call the db save once with pickObj", async () => {
        mockPickDb.save.mockReturnValueOnce(testPick1.parse());
        const res = await draftPickDAO.createPick(testPick1.parse());

        expect(mockPickDb.save).toHaveBeenCalledTimes(1);
        expect(mockPickDb.save).toHaveBeenCalledWith(testPick1.parse());
        expect(res).toEqual(testPick1);
    });

    it("updatePick - should call the db update and findOneOrFail once with id and teamObj", async () => {
        mockPickDb.findOneOrFail.mockReturnValueOnce(testPick1.parse());
        const res = await draftPickDAO.updatePick(1, testPick1.parse());

        expect(mockPickDb.update).toHaveBeenCalledTimes(1);
        expect(mockPickDb.update).toHaveBeenCalledWith({id: 1}, testPick1.parse());
        expect(mockPickDb.findOneOrFail).toHaveBeenCalledTimes(1);
        expect(mockPickDb.findOneOrFail).toHaveBeenCalledWith(1);
        expect(res).toEqual(testPick1);
    });

    it("deletePick - should throw NotFoundError if no id is passed", async () => {
        // @ts-ignore
        await expect(draftPickDAO.deletePick(undefined)).rejects.toThrow(NotFoundError);
        expect(mockPickDb.findOneOrFail).toHaveBeenCalledTimes(0);
        expect(mockPickDb.createQueryBuilder).toHaveBeenCalledTimes(0);
    });

    it("deletePick - should call the db delete once with id", async () => {
        mockPickDb.createQueryBuilder.mockReturnValueOnce(mockDeleteChain);
        const deleteResult = { raw: [ {id: 1} ], affected: 1};
        mockExecute.mockReturnValueOnce(deleteResult);
        const res = await draftPickDAO.deletePick(1);

        expect(mockPickDb.findOneOrFail).toHaveBeenCalledTimes(1);
        expect(mockPickDb.findOneOrFail).toHaveBeenCalledWith(1);
        expect(mockPickDb.createQueryBuilder).toHaveBeenCalledTimes(1);
        expect(mockWhereInIds).toHaveBeenCalledWith(1);
        expect(res).toEqual(deleteResult);
    });

    it("deleteAllPicks - delete all the picks in chunks", async () => {
        const expectedQuery = {id: Not(IsNull())};
        await draftPickDAO.deleteAllPicks();
        expect(mockPickDb.delete).toHaveBeenCalledTimes(1);
        expect(mockPickDb.delete).toHaveBeenCalledWith(expectedQuery, {chunk: 10});
    });

    it("batchCreatePicks - should call the db save once with pickObjs", async () => {
        mockPickDb.save.mockReturnValueOnce([testPick1.parse()]);
        const res = await draftPickDAO.batchCreatePicks([testPick1.parse()]);

        expect(mockPickDb.save).toHaveBeenCalledTimes(1);
        expect(mockPickDb.save).toHaveBeenCalledWith([testPick1.parse()], {chunk: 10});
        expect(res).toEqual([testPick1]);
    });
});
