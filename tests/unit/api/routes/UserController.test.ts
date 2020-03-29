import "jest";
import "jest-extended";
import { NotFoundError } from "routing-controllers";
import UserController from "../../../../src/api/routes/UserController";
import logger from "../../../../src/bootstrap/logger";
import UserDAO from "../../../../src/DAO/UserDAO";
import { UserFactory } from "../../../factories/UserFactory";
import { MockObj } from "../../DAO/daoHelpers";

describe("UserController", () => {
    const mockUserDAO: MockObj = {
        getAllUsers: jest.fn(),
        getAllUsersWithTeams: jest.fn(),
        getUserById: jest.fn(),
        findUser: jest.fn(),
        findUsers: jest.fn(),
        createUsers: jest.fn(),
        updateUser: jest.fn(),
        deleteUser: jest.fn(),
    };
    const userController = new UserController(mockUserDAO as unknown as UserDAO);
    const testUser = UserFactory.getUser("j@gm.com", "Jatheesh");

    beforeAll(() => {
        logger.debug("~~~~~~USER CONTROLLER TESTS BEGIN~~~~~~");
    });
    afterAll(() => {
        logger.debug("~~~~~~USER CONTROLLER TESTS COMPLETE~~~~~~");
    });
    afterEach(() => {
        Object.entries(mockUserDAO).forEach((kvp: [string, jest.Mock<any, any>]) => {
            kvp[1].mockClear();
        });
    });

    describe("getAll method", () => {
        it("should return an array of user models", async () => {
            mockUserDAO.getAllUsers.mockReturnValue([testUser]);
            const res = await userController.getAll();

            expect(mockUserDAO.getAllUsers).toHaveBeenCalledTimes(1);
            expect(mockUserDAO.getAllUsers).toHaveBeenCalledWith();

            expect(res).toEqual([testUser]);
        });
        it("should call the getAll method if 'full' param is false", async () => {
            mockUserDAO.getAllUsers.mockReturnValue([testUser]);
            await userController.getAll(false);

            expect(mockUserDAO.getAllUsers).toHaveBeenCalledTimes(1);
            expect(mockUserDAO.getAllUsers).toHaveBeenCalledWith();
        });
        it("should call the getAllWithTeams method if 'full' param is true", async () => {
            mockUserDAO.getAllUsersWithTeams.mockReturnValue([testUser]);
            const res = await userController.getAll(true);

            expect(mockUserDAO.getAllUsersWithTeams).toHaveBeenCalledTimes(1);
            expect(mockUserDAO.getAllUsersWithTeams).toHaveBeenCalledWith();
            expect(res).toEqual([testUser]);
        });
    });

    describe("getById method", () => {
        it("should return a user model by id", async () => {
            mockUserDAO.getUserById.mockReturnValue(testUser);
            const res = await userController.getById(testUser.id!);

            expect(mockUserDAO.getUserById).toHaveBeenCalledTimes(1);
            expect(mockUserDAO.getUserById).toHaveBeenCalledWith(testUser.id!);

            expect(res).toEqual(testUser);
        });
    });

    describe("findUser method", () => {
        const query: string = "name=Jatheesh";
        const expectedQuery = {name: "Jatheesh"};
        it("should find a user by the given query options", async () => {
            mockUserDAO.findUser.mockReturnValueOnce(testUser);
            const res = await userController.findUser(query);

            expect(mockUserDAO.findUser).toHaveBeenCalledTimes(1);
            expect(mockUserDAO.findUser).toHaveBeenCalledWith(expectedQuery, true);

            expect(res).toEqual(testUser);
        });
        it("should return an array of users if multiple is a key in the query", async () => {
            mockUserDAO.findUsers.mockReturnValueOnce([testUser]);
            const res = await userController.findUser(query, true);

            expect(mockUserDAO.findUsers).toHaveBeenCalledTimes(1);
            expect(mockUserDAO.findUsers).toHaveBeenCalledWith(expectedQuery);

            expect(res).toEqual([testUser]);
        });
        it("should throw an error if no entities are found with the multiple key", async () => {
            mockUserDAO.findUsers.mockReturnValueOnce([]);
            const res = userController.findUser(query, true);

            expect(mockUserDAO.findUsers).toHaveBeenCalledTimes(1);
            expect(mockUserDAO.findUsers).toHaveBeenCalledWith(expectedQuery);

            await expect(res).rejects.toThrowError(NotFoundError);
        });
    });

    describe("createUsers method", () => {
        it("should create a user and return array", async () => {
            mockUserDAO.createUsers.mockReturnValue([testUser]);
            const res = await userController.createUsers([testUser.parse()]);

            expect(mockUserDAO.createUsers).toHaveBeenCalledTimes(1);
            expect(mockUserDAO.createUsers).toHaveBeenCalledWith([testUser.parse()]);

            expect(res).toEqual([testUser]);
        });
    });

    describe("updateUser method", () => {
        it("should return updated user with the given id", async () => {
            mockUserDAO.updateUser.mockReturnValue(testUser);
            const res = await userController.updateUser(testUser.id!, testUser.parse());

            expect(mockUserDAO.updateUser).toBeCalledTimes(1);
            expect(mockUserDAO.updateUser).toBeCalledWith(testUser.id!, testUser.parse());

            expect(res).toEqual(testUser);
        });
    });

    describe("deleteUser method", () => {
        it("should delete a user by id", async () => {
            mockUserDAO.deleteUser.mockReturnValue({raw: [{id: testUser.id!}], affected: 1});
            const res = await userController.deleteUser(testUser.id!);

            expect(mockUserDAO.deleteUser).toBeCalledTimes(1);
            expect(mockUserDAO.deleteUser).toBeCalledWith(testUser.id!);

            expect(res).toEqual({deleteCount: 1, id: testUser.id});
        });
    });
});
