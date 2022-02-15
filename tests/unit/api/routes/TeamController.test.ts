import { BadRequestError, NotFoundError } from "routing-controllers";
import TeamController from "../../../../src/api/routes/TeamController";
import logger from "../../../../src/bootstrap/logger";
import TeamDAO from "../../../../src/DAO/TeamDAO";
import User from "../../../../src/models/user";
import { TeamFactory } from "../../../factories/TeamFactory";

describe("TeamController", () => {
    const mockTeamDAO = {
        getAllTeams: jest.fn(),
        getTeamsWithOwners: jest.fn(),
        getTeamsWithNoOwners: jest.fn(),
        getTeamById: jest.fn(),
        findTeams: jest.fn(),
        createTeams: jest.fn(),
        updateTeam: jest.fn(),
        deleteTeam: jest.fn(),
        updateTeamOwners: jest.fn(),
    };
    const testTeam = TeamFactory.getTeam();
    const teamController = new TeamController(mockTeamDAO as unknown as TeamDAO);

    beforeAll(() => {
        logger.debug("~~~~~~TEAM CONTROLLER TESTS BEGIN~~~~~~");
    });
    afterAll(() => {
        logger.debug("~~~~~~TEAM CONTROLLER TESTS COMPLETE~~~~~~");
    });
    afterEach(() => {
        Object.values(mockTeamDAO).forEach(mockFn => mockFn.mockReset());
    });

    describe("getAllTeams method", () => {
        it("should return an array of teams if no hasOwner param is passed", async () => {
            mockTeamDAO.getAllTeams.mockResolvedValueOnce([testTeam]);
            const res = await teamController.getAllTeams();

            expect(mockTeamDAO.getAllTeams).toHaveBeenCalledTimes(1);
            expect(mockTeamDAO.getAllTeams).toHaveBeenCalledWith();

            expect(res).toEqual([testTeam]);
        });
        it("should call the getTeamsWithOwners DAO method if hasOwners query param is true", async () => {
            mockTeamDAO.getTeamsWithOwners.mockReturnValue([testTeam]);
            const res = await teamController.getAllTeams("true");

            expect(mockTeamDAO.getTeamsWithOwners).toHaveBeenCalledTimes(1);
            expect(mockTeamDAO.getTeamsWithOwners).toHaveBeenCalledWith();
            expect(res).toEqual([testTeam]);
        });
        it("should call the getTeamsWithNoOwners DAO method if hasOwners query param is false", async () => {
            mockTeamDAO.getTeamsWithNoOwners.mockReturnValue([testTeam]);
            const res = await teamController.getAllTeams("false");

            expect(mockTeamDAO.getTeamsWithNoOwners).toHaveBeenCalledTimes(1);
            expect(mockTeamDAO.getTeamsWithNoOwners).toHaveBeenCalledWith();
            expect(res).toEqual([testTeam]);
        });
        it("should throw an error if invalid query param is passed in", async () => {
            await expect(teamController.getAllTeams("fsdfjslkdfj")).rejects.toThrow(BadRequestError);
        });
    });

    describe("getOneTeam method", () => {
        it("should return a team by id", async () => {
            mockTeamDAO.getTeamById.mockReturnValue(testTeam);
            const res = await teamController.getOneTeam(testTeam.id!);

            expect(mockTeamDAO.getTeamById).toHaveBeenCalledTimes(1);
            expect(mockTeamDAO.getTeamById).toHaveBeenCalledWith(testTeam.id);
            expect(res).toEqual(testTeam);
        });
    });

    describe("findTeamsByQuery method", () => {
        const query = { espnId: 1 };
        it("should find teams by the given query options", async () => {
            mockTeamDAO.findTeams.mockReturnValue([testTeam]);
            const res = await teamController.findTeamsByQuery(query);

            expect(mockTeamDAO.findTeams).toHaveBeenCalledTimes(1);
            expect(mockTeamDAO.findTeams).toHaveBeenCalledWith(query);
            expect(res).toEqual([testTeam]);
        });
        it("should throw an error if no matching teams are found in db", async () => {
            mockTeamDAO.findTeams.mockReturnValue([]);

            await expect(teamController.findTeamsByQuery(query)).rejects.toThrow(NotFoundError);
            expect(mockTeamDAO.findTeams).toHaveBeenCalledTimes(1);
            expect(mockTeamDAO.findTeams).toHaveBeenCalledWith(query);
        });
    });

    describe("createTeam method", () => {
        it("should create a team", async () => {
            mockTeamDAO.createTeams.mockReturnValue([testTeam]);
            const res = await teamController.createTeam([testTeam.parse()]);

            expect(mockTeamDAO.createTeams).toHaveBeenCalledTimes(1);
            expect(mockTeamDAO.createTeams).toHaveBeenCalledWith([testTeam.parse()]);
            expect(res).toEqual([testTeam]);
        });
    });

    describe("updateTeam method", () => {
        it("should return updated team with the given id", async () => {
            mockTeamDAO.updateTeam.mockReturnValue(testTeam);
            const res = await teamController.updateTeam(testTeam.id!, testTeam.parse());

            expect(mockTeamDAO.updateTeam).toHaveBeenCalledTimes(1);
            expect(mockTeamDAO.updateTeam).toHaveBeenCalledWith(testTeam.id, testTeam.parse());
            expect(res).toEqual(testTeam);
        });
    });

    describe("deleteTeam method", () => {
        it("should delete a team by id from the db", async () => {
            mockTeamDAO.deleteTeam.mockReturnValue({ raw: [{ id: testTeam.id }], affected: 1 });
            const res = await teamController.deleteTeam(testTeam.id!);

            expect(mockTeamDAO.deleteTeam).toHaveBeenCalledTimes(1);
            expect(mockTeamDAO.deleteTeam).toHaveBeenCalledWith(testTeam.id);
            expect(res).toEqual({ deleteCount: 1, id: testTeam.id });
        });
    });

    describe("updateTeamOwners method", () => {
        const user1 = new User({ email: "usr1@test.com" });
        const user2 = new User({ email: "usr2@test.com" });

        it("should update a teams owners as provided", async () => {
            mockTeamDAO.updateTeamOwners.mockReturnValue(testTeam);
            const res = await teamController.updateTeamOwners(testTeam.id!, [user1], [user2]);

            expect(mockTeamDAO.updateTeamOwners).toHaveBeenCalledTimes(1);
            expect(mockTeamDAO.updateTeamOwners).toHaveBeenCalledWith(testTeam.id, [user1], [user2]);
            expect(res).toEqual(testTeam);
        });
    });
});
