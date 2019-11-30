import "jest";
import "jest-extended";
import { NotFoundError } from "routing-controllers";
import { EntityNotFoundError } from "typeorm/error/EntityNotFoundError";
import UserController from "../../../../src/api/routes/UserController";
import UserDAO from "../../../../src/DAO/UserDAO";
import User from "../../../../src/models/user";
import { UserFactory } from "../../../factories/UserFactory";

describe("UserController", () => {
    const mockUserDAO = {
        getAllUsers: jest.fn(),
        getAllUsersWithTeams: jest.fn(),
        getUserById: jest.fn(),
        findUser: jest.fn(),
        findUsers: jest.fn(),
        // getUserByUUID: jest.fn(),
        // createUser: jest.fn(),
        // updateUser: jest.fn(),
        // deleteUser: jest.fn(),
    };
    const userController = new UserController(mockUserDAO as unknown as UserDAO);
    const testUser = UserFactory.getUser("j@gm.com", "Jatheesh", undefined, undefined, {id: "d4e3fe52-1b18-4cb6-96b1-600ed86ec45b"});
    const testUserModel = testUser.toUserModel();

    afterEach(() => {
        Object.entries(mockUserDAO).forEach((kvp: [string, jest.Mock<any, any>]) => {
            kvp[1].mockClear();
        });
    });

    describe("getAll method", () => {
        it("should return an array of user models", async () => {
            mockUserDAO.getAllUsers.mockReturnValue([testUserModel]);
            const res = await userController.getAll();

            // Testing that the correct dao function is called and with the correct params
            expect(mockUserDAO.getAllUsers).toHaveBeenCalledTimes(1);
            expect(mockUserDAO.getAllUsers).toHaveBeenCalledWith();

            // Testing that the return value from the controller method is as expected
            expect(res).toEqual([testUserModel]);
        });
        it("should call the getAll method if 'full' param is false", async () => {
            mockUserDAO.getAllUsers.mockReturnValue([testUserModel]);
            await userController.getAll(false);

            expect(mockUserDAO.getAllUsers).toHaveBeenCalledTimes(1);
            expect(mockUserDAO.getAllUsers).toHaveBeenCalledWith();
        });
        it("should call the getAllWithTeams method if 'full' param is true", async () => {
            mockUserDAO.getAllUsersWithTeams.mockReturnValue([testUserModel]);
            const res = await userController.getAll(true);

            expect(mockUserDAO.getAllUsersWithTeams).toHaveBeenCalledTimes(1);
            expect(mockUserDAO.getAllUsersWithTeams).toHaveBeenCalledWith();
            expect(res).toEqual([testUserModel]);
        });
    });

    describe("getById method", () => {
        it("should return a user model by id", async () => {
            mockUserDAO.getUserById.mockReturnValue(testUserModel);
            const res = await userController.getById(testUser.id!);

            // Must call the correct DAO method
            expect(mockUserDAO.getUserById).toHaveBeenCalledTimes(1);
            expect(mockUserDAO.getUserById).toHaveBeenCalledWith(testUser.id!);
            
            expect(res).toEqual(testUserModel);
        });
    });

    describe("findUser method", () => {
        const query: {[key: string]: string} = { name: "Jatheesh" };
        it("should find a user by the given query options", async () => {
            mockUserDAO.findUser.mockReturnValueOnce(testUserModel);
            // @ts-ignore
            const res = await userController.findUser(query, undefined);

            expect(mockUserDAO.findUser).toHaveBeenCalledTimes(1);
            expect(mockUserDAO.findUser).toHaveBeenCalledWith(query, true);
            
            expect(res).toEqual(testUserModel);
        });
        it("should return an array of users if multiple is a key in the query", async () => {
            mockUserDAO.findUsers.mockReturnValueOnce([testUserModel]);
            const res = await userController.findUser(query, true);

            expect(mockUserDAO.findUsers).toHaveBeenCalledTimes(1);
            expect(mockUserDAO.findUsers).toHaveBeenCalledWith(query);
            
            expect(res).toEqual([testUserModel]);
        });
        it("should throw an error if no entities are found with the multiple key", async () => {
            mockUserDAO.findUsers.mockReturnValueOnce([]);
            const res = userController.findUser(query, true);

            expect(mockUserDAO.findUsers).toHaveBeenCalledTimes(1);
            expect(mockUserDAO.findUsers).toHaveBeenCalledWith(query);

            await expect(res).rejects.toThrowError(NotFoundError);
        });
    });
    //
    // describe("createUser method", () => {
    //     it("should create a user", async () => {
    //         mockUserDAO.createUser.mockReturnValue(testUser);
    //         const res = await userController.createUser(testUser.parse());
    //
    //         expect(mockUserDAO.createUser).toHaveBeenCalledTimes(1);
    //         expect(mockUserDAO.createUser).toHaveBeenCalledWith(testUser.parse());
    //         expect(res).toEqual(testUser.publicUser);
    //     });
    //     it("should throw an error", async () => {
    //         mockUserDAO.createUser.mockImplementation(() => {
    //             // TODO: This should be an error we would expect from this route; just for clarity's sake
    //             throw new Error("Generic Error");
    //         });
    //         await expect(userController.createUser(testUser.parse())).rejects.toThrow(Error);
    //     });
    // });
    //
    // describe("updateUser method", () => {
    //     it("should return updated user with the given id", async () => {
    //         mockUserDAO.updateUser.mockReturnValue(testUser);
    //         const res = await userController.updateUser(testUser.id!, testUser.parse());
    //
    //         expect(mockUserDAO.updateUser).toBeCalledTimes(1);
    //         expect(mockUserDAO.updateUser).toBeCalledWith(testUser.id!, testUser.parse());
    //         expect(res).toEqual(testUser.publicUser);
    //     });
    //     it("should throw an error", async () => {
    //         mockUserDAO.updateUser.mockImplementation(() => {
    //             throw new EntityNotFoundError(User, "Id not found.");
    //         });
    //         await expect(userController.updateUser(9999, testUser.parse()))
    //             .rejects.toThrow(EntityNotFoundError);
    //     });
    // });
    //
    // describe("deleteUser method", () => {
    //     it("should delete a user by id", async () => {
    //         mockUserDAO.deleteUser.mockReturnValue({raw: [{id: testUser.id!}], affected: 1});
    //         const res = await userController.deleteUser(testUser.id!);
    //
    //         expect(mockUserDAO.deleteUser).toBeCalledTimes(1);
    //         expect(mockUserDAO.deleteUser).toBeCalledWith(testUser.id!);
    //         expect(res).toEqual({deleteCount: 1, id: testUser.id});
    //     });
    //     it("should throw an error", async () => {
    //         mockUserDAO.deleteUser.mockImplementation(() => {
    //             throw new EntityNotFoundError(User, "Id not found.");
    //         });
    //         await expect(userController.deleteUser(9999))
    //             .rejects.toThrow(EntityNotFoundError);
    //     });
    // });
});
