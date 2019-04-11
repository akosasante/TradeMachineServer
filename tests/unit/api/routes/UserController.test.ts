import "jest";
import "jest-extended";
import { NotFoundError } from "routing-controllers";
import { EntityNotFoundError } from "typeorm/error/EntityNotFoundError";
import UserController from "../../../../src/api/routes/UserController";
import UserDAO from "../../../../src/DAO/UserDAO";
import User from "../../../../src/models/user";

describe("UserController", () => {
    const mockUserDAO = {
        getAllUsers: jest.fn(),
        getAllUsersWithTeams: jest.fn(),
        getUserById: jest.fn(),
        getUserByUUID: jest.fn(),
        createUser: jest.fn(),
        updateUser: jest.fn(),
        deleteUser: jest.fn(),
        findUser: jest.fn(),
        findUsers: jest.fn(),
    };
    const userController = new UserController(mockUserDAO as unknown as UserDAO);
    const testUser = new User({id: 1, name: "Jatheesh", password: "pswd", userIdToken: "ra-ndom-string"});

    afterEach(() => {
        Object.entries(mockUserDAO).forEach((kvp: [string, jest.Mock<any, any>]) => {
            kvp[1].mockClear();
        });
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
            const res = await userController.getOne(testUser.id!.toString(), false);

            // Must call the correct DAO method
            expect(mockUserDAO.getUserById).toHaveBeenCalledTimes(1);
            expect(mockUserDAO.getUserById).toHaveBeenCalledWith(testUser.id!);
            expect(res).toEqual(testUser.publicUser);
        });
        it("should return a user by uuid without its password", async () => {
            mockUserDAO.getUserByUUID.mockReturnValue(testUser);
            const res = await userController.getOne(testUser.userIdToken!, true);

            // Must call the correct DAO method
            expect(mockUserDAO.getUserByUUID).toHaveBeenCalledTimes(1);
            expect(mockUserDAO.getUserByUUID).toHaveBeenCalledWith(testUser.userIdToken!);
            expect(res).toEqual(testUser.publicUser);
        });
        it("should throw an error if entity not found (by id)", async () => {
            mockUserDAO.getUserById.mockImplementation(() => {
                throw new EntityNotFoundError(User, "ID not found.");
            });
            await expect(userController.getOne("9999", false))
                .rejects.toThrow(EntityNotFoundError);
        });
        it("should throw an error if entity not found (by uuid)", async () => {
            mockUserDAO.getUserByUUID.mockImplementation(() => {
                throw new EntityNotFoundError(User, "UUID not found.");
            });
            await expect(userController.getOne("invalid-id", true))
                .rejects.toThrow(EntityNotFoundError);
        });
    });

    describe("findUser method", () => {
        const query: {[key: string]: string} = { name: "Jatheesh" };
        it("should find a user by the given query options", async () => {
            mockUserDAO.findUser.mockReturnValueOnce(testUser);
            const res = await userController.findUser(query);

            expect(mockUserDAO.findUser).toHaveBeenCalledTimes(1);
            expect(mockUserDAO.findUser).toHaveBeenCalledWith(query, true);
            expect(res).toEqual(testUser.publicUser);
        });
        it("should throw an error if the entity is not found in db", async () => {
            mockUserDAO.findUser.mockImplementation(() => {
                throw new EntityNotFoundError(User, "ID not found");
            });
            await expect(userController.findUser(query)).rejects.toThrow(EntityNotFoundError);
        });
        it("should return an array of users if multiple is a key in the query", async () => {
            const multiQuery = {...query, multiple: "true"};
            mockUserDAO.findUsers.mockReturnValueOnce([testUser]);
            // @ts-ignore
            const res = await userController.findUser(multiQuery);

            expect(mockUserDAO.findUsers).toHaveBeenCalledTimes(1);
            // We delete the "multiple" key before passing the rest to the DAO
            expect(mockUserDAO.findUsers).toHaveBeenCalledWith(query, true);
            expect(res).toEqual([testUser.publicUser]);
        });
        it("should throw an error if no entities are found with the multiple key", async () => {
            query.multiple = "true";
            mockUserDAO.findUsers.mockImplementation(() => {
                throw new NotFoundError("ID not found");
            });
            await expect(userController.findUser(query)).rejects.toThrow(NotFoundError);
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
            const res = await userController.deleteUser(testUser.id!);

            expect(mockUserDAO.deleteUser).toBeCalledTimes(1);
            expect(mockUserDAO.deleteUser).toBeCalledWith(testUser.id!);
            expect(res).toEqual({deleteResult: true, id: testUser.id});
        });
        it("should throw an error", async () => {
            mockUserDAO.deleteUser.mockImplementation(() => {
                throw new EntityNotFoundError(User, "Id not found.");
            });
            await expect(userController.deleteUser(9999))
                .rejects.toThrow(EntityNotFoundError);
        });
    });
});
