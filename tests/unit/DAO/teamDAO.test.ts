import logger from "../../../src/bootstrap/logger";
import TeamDAO from "../../../src/DAO/TeamDAO";
import User from "../../../src/models/user";
import { TeamFactory } from "../../factories/TeamFactory";
import { mockDeleteChain, mockExecute, mockWhereInIds } from "./daoHelpers";
import Team from "../../../src/models/team";
import { Repository } from "typeorm";
import { mockDeep } from "jest-mock-extended";

describe("TeamDAO", () => {
    const mockTeamDb = mockDeep<Repository<Team>>();
    const testTeam = TeamFactory.getTeam();
    const teamDAO = new TeamDAO(mockTeamDb as any);

    afterEach(() => {
        jest.clearAllMocks();
        mockExecute.mockClear();
        mockWhereInIds.mockClear();
    });

    beforeAll(() => {
        logger.debug("~~~~~~TEAM DAO TESTS BEGIN~~~~~~");
    });
    afterAll(() => {
        logger.debug("~~~~~~TEAM DAO TESTS COMPLETE~~~~~~");
    });

    it("getAllTeams - should call the db find method once with option args", async () => {
        mockTeamDb.find.mockResolvedValueOnce([testTeam]);
        const defaultOpts = { order: { id: "ASC" } };
        const res = await teamDAO.getAllTeams();

        expect(mockTeamDb.find).toHaveBeenCalledTimes(1);
        expect(mockTeamDb.find).toHaveBeenCalledWith(defaultOpts);
        expect(res).toEqual([testTeam]);
    });

    it("getTeamsWithOwners - should call createQueryBuilder with the correct methods", async () => {
        const getMany = jest.fn(() => [testTeam]);
        const innerJoin = jest.fn(() => ({ getMany }));
        mockTeamDb.createQueryBuilder.mockImplementation(() => ({ innerJoinAndSelect: innerJoin } as any));
        const res = await teamDAO.getTeamsWithOwners();

        expect(mockTeamDb.createQueryBuilder).toHaveBeenCalledTimes(1);
        expect(mockTeamDb.createQueryBuilder).toHaveBeenCalledWith("team");
        expect(innerJoin).toHaveBeenCalledWith("team.owners", "owners");
        expect(res).toEqual([testTeam]);
    });

    it("getTeamsWithNoOwners - should call createQueryBuilder with the correct methods", async () => {
        const getMany = jest.fn(() => [testTeam]);
        const where = jest.fn(() => ({ getMany }));
        const leftJoinAndSelect = jest.fn(() => ({ where }));
        mockTeamDb.createQueryBuilder.mockImplementation(() => ({ leftJoinAndSelect } as any));
        const res = await teamDAO.getTeamsWithNoOwners();

        expect(mockTeamDb.createQueryBuilder).toHaveBeenCalledTimes(1);
        expect(mockTeamDb.createQueryBuilder).toHaveBeenCalledWith("team");
        expect(leftJoinAndSelect).toHaveBeenCalledWith("team.owners", "owners");
        expect(where).toHaveBeenCalledWith("owners IS NULL");
        expect(res).toEqual([testTeam]);
    });

    it("getTeamById - should call the db findOneOrFail once with id", async () => {
        mockTeamDb.findOneOrFail.mockResolvedValueOnce(testTeam);
        const res = await teamDAO.getTeamById(testTeam.id!);

        expect(mockTeamDb.findOneOrFail).toHaveBeenCalledTimes(1);
        expect(mockTeamDb.findOneOrFail).toHaveBeenCalledWith({ where: { id: testTeam.id } });
        expect(res).toEqual(testTeam);
    });

    it("findTeams - should call the db find once with query", async () => {
        const condition = { espnId: 1 };
        mockTeamDb.find.mockResolvedValueOnce([testTeam]);
        const res = await teamDAO.findTeams(condition);

        expect(mockTeamDb.find).toHaveBeenCalledTimes(1);
        expect(mockTeamDb.find).toHaveBeenCalledWith({ where: condition });
        expect(res).toEqual([testTeam]);
    });

    it("createTeams - should call the db save once with all the teams passed in", async () => {
        const parsedTeam = testTeam.parse();
        mockTeamDb.create.mockReturnValue(testTeam);
        mockTeamDb.save.mockResolvedValueOnce([testTeam] as unknown as Team);
        const res = await teamDAO.createTeams([parsedTeam]);

        expect(mockTeamDb.create).toHaveBeenCalledTimes(1);
        expect(mockTeamDb.create).toHaveBeenCalledWith(parsedTeam);
        expect(mockTeamDb.save).toHaveBeenCalledTimes(1);
        expect(mockTeamDb.save).toHaveBeenCalledWith([testTeam]);
        expect(res).toEqual([testTeam]);
    });

    it("updateTeam - should call the db update and findOneOrFail once with id and teamObj", async () => {
        mockTeamDb.findOneOrFail.mockResolvedValueOnce(testTeam);
        const res = await teamDAO.updateTeam(testTeam.id!, testTeam.parse());

        expect(mockTeamDb.update).toHaveBeenCalledTimes(1);
        expect(mockTeamDb.update).toHaveBeenCalledWith({ id: testTeam.id }, testTeam.parse());
        expect(mockTeamDb.findOneOrFail).toHaveBeenCalledTimes(1);
        expect(mockTeamDb.findOneOrFail).toHaveBeenCalledWith({ where: { id: testTeam.id } });
        expect(res).toEqual(testTeam);
    });

    it("deleteTeam - should call the db delete once with id", async () => {
        mockTeamDb.findOneOrFail.mockResolvedValueOnce(testTeam);
        mockTeamDb.createQueryBuilder.mockReturnValueOnce(mockDeleteChain as any);
        const deleteResult = { raw: [{ id: testTeam.id! }], affected: 1 };
        mockExecute.mockResolvedValueOnce(deleteResult);
        const res = await teamDAO.deleteTeam(testTeam.id!);

        expect(mockTeamDb.findOneOrFail).toHaveBeenCalledTimes(1);
        expect(mockTeamDb.findOneOrFail).toHaveBeenCalledWith({ where: { id: testTeam.id! } });
        expect(mockTeamDb.createQueryBuilder).toHaveBeenCalledTimes(1);
        expect(mockWhereInIds).toHaveBeenCalledWith(testTeam.id!);
        expect(res).toEqual(deleteResult);
    });

    it("updateTeamOwners - should call the db createQueryBuilder and findOneOrFail with id and owner objects", async () => {
        const addAndRemove = jest.fn();
        const of = jest.fn(() => ({ addAndRemove }));
        const relation = jest.fn(() => ({ of }));
        mockTeamDb.createQueryBuilder.mockImplementationOnce(() => ({ relation } as any));
        mockTeamDb.findOneOrFail.mockResolvedValue(testTeam);
        const res = await teamDAO.updateTeamOwners(
            testTeam.id!,
            [new User({ email: "1@example.com" })],
            [new User({ email: "2@example.com" })]
        );

        expect(mockTeamDb.createQueryBuilder).toHaveBeenCalledTimes(1);
        expect(mockTeamDb.createQueryBuilder).toHaveBeenCalledWith();
        expect(mockTeamDb.findOneOrFail).toHaveBeenCalledTimes(2);
        expect(mockTeamDb.findOneOrFail).toHaveBeenCalledWith({ where: { id: testTeam.id } });
        expect(res).toEqual(testTeam);
    });
});
