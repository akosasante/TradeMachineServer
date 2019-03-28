import "jest";
import "jest-extended";
import { EntityNotFoundError } from "typeorm/error/EntityNotFoundError";
import UserController from "../../../../src/api/routes/UserController";
import UserDAO from "../../../../src/DAO/UserDAO";
import User from "../../../../src/models/user";

describe("UserController", () => {
    const mockUserDAO = {
        getAllUsers: jest.fn(),
        getUserById: jest.fn(),
        getUserByUUID: jest.fn(),
        createUser: jest.fn(),
        updateUser: jest.fn(),
        deleteUser: jest.fn(),
    };
    const userController = new UserController(mockUserDAO as unknown as UserDAO);
    const testUser = new User({id: 1, name: "Jatheesh", password: "pswd", userIdToken: "ra-ndom-string"});
    const loggedInUser = new User({name: "Admin", password: "pswd"});

    afterEach(() => {
        mockUserDAO.getUserByUUID.mockClear();
        mockUserDAO.getUserById.mockClear();
        mockUserDAO.getAllUsers.mockClear();
        mockUserDAO.createUser.mockClear();
        mockUserDAO.updateUser.mockClear();
        mockUserDAO.deleteUser.mockClear();
    });

    describe("getAll method", () => {
        it("should return an array of users without passwords", async () => {
            mockUserDAO.getAllUsers.mockReturnValue([testUser]);
            const res = await userController.getAll();

            // Testing that the correct dao function is called and with the correct params
            expect(mockUserDAO.getAllUsers).toHaveBeenCalledTimes(1);
            expect(mockUserDAO.getAllUsers).toHaveBeenCalledWith();
            // Testing that the return value from the controller method is as expected
            expect(res).toEqual([testUser.publicUser]);
        });
        it("should throw an error if dao throws an error", async () => {
            mockUserDAO.getAllUsers.mockImplementation(() => {
                // TODO: This should be an error we would expect from this route; just for clarity's sake
                throw new Error("Generic Error");
            });
            await expect(userController.getAll()).rejects.toThrow(Error);
        });
    });

    describe("getOne method", () => {
        it("should return a user by id without its password", async () => {
            mockUserDAO.getUserById.mockReturnValue(testUser);
            const res = await userController.getOne(testUser.id!.toString(), false, loggedInUser);

            // Must call the correct DAO method
            expect(mockUserDAO.getUserById).toHaveBeenCalledTimes(1);
            expect(mockUserDAO.getUserById).toHaveBeenCalledWith(testUser.id!);
            expect(res).toEqual(testUser.publicUser);
        });
        it("should return a user by uuid without its password", async () => {
            mockUserDAO.getUserByUUID.mockReturnValue(testUser);
            const res = await userController.getOne(testUser.userIdToken!, true, loggedInUser);

            // Must call the correct DAO method
            expect(mockUserDAO.getUserByUUID).toHaveBeenCalledTimes(1);
            expect(mockUserDAO.getUserByUUID).toHaveBeenCalledWith(testUser.userIdToken!);
            expect(res).toEqual(testUser.publicUser);
        });
        it("should throw an error if entity not found (by id)", async () => {
            mockUserDAO.getUserById.mockImplementation(() => {
                throw new EntityNotFoundError(User, "ID not found.");
            });
            await expect(userController.getOne("9999", false, loggedInUser))
                .rejects.toThrow(EntityNotFoundError);
        });
        it("should throw an error if entity not found (by uuid)", async () => {
            mockUserDAO.getUserByUUID.mockImplementation(() => {
                throw new EntityNotFoundError(User, "UUID not found.");
            });
            await expect(userController.getOne("invalid-id", true, loggedInUser))
                .rejects.toThrow(EntityNotFoundError);
        });
    });

    describe("createUser method", () => {
        it("should create a user", async () => {
            mockUserDAO.createUser.mockReturnValue(testUser);
            const res = await userController.createUser(testUser.parse());

            expect(mockUserDAO.createUser).toHaveBeenCalledTimes(1);
            expect(mockUserDAO.createUser).toHaveBeenCalledWith(testUser.parse());
            expect(res).toEqual(testUser.publicUser);
        });
        it("should throw an error", async () => {
            mockUserDAO.createUser.mockImplementation(() => {
                // TODO: This should be an error we would expect from this route; just for clarity's sake
                throw new Error("Generic Error");
            });
            await expect(userController.createUser(testUser.parse())).rejects.toThrow(Error);
        });
    });

    describe("updateUser method", () => {
        it("should return updated user with the given id", async () => {
            mockUserDAO.updateUser.mockReturnValue(testUser);
            const res = await userController.updateUser(testUser.id!, testUser.parse());

            expect(mockUserDAO.updateUser).toBeCalledTimes(1);
            expect(mockUserDAO.updateUser).toBeCalledWith(testUser.id!, testUser.parse());
            expect(res).toEqual(testUser.publicUser);
        });
        it("should throw an error", async () => {
            mockUserDAO.updateUser.mockImplementation(() => {
                throw new EntityNotFoundError(User, "Id not found.");
            });
            await expect(userController.updateUser(9999, testUser.parse()))
                .rejects.toThrow(EntityNotFoundError);
        });
    });

    describe("deleteUser method", () => {
        it("should delete a user by id", async () => {
            mockUserDAO.deleteUser.mockReturnValue({raw: [ [], testUser.id!]});
            const res = await userController.deleteUser(loggedInUser, testUser.id!);

            expect(mockUserDAO.deleteUser).toBeCalledTimes(1);
            expect(mockUserDAO.deleteUser).toBeCalledWith(testUser.id!);
            expect(res).toEqual({deleteResult: true, id: testUser.id});
        });
        it("should throw an error", async () => {
            mockUserDAO.deleteUser.mockImplementation(() => {
                throw new EntityNotFoundError(User, "Id not found.");
            });
            await expect(userController.deleteUser(loggedInUser, 9999))
                .rejects.toThrow(EntityNotFoundError);
        });
    });
});
