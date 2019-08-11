import "jest";
import "jest-extended";
import { EntityNotFoundError } from "typeorm/error/EntityNotFoundError";
import TeamController from "../../../../src/api/routes/TeamController";
import TeamDAO from "../../../../src/DAO/TeamDAO";
import Team from "../../../../src/models/team";
import User from "../../../../src/models/user";
import { TeamFactory } from "../../../factories/TeamFactory";
import { UserFactory } from "../../../factories/UserFactory";

describe("TeamController", () => {
    const mockTeamDAO = {
        getAllTeams: jest.fn(),
        getTeamById: jest.fn(),
        findTeams: jest.fn(),
        createTeam: jest.fn(),
        updateTeam: jest.fn(),
        deleteTeam: jest.fn(),
        updateTeamOwners: jest.fn(),
        getTeamsByOwnerStatus: jest.fn(),
    };
    const testUser = UserFactory.getUser(undefined, undefined, undefined, {id: 1});
    const testTeam = TeamFactory.getTeam(undefined, undefined, {owners: [testUser.publicUser]});
    const teamController = new TeamController(mockTeamDAO as unknown as TeamDAO);

    afterEach(() => {
        Object.entries(mockTeamDAO).forEach((kvp: [string, jest.Mock<any, any>]) => {
            kvp[1].mockClear();
        });
    });

    describe("getAllTeams method", () => {
        it("should return an array of teams if no hasOwner param is passed", async () => {
            mockTeamDAO.getAllTeams.mockReturnValue([testTeam]);
            const res = await teamController.getAllTeams();

            expect(mockTeamDAO.getAllTeams).toHaveBeenCalledTimes(1);
            expect(mockTeamDAO.getAllTeams).toHaveBeenCalledWith();
            expect(res).toEqual([testTeam.publicTeam]);
        });
        it("should call the getTeamsByOwners DAO method with true if that param passed", async () => {
            mockTeamDAO.getTeamsByOwnerStatus.mockReturnValue([testTeam]);
            const res = await teamController.getAllTeams("true");

            expect(mockTeamDAO.getTeamsByOwnerStatus).toHaveBeenCalledTimes(1);
            expect(mockTeamDAO.getTeamsByOwnerStatus).toHaveBeenCalledWith(true);
            expect(res).toEqual([testTeam.publicTeam]);
        });
        it("should call the getTeamsByOwnerStatus DAO method with false if that param passed", async () => {
            mockTeamDAO.getTeamsByOwnerStatus.mockReturnValue([testTeam]);
            const res = await teamController.getAllTeams("false");

            expect(mockTeamDAO.getTeamsByOwnerStatus).toHaveBeenCalledTimes(1);
            expect(mockTeamDAO.getTeamsByOwnerStatus).toHaveBeenCalledWith(false);
            expect(res).toEqual([testTeam.publicTeam]);
        });
        it("should bubble up any errors from the DAO", async () => {
            mockTeamDAO.getAllTeams.mockImplementation(() => {
                throw new Error("Generic Error");
            });
            await expect(teamController.getAllTeams())
                .rejects.toThrow(Error);
        });
    });
    describe("getOneTeam method", () => {
        it("should return a team by id", async () => {
            mockTeamDAO.getTeamById.mockReturnValue(testTeam);
            const res = await teamController.getOneTeam(testTeam.id!);

            expect(mockTeamDAO.getTeamById).toHaveBeenCalledTimes(1);
            expect(mockTeamDAO.getTeamById).toHaveBeenCalledWith(testTeam.id);
            expect(res).toEqual(testTeam.publicTeam);
        });
        it("should throw an error if entity is not found in db", async () => {
            mockTeamDAO.getTeamById.mockImplementation(() => {
                throw new EntityNotFoundError(Team, "ID not found.");
            });
            await expect(teamController.getOneTeam(9999))
                .rejects.toThrow(EntityNotFoundError);
        });
    });
    describe("createTeam method", () => {
        it("should create a team", async () => {
            mockTeamDAO.createTeam.mockReturnValue(testTeam);
            const res = await teamController.createTeam(testTeam.parse());

            expect(mockTeamDAO.createTeam).toHaveBeenCalledTimes(1);
            expect(mockTeamDAO.createTeam).toHaveBeenCalledWith(testTeam.parse());
            expect(res).toEqual(testTeam.publicTeam);
        });
        it("should bubble up any errors from the DAO", async () => {
            mockTeamDAO.createTeam.mockImplementation(() => {
                throw new Error("Generic Error");
            });
            await expect(teamController.createTeam(testTeam.parse()))
                .rejects.toThrow(Error);
        });
    });
    describe("updateTeam method", () => {
        it("should return updated team with the given id", async () => {
            mockTeamDAO.updateTeam.mockReturnValue(testTeam);
            const res = await teamController.updateTeam(testTeam.id!, testTeam.parse());

            expect(mockTeamDAO.updateTeam).toHaveBeenCalledTimes(1);
            expect(mockTeamDAO.updateTeam).toHaveBeenCalledWith(testTeam.id, testTeam.parse());
            expect(res).toEqual(testTeam.publicTeam);
        });
        it("should throw an error if entity is not found in db", async () => {
            mockTeamDAO.updateTeam.mockImplementation(() => {
                throw new EntityNotFoundError(Team, "ID not found.");
            });
            await expect(teamController.updateTeam(9999, testTeam.parse()))
                .rejects.toThrow(EntityNotFoundError);
        });
    });
    describe("deleteTeam method", () => {
        it("should delete a team by id from the db", async () => {
            mockTeamDAO.deleteTeam.mockReturnValue({raw: [ {id: testTeam.id} ], affected: 1});
            const res = await teamController.deleteTeam(testTeam.id!);

            expect(mockTeamDAO.deleteTeam).toHaveBeenCalledTimes(1);
            expect(mockTeamDAO.deleteTeam).toHaveBeenCalledWith(testTeam.id);
            expect(res).toEqual({deleteCount: 1, id: testTeam.id});
        });
        it("should throw an error if entity is not found in db", async () => {
            mockTeamDAO.deleteTeam.mockImplementation(() => {
                throw new EntityNotFoundError(Team, "ID not found.");
            });
            await expect(teamController.deleteTeam(9999))
                .rejects.toThrow(EntityNotFoundError);
        });
    });
    describe("findTeamsByQuery method", () => {
        const query = {espnId: 1};
        it("should find teams by the given query options", async () => {
            mockTeamDAO.findTeams.mockReturnValue([testTeam]);
            const res = await teamController.findTeamsByQuery(query);

            expect(mockTeamDAO.findTeams).toHaveBeenCalledTimes(1);
            expect(mockTeamDAO.findTeams).toHaveBeenCalledWith(query);
            expect(res).toEqual([testTeam]);
        });
        it("should throw an error if entity is not found in db", async () => {
            mockTeamDAO.findTeams.mockImplementation(() => {
                throw new EntityNotFoundError(Team, "ID not found.");
            });
            await expect(teamController.findTeamsByQuery(query)).rejects.toThrow(EntityNotFoundError);
        });
    });
    describe("updateTeamOwners method", () => {
        const user1 = new User({email: "usr1@test.com"});
        const user2 = new User({email: "usr2@test.com"});

        it("should update a teams owners as provided", async () => {
            mockTeamDAO.updateTeamOwners.mockReturnValue(testTeam);
            const res = await teamController.updateTeamOwners(testTeam.id!, [user1], [user2]);

            expect(mockTeamDAO.updateTeamOwners).toHaveBeenCalledTimes(1);
            expect(mockTeamDAO.updateTeamOwners).toHaveBeenCalledWith(testTeam.id, [user1], [user2]);
            expect(res).toEqual(testTeam);
        });
        it("should throw an error if entity is not found in db", async () => {
            mockTeamDAO.updateTeamOwners.mockImplementation(() => {
                throw new EntityNotFoundError(Team, "ID not found.");
            });
            await expect(teamController.updateTeamOwners(999, [user1], [user2])).rejects.toThrow(EntityNotFoundError);
        });
    });
});
