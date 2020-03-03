import "jest";
import "jest-extended";
import logger from "../../../src/bootstrap/logger";
import TeamDAO from "../../../src/DAO/TeamDAO";
import User from "../../../src/models/user";
import { TeamFactory } from "../../factories/TeamFactory";
import { mockDeleteChain, mockExecute, mockWhereInIds } from "./daoHelpers";

describe("TeamDAO", () => {
    const mockTeamDb = {
        find: jest.fn(),
        findOneOrFail: jest.fn(),
        save: jest.fn(),
        update: jest.fn(),
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

    it("getTeamById - should call the db findOneOrFail once with id", async () => {
        mockTeamDb.findOneOrFail.mockReturnValueOnce(testTeam);
        const res = await teamDAO.getTeamById(testTeam.id!);

        expect(mockTeamDb.findOneOrFail).toHaveBeenCalledTimes(1);
        expect(mockTeamDb.findOneOrFail).toHaveBeenCalledWith(testTeam.id);
        expect(res).toEqual(testTeamModel);
    });

    it("findTeams - should call the db find once with query", async () => {
        const condition = {espnId: 1};
        mockTeamDb.find.mockReturnValueOnce([testTeam]);
        const res = await teamDAO.findTeams(condition);

        expect(mockTeamDb.find).toHaveBeenCalledTimes(1);
        expect(mockTeamDb.find).toHaveBeenCalledWith({where: condition});
        expect(res).toEqual([testTeamModel]);
    });

    it("createTeams - should call the db save once with all the teams passed in", async () => {
        mockTeamDb.save.mockReturnValueOnce([testTeam]);
        const res = await teamDAO.createTeams(testTeam.parse());

        expect(mockTeamDb.save).toHaveBeenCalledTimes(1);
        expect(mockTeamDb.save).toHaveBeenCalledWith(testTeam.parse());
        expect(res).toEqual([testTeamModel]);
    });

    it("updateTeam - should call the db update and findOneOrFail once with id and teamObj", async () => {
        mockTeamDb.findOneOrFail.mockReturnValueOnce(testTeam);
        const res = await teamDAO.updateTeam(testTeam.id!, testTeam.parse());

        expect(mockTeamDb.update).toHaveBeenCalledTimes(1);
        expect(mockTeamDb.update).toHaveBeenCalledWith({id: testTeam.id}, testTeam.parse());
        expect(mockTeamDb.findOneOrFail).toHaveBeenCalledTimes(1);
        expect(mockTeamDb.findOneOrFail).toHaveBeenCalledWith(testTeam.id);
        expect(res).toEqual(testTeamModel);
    });

    it("deleteTeam - should call the db delete once with id", async () => {
        mockTeamDb.findOneOrFail.mockReturnValueOnce(testTeam);
        mockTeamDb.createQueryBuilder.mockReturnValueOnce(mockDeleteChain);
        const deleteResult = { raw: [{id: testTeam.id!}], affected: 1};
        mockExecute.mockReturnValueOnce(deleteResult);
        const res = await teamDAO.deleteTeam(testTeam.id!);

        expect(mockTeamDb.findOneOrFail).toHaveBeenCalledTimes(1);
        expect(mockTeamDb.findOneOrFail).toHaveBeenCalledWith(testTeam.id!);
        expect(mockTeamDb.createQueryBuilder).toHaveBeenCalledTimes(1);
        expect(mockWhereInIds).toHaveBeenCalledWith(testTeam.id!);
        expect(res).toEqual(deleteResult);
    });

    it("updateTeamOwners - should call the db createQueryBuilder and findOneOrFail with id and owner objects", async () => {
        const addAndRemove = jest.fn();
        const of = jest.fn(() => ({addAndRemove}));
        const relation = jest.fn(() => ({of}));
        mockTeamDb.createQueryBuilder.mockImplementationOnce(() => ({ relation }));
        mockTeamDb.findOneOrFail.mockReturnValue(testTeam);
        const res = await teamDAO.updateTeamOwners(
            testTeam.id,
            [new User({email: "1@example.com"})], [new User({email: "2@example.com"})]);

        expect(mockTeamDb.createQueryBuilder).toHaveBeenCalledTimes(1);
        expect(mockTeamDb.createQueryBuilder).toHaveBeenCalledWith();
        expect(mockTeamDb.findOneOrFail).toHaveBeenCalledTimes(2);
        expect(mockTeamDb.findOneOrFail).toHaveBeenCalledWith(testTeam.id);
        expect(res).toEqual(testTeamModel);
    });
});
