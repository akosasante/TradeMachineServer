import "jest";
import "jest-extended";
import { EntityNotFoundError } from "typeorm/error/EntityNotFoundError";
import TeamController from "../../../../src/api/routes/TeamController";
import TeamDAO from "../../../../src/DAO/TeamDAO";
import Team from "../../../../src/models/team";
import User from "../../../../src/models/user";

describe("TeamController", () => {
    const mockTeamDAO = {
        getAllTeams: jest.fn(),
        getTeamById: jest.fn(),
        findTeam: jest.fn(),
        createTeam: jest.fn(),
        updateTeam: jest.fn(),
        deleteTeam: jest.fn(),
    };
    const testUser = new User({id: 1, name: "Jatheesh", password: "pswd", userIdToken: "ra-ndom-string"});
    const testTeam = new Team({name: "Squirtle Squad", espnId: 209, owners: [testUser.publicUser]});
    const teamController = new TeamController(mockTeamDAO as unknown as TeamDAO);

    afterEach(() => {
        mockTeamDAO.getAllTeams.mockClear();
        mockTeamDAO.getTeamById.mockClear();
        mockTeamDAO.findTeam.mockClear();
        mockTeamDAO.createTeam.mockClear();
        mockTeamDAO.updateTeam.mockClear();
        mockTeamDAO.deleteTeam.mockClear();
    });

    describe("getAllTeams method", () => {
        it("should return an array of teams", async () => {
            mockTeamDAO.getAllTeams.mockReturnValue([testTeam]);
            const res = await teamController.getAllTeams();

            expect(mockTeamDAO.getAllTeams).toHaveBeenCalledTimes(1);
            expect(mockTeamDAO.getAllTeams).toHaveBeenCalledWith();
            expect(res).toEqual([testTeam.publicTeam]);
        });
        it("should throw bubble up any errors from the DAO", async () => {
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
        it("should throw bubble up any errors from the DAO", async () => {
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
            mockTeamDAO.deleteTeam.mockReturnValue({raw: [ [], testTeam.id ]});
            const res = await teamController.deleteTeam(testTeam.id!);

            expect(mockTeamDAO.deleteTeam).toHaveBeenCalledTimes(1);
            expect(mockTeamDAO.deleteTeam).toHaveBeenCalledWith(testTeam.id);
        });
        it("should throw an error if entity is not found in db", async () => {
            mockTeamDAO.deleteTeam.mockImplementation(() => {
                throw new EntityNotFoundError(Team, "ID not found.");
            });
            await expect(teamController.deleteTeam(9999))
                .rejects.toThrow(EntityNotFoundError);
        });
    });
});
