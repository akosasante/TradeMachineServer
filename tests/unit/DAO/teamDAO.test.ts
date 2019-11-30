import "jest";
import "jest-extended";
import { NotFoundError } from "routing-controllers";
import * as typeorm from "typeorm";
import TeamDAO from "../../../src/DAO/TeamDAO";
import User from "../../../src/models/user";
import { TeamFactory } from "../../factories/TeamFactory";
import { mockDeleteChain, mockExecute, mockWhereInIds } from "./daoHelpers";
import logger from "../../../src/bootstrap/logger";

describe("TeamDAO", () => {
    const mockTeamDb = {
        find: jest.fn(),
        // findOneOrFail: jest.fn(),
        // save: jest.fn(),
        // update: jest.fn(),
        createQueryBuilder: jest.fn(),
    };
    const testTeam = TeamFactory.getTeam(undefined, undefined, {id: "d4e3fe52-1b18-4cb6-96b1-600ed86ec45b"});
    const testTeamModel = testTeam.toTeamModel();
    // @ts-ignore
    const teamDAO = new TeamDAO(mockTeamDb);
    // const [testTeam1, testTeam2] = TeamFactory.getTeams(2);

    afterEach(() => {
        Object.entries(mockTeamDb).forEach((kvp: [string, jest.Mock<any, any>]) => {
            kvp[1].mockClear();
        });

        mockWhereInIds.mockClear();
        mockExecute.mockClear();
    });

    beforeAll(() => {
        logger.debug("~~~~~~TEAM DAO TESTS BEGIN~~~~~~");
    });
    afterAll(() => {
        logger.debug("~~~~~~TEAM DAO TESTS COMPLETE~~~~~~");
    });

    it("getAllTeams - should call the db find method once with no args", async () => {
        mockTeamDb.find.mockReturnValueOnce([testTeam]);
        const defaultOpts = {order: {id: "ASC"}};
        const res = await teamDAO.getAllTeams();

        expect(mockTeamDb.find).toHaveBeenCalledTimes(1);
        expect(mockTeamDb.find).toHaveBeenCalledWith(defaultOpts);
        expect(res).toEqual([testTeamModel]);
    });
    
    describe("getTeamsByOwnerStatus - should call the db createQueryBuilder with the correct methods", () => {
        const getMany = jest.fn(() => [testTeam]);
        const where = jest.fn(() => ({ getMany }));
        const leftJoinAndSelect = jest.fn(() => ({ where }));
        mockTeamDb.createQueryBuilder.mockImplementation(() => ({ leftJoinAndSelect }));

        it("if hasOwners is true, should search using `owners IS NOT NULL`", async () => {
            const resTrue = await teamDAO.getTeamsByOwnerStatus(true);
            expect(mockTeamDb.createQueryBuilder).toHaveBeenCalledTimes(1);
            expect(mockTeamDb.createQueryBuilder).toHaveBeenCalledWith("team");
            expect(where).toHaveBeenLastCalledWith('owner."teamId" IS NOT NULL');
            expect(resTrue).toEqual([testTeamModel]);
        });
        it("if hasOwners is false, should search using `owners IS NULL`", async () => {
            const resFalse = await teamDAO.getTeamsByOwnerStatus(false);
            expect(mockTeamDb.createQueryBuilder).toHaveBeenCalledTimes(1);
            expect(mockTeamDb.createQueryBuilder).toHaveBeenCalledWith("team");
            expect(where).toHaveBeenLastCalledWith('owner."teamId" IS NULL');
            expect(resFalse).toEqual([testTeamModel]);
        });
    });
    //
    // it("getTeamById - should throw NotFoundError if no id is passed", async () => {
    //     // @ts-ignore
    //     await expect(teamDAO.getTeamById(undefined)).rejects.toThrow(NotFoundError);
    //     expect(mockTeamDb.findOneOrFail).toHaveBeenCalledTimes(0);
    // });
    //
    // it("getTeamById - should call the db findOneOrFail once with id", async () => {
    //     mockTeamDb.findOneOrFail.mockReturnValueOnce(testTeam1.parse());
    //     const res = await teamDAO.getTeamById(1);
    //
    //     expect(mockTeamDb.findOneOrFail).toHaveBeenCalledTimes(1);
    //     expect(mockTeamDb.findOneOrFail).toHaveBeenCalledWith(1);
    //     expect(res).toEqual(testTeam1);
    // });
    //
    // it("findTeams - should call the db find once with query", async () => {
    //     mockTeamDb.find.mockReturnValueOnce([testTeam1.parse()]);
    //     const res = await teamDAO.findTeams({espnId: 1});
    //
    //     expect(mockTeamDb.find).toHaveBeenCalledTimes(1);
    //     expect(mockTeamDb.find).toHaveBeenCalledWith({where: {espnId: 1}});
    //     expect(res).toEqual([testTeam1]);
    // });
    //
    // it("findTeams - should throw an error if find returns empty array", async () => {
    //     mockTeamDb.find.mockReturnValueOnce([]);
    //     await expect(teamDAO.findTeams({espnId: 1})).rejects.toThrow(NotFoundError);
    //     expect(mockTeamDb.find).toHaveBeenCalledTimes(1);
    // });
    //
    // it("createTeam - should call the db save once with teamObj", async () => {
    //     mockTeamDb.save.mockReturnValueOnce(testTeam1.parse());
    //     const res = await teamDAO.createTeam(testTeam1.parse());
    //
    //     expect(mockTeamDb.save).toHaveBeenCalledTimes(1);
    //     expect(mockTeamDb.save).toHaveBeenCalledWith(testTeam1.parse());
    //     expect(res).toEqual(testTeam1);
    // });
    //
    // it("updateTeam - should call the db update and findOneOrFail once with id and teamObj", async () => {
    //     mockTeamDb.findOneOrFail.mockReturnValueOnce(testTeam1.parse());
    //     const res = await teamDAO.updateTeam(1, testTeam1.parse());
    //
    //     expect(mockTeamDb.update).toHaveBeenCalledTimes(1);
    //     expect(mockTeamDb.update).toHaveBeenCalledWith({id: 1}, testTeam1.parse());
    //     expect(mockTeamDb.findOneOrFail).toHaveBeenCalledTimes(1);
    //     expect(mockTeamDb.findOneOrFail).toHaveBeenCalledWith(1);
    //     expect(res).toEqual(testTeam1);
    // });
    //
    // it("deleteTeam - should call the db delete once with id", async () => {
    //     mockTeamDb.createQueryBuilder.mockReturnValueOnce(mockDeleteChain);
    //     const deleteResult = { raw: [{id: 1}], affected: 1};
    //     mockExecute.mockReturnValueOnce(deleteResult);
    //     const res = await teamDAO.deleteTeam(1);
    //
    //     expect(mockTeamDb.findOneOrFail).toHaveBeenCalledTimes(1);
    //     expect(mockTeamDb.findOneOrFail).toHaveBeenCalledWith(1);
    //     expect(mockTeamDb.createQueryBuilder).toHaveBeenCalledTimes(1);
    //     expect(mockWhereInIds).toHaveBeenCalledWith(1);
    //     expect(res).toEqual(deleteResult);
    // });
    //
    // it("deleteTeam - should throw NotFoundError if no id is passed", async () => {
    //     // @ts-ignore
    //     await expect(teamDAO.deleteTeam(undefined)).rejects.toThrow(NotFoundError);
    //     expect(mockTeamDb.findOneOrFail).toHaveBeenCalledTimes(0);
    //     expect(mockTeamDb.createQueryBuilder).toHaveBeenCalledTimes(0);
    // });
    //
    // it("updateOwners - should call the db createQueryBuilder and findOneOrFail with id and owner objects", async () => {
    //     const addAndRemove = jest.fn();
    //     const of = jest.fn(() => ({addAndRemove}));
    //     const relation = jest.fn(() => ({of}));
    //     mockTeamDb.createQueryBuilder.mockImplementationOnce(() => ({ relation }));
    //     mockTeamDb.findOneOrFail.mockReturnValue(testTeam1.parse());
    //     const res = await teamDAO.updateTeamOwners(
    //         1,
    //         [new User({email: "1@example.com"})], [new User({email: "2@example.com"})]);
    //
    //     expect(mockTeamDb.createQueryBuilder).toHaveBeenCalledTimes(1);
    //     expect(mockTeamDb.createQueryBuilder).toHaveBeenCalledWith();
    //     expect(mockTeamDb.findOneOrFail).toHaveBeenCalledTimes(2);
    //     expect(mockTeamDb.findOneOrFail).toHaveBeenCalledWith(1);
    //     expect(res).toEqual(testTeam1);
    // });
    // it("updateTeamOwners should throw an error if no id is passed", async () => {
    //     // @ts-ignore
    //     await expect(teamDAO.updateTeamOwners(undefined)).rejects.toThrow(NotFoundError);
    // });
    //

});
