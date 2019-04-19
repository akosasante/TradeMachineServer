import "jest";
import "jest-extended";
import { NotFoundError } from "routing-controllers";
import * as typeorm from "typeorm";
import TeamDAO from "../../../src/DAO/TeamDAO";
import Team from "../../../src/models/team";
import User from "../../../src/models/user";

const mockTeamDb = {
    find: jest.fn(),
    findOneOrFail: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    createQueryBuilder: jest.fn(),
};

// @ts-ignore
jest.spyOn(typeorm, "getConnection").mockReturnValue({ getRepository: jest.fn().mockReturnValue(mockTeamDb) });

describe("TeamDAO", () => {
    const teamDAO = new TeamDAO();
    const testTeam1 = new Team({id: 1, name: "Squirtle Squad"});
    const testTeam2 = new Team({id: 2, name: "Flex Fox's Team"});

    afterEach(() => {
        Object.entries(mockTeamDb).forEach((kvp: [string, jest.Mock<any, any>]) => {
            kvp[1].mockClear();
        });
    });

    afterAll(async () => {
        await teamDAO.connection.close();
    });

    it("getAllTeams - should call the db find method once with no args", async () => {
        mockTeamDb.find.mockReturnValueOnce([testTeam1.parse(), testTeam2.parse()]);
        const defaultOpts = {order: {id: "ASC"}};
        const res = await teamDAO.getAllTeams();

        expect(mockTeamDb.find).toHaveBeenCalledTimes(1);
        expect(mockTeamDb.find).toHaveBeenCalledWith(defaultOpts);
        expect(res).toEqual([testTeam1, testTeam2]);
    });

    it("getTeamById - should throw NotFoundError if no id is passed", async () => {
        // @ts-ignore
        await expect(teamDAO.getTeamById(undefined)).rejects.toThrow(NotFoundError);
        expect(mockTeamDb.findOneOrFail).toHaveBeenCalledTimes(0);
    });

    it("getTeamById - should call the db findOneOrFail once with id", async () => {
        mockTeamDb.findOneOrFail.mockReturnValueOnce(testTeam1.parse());
        const res = await teamDAO.getTeamById(1);

        expect(mockTeamDb.findOneOrFail).toHaveBeenCalledTimes(1);
        expect(mockTeamDb.findOneOrFail).toHaveBeenCalledWith(1);
        expect(res).toEqual(testTeam1);
    });

    it("findTeam - should call the db find once with query", async () => {
        mockTeamDb.find.mockReturnValueOnce([testTeam1.parse()]);
        const res = await teamDAO.findTeams({espnId: 1});

        expect(mockTeamDb.find).toHaveBeenCalledTimes(1);
        expect(mockTeamDb.find).toHaveBeenCalledWith({where: {espnId: 1}});
        expect(res).toEqual([testTeam1]);
    });

    it("createTeam - should call the db save once with teamObj", async () => {
        mockTeamDb.save.mockReturnValueOnce(testTeam1.parse());
        const res = await teamDAO.createTeam(testTeam1.parse());

        expect(mockTeamDb.save).toHaveBeenCalledTimes(1);
        expect(mockTeamDb.save).toHaveBeenCalledWith(testTeam1.parse());
        expect(res).toEqual(testTeam1);
    });

    it("updateTeam - should call the db update and findOneOrFail once with id and teamObj", async () => {
        mockTeamDb.findOneOrFail.mockReturnValueOnce(testTeam1.parse());
        const res = await teamDAO.updateTeam(1, testTeam1.parse());

        expect(mockTeamDb.update).toHaveBeenCalledTimes(1);
        expect(mockTeamDb.update).toHaveBeenCalledWith({id: 1}, testTeam1.parse());
        expect(mockTeamDb.findOneOrFail).toHaveBeenCalledTimes(1);
        expect(mockTeamDb.findOneOrFail).toHaveBeenCalledWith(1);
        expect(res).toEqual(testTeam1);
    });

    it("deleteTeam - should call the db delete once with id", async () => {
        const deleteResult = { raw: [ [], 1 ]};
        mockTeamDb.delete.mockReturnValueOnce(deleteResult);
        const res = await teamDAO.deleteTeam(1);

        expect(mockTeamDb.findOneOrFail).toHaveBeenCalledTimes(1);
        expect(mockTeamDb.findOneOrFail).toHaveBeenCalledWith(1);
        expect(mockTeamDb.delete).toHaveBeenCalledTimes(1);
        expect(mockTeamDb.delete).toHaveBeenCalledWith(1);
        expect(res).toEqual(deleteResult);
    });

    it("deleteTeam - should throw NotFoundError if no id is passed", async () => {
        // @ts-ignore
        await expect(teamDAO.deleteTeam(undefined)).rejects.toThrow(NotFoundError);
        expect(mockTeamDb.delete).toHaveBeenCalledTimes(0);
    });

    it("updateOwners - should call the db createQueryBuilder and findOneOrFail with id and owner objects", async () => {
        const addAndRemove = jest.fn();
        const of = jest.fn(() => ({addAndRemove}));
        const relation = jest.fn(() => ({of}));
        mockTeamDb.createQueryBuilder.mockImplementationOnce(() => ({ relation }));
        mockTeamDb.findOneOrFail.mockReturnValue(testTeam1.parse());
        const res = await teamDAO.updateTeamOwners(
            1,
            [new User({email: "1@example.com"})], [new User({email: "2@example.com"})]);

        expect(mockTeamDb.createQueryBuilder).toHaveBeenCalledTimes(1);
        expect(mockTeamDb.createQueryBuilder).toHaveBeenCalledWith();
        expect(mockTeamDb.findOneOrFail).toHaveBeenCalledTimes(2);
        expect(mockTeamDb.findOneOrFail).toHaveBeenCalledWith(1);
        expect(res).toEqual(testTeam1);
    });

    it("getTeamsByOwnerStatus - should call the db createQueryBuilder with the correct methods", async () => {
        const getMany = jest.fn(() => [testTeam1.parse()]);
        const where = jest.fn(() => ({ getMany }));
        const leftJoinAndSelect = jest.fn(() => ({ where }));
        mockTeamDb.createQueryBuilder.mockImplementation(() => ({ leftJoinAndSelect }));

        const resTrue = await teamDAO.getTeamsByOwnerStatus(true);
        expect(mockTeamDb.createQueryBuilder).toHaveBeenCalledTimes(1);
        expect(mockTeamDb.createQueryBuilder).toHaveBeenCalledWith("team");
        expect(where).toHaveBeenLastCalledWith('owner."teamId" IS NOT NULL');
        expect(resTrue).toEqual([testTeam1]);

        const resFalse = await teamDAO.getTeamsByOwnerStatus(false);
        expect(mockTeamDb.createQueryBuilder).toHaveBeenCalledTimes(2);
        expect(mockTeamDb.createQueryBuilder).toHaveBeenCalledWith("team");
        expect(where).toHaveBeenLastCalledWith('owner."teamId" IS NULL');
        expect(resFalse).toEqual([testTeam1]);
    });
});
