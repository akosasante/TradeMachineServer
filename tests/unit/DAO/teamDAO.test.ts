import "jest";
import "jest-extended";
import { NotFoundError } from "routing-controllers";
import * as typeorm from "typeorm";
import TeamDAO from "../../../src/DAO/TeamDAO";
import Team from "../../../src/models/team";

const mockTeamDb = {
    find: jest.fn(),
    findOneOrFail: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
};

// @ts-ignore
jest.spyOn(typeorm, "getConnection").mockReturnValue({ getRepository: jest.fn().mockReturnValue(mockTeamDb) });

describe("TeamDAO", () => {
    let teamDAO: TeamDAO;
    const testTeam1 = new Team({id: 1, name: "Squirtle Squad"});
    const testTeam2 = new Team({id: 2, name: "Flex Fox's Team"});

    beforeAll(() => {
        teamDAO = new TeamDAO();
    });

    afterEach(() => {
        mockTeamDb.delete.mockClear();
        mockTeamDb.findOneOrFail.mockClear();
        mockTeamDb.find.mockClear();
        mockTeamDb.save.mockClear();
        mockTeamDb.update.mockClear();
    });

    afterAll(async () => {
        await teamDAO.connection.close();
    });

    it("getAllTeams - should call the db find method once with no args", async () => {
        mockTeamDb.find.mockReturnValueOnce([testTeam1.parse(), testTeam2.parse()]);
        const res = await teamDAO.getAllTeams();

        expect(mockTeamDb.find).toHaveBeenCalledTimes(1);
        expect(mockTeamDb.find).toHaveBeenCalledWith();
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

    it("findTeam - should call the db findOneOrFail once with query", async () => {
        mockTeamDb.findOneOrFail.mockReturnValueOnce(testTeam1.parse());
        const res = await teamDAO.findTeam({espnId: 1});

        expect(mockTeamDb.findOneOrFail).toHaveBeenCalledTimes(1);
        expect(mockTeamDb.findOneOrFail).toHaveBeenCalledWith({where: {espnId: 1}});
        expect(res).toEqual(testTeam1);
    });

    it("createTeam - should call the db save once with teamObj", async () => {
        mockTeamDb.save.mockReturnValueOnce(testTeam1.parse());
        const res = await teamDAO.createTeam(testTeam1.parse());

        expect(mockTeamDb.save).toHaveBeenCalledTimes(1);
        expect(mockTeamDb.save).toHaveBeenCalledWith(testTeam1.parse());
        expect(res).toEqual(testTeam1);
    });

    it("updateTeam - should call the db update once with id and teamObj", async () => {
        mockTeamDb.findOneOrFail.mockReturnValueOnce(testTeam1.parse());
        const res = await teamDAO.updateTeam(1, testTeam1.parse());

        expect(mockTeamDb.update).toHaveBeenCalledTimes(1);
        expect(mockTeamDb.update).toHaveBeenCalledWith({id: 1}, testTeam1.parse());
        expect(mockTeamDb.findOneOrFail).toHaveBeenCalledTimes(1);
        expect(mockTeamDb.findOneOrFail).toHaveBeenCalledWith(1);
        expect(res).toEqual(testTeam1);
    });

    it("deleteTeam - should throw NotFoundError if no id is passed", async () => {
        await teamDAO.deleteTeam(1);

        expect(mockTeamDb.findOneOrFail).toHaveBeenCalledTimes(1);
        expect(mockTeamDb.findOneOrFail).toHaveBeenCalledWith(1);
        expect(mockTeamDb.delete).toHaveBeenCalledTimes(1);
        expect(mockTeamDb.delete).toHaveBeenCalledWith(1);
    });
});
