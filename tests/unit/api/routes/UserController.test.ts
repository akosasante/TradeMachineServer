import "jest";
import "jest-extended";
import { mocked } from "ts-jest/utils";
import { Error } from "tslint/lib/error";
import { EntityNotFoundError } from "typeorm/error/EntityNotFoundError";
import UserController from "../../../../src/api/routes/UserController";
import UserDAO from "../../../../src/DAO/UserDAO";
import User from "../../../../src/models/user";

jest.mock("../../../../src/DAO/user");
const mockedUserDAO = mocked(UserDAO);

describe("UserController", () => {
    let userController: UserController;
    const testUser = new User({id: 1, name: "Jatheesh", password: "pswd"});
    const loggedInUser = new User({name: "Admin", password: "pswd"});

    describe("getAll method", () => {
        let mockGetAllUsers: jest.Mock;
        beforeAll(() => {
            mockedUserDAO.mockClear();
            mockedUserDAO.mockImplementation(() => {
                mockGetAllUsers = jest.fn()
                    .mockImplementationOnce(() => [testUser])
                    .mockImplementationOnce(() => {
                        throw new Error("Generic Error");
                        // TODO: This should be an error we would expect from this route; just for clarity's sake
                    });
                return {
                    getAllUsers: mockGetAllUsers,
                };
            });
            userController = new UserController();
            expect(mockedUserDAO).toHaveBeenCalledTimes(1);
        });

        it("should return an array of users without passwords", async () => {
            const res = await userController.getAll();
            // Testing that the UserDAO class was instantiated
            expect(mockedUserDAO).toHaveBeenCalledTimes(1);
            // Testing that the correct dao function is called and with the correct params
            expect(mockGetAllUsers).toHaveBeenCalledTimes(1);
            expect(mockGetAllUsers).toHaveBeenCalledWith();
            // Testing that the return value from the controller method is as expected
            expect(res).toEqual([testUser.publicUser]);
        });
        it("should throw an error if dao throws an error", async () => {
            await expect(userController.getAll()).rejects.toThrow(Error);
        });
    });

    describe("getOne method", () => {
        let mockGetOneUser: jest.Mock;
        beforeAll(() => {
            mockedUserDAO.mockClear();
            mockedUserDAO.mockImplementation(() => {
                mockGetOneUser = jest.fn()
                    .mockImplementationOnce(id => testUser)
                    .mockImplementationOnce(id => {
                        throw new EntityNotFoundError(User, "Not found");
                    });
                return {
                    getUserById: mockGetOneUser,
                };
            });
            userController = new UserController();
            expect(mockedUserDAO).toHaveBeenCalledTimes(1);
        });

        it("should return a user by id without its password", async () => {
            const res = await userController.getOne(testUser.id!, loggedInUser);
            // Testing that the UserDAO class was instantiated
            expect(mockedUserDAO).toHaveBeenCalledTimes(1);
            // Testing that the correct dao function is called and with the correct params
            expect(mockGetOneUser).toHaveBeenCalledTimes(1);
            expect(mockGetOneUser).toHaveBeenCalledWith(testUser.id);
            // Testing that the return value from the controller method is as expected
            expect(res).toEqual(testUser.publicUser);
        });
        it("should throw an error", async () => {
            await expect(userController.getOne(2, loggedInUser)).rejects.toThrow(EntityNotFoundError);
        });
    });

    describe("createUser method", () => {
        let mockCreateUser: jest.Mock;
        beforeAll(() => {
            mockedUserDAO.mockClear();
            mockedUserDAO.mockImplementation(() => {
                mockCreateUser = jest.fn()
                    .mockImplementationOnce(userObj => new User(userObj))
                    .mockImplementationOnce(userObj => {
                        throw new EntityNotFoundError(User, "Not found");
                        // TODO: This should be an error we would expect from this route; just for clarity's sake
                    });
                return {
                    createUser: mockCreateUser,
                };
            });
            userController = new UserController();
            expect(mockedUserDAO).toHaveBeenCalledTimes(1);
        });

        it("should create a user", async () => {
            const res = await userController.createUser(testUser.parse());
            // Testing that the UserDAO class was instantiated
            expect(mockedUserDAO).toHaveBeenCalledTimes(1);
            // Testing that the correct dao function is called and with the correct params
            expect(mockCreateUser).toHaveBeenCalledTimes(1);
            expect(mockCreateUser).toHaveBeenCalledWith(testUser);
            // Testing that the return value from the controller method is as expected
            expect(res).toEqual(testUser.publicUser);
        });
        it("should throw an error", async () => {
            await expect(userController.createUser({namez: "invalid"} as Partial<User>))
                .rejects
                .toThrow(EntityNotFoundError);
        });
    });

    describe("updateUser method", () => {
        let mockUpdateUser: jest.Mock;
        beforeAll(() => {
            mockedUserDAO.mockClear();
            mockedUserDAO.mockImplementation(() => {
                mockUpdateUser = jest.fn()
                    .mockImplementationOnce((id, userObj) => new User(userObj))
                    .mockImplementationOnce((id, userObj) => {
                        throw new EntityNotFoundError(User, "Not found");
                    });
                return {
                    updateUser: mockUpdateUser,
                };
            });
            userController = new UserController();
            expect(mockedUserDAO).toHaveBeenCalledTimes(1);
        });

        it("should return updated user with the given id", async () => {
            const res = await userController.updateUser(testUser.id!, testUser.parse());
            // Testing that the UserDAO class was instantiated
            expect(mockedUserDAO).toHaveBeenCalledTimes(1);
            // Testing that the correct dao function is called and with the correct params
            expect(mockUpdateUser).toHaveBeenCalledTimes(1);
            expect(mockUpdateUser).toHaveBeenCalledWith(testUser.id, testUser.parse());
            // Testing that the return value from the controller method is as expected
            expect(res).toEqual(testUser.publicUser);
        });
        it("should throw an error", async () => {
            await expect(userController.updateUser(2, testUser.parse()))
                .rejects
                .toThrow(EntityNotFoundError);
        });
    });

    describe("deleteUser method", () => {
        let mockDeleteUser: jest.Mock;
        beforeAll(() => {
            mockedUserDAO.mockClear();
            mockedUserDAO.mockImplementation(() => {
                mockDeleteUser = jest.fn()
                    .mockImplementationOnce(id => ({raw: [ [] , id ]}))
                    .mockImplementationOnce(id => {
                        throw new EntityNotFoundError(User, "Not found");
                    });
                return {
                    deleteUser: mockDeleteUser,
                };
            });
            userController = new UserController();
            expect(mockedUserDAO).toHaveBeenCalledTimes(1);
        });

        it("should delete a user by id", async () => {
            const res = await userController.deleteUser(loggedInUser, testUser.id!);
            // Testing that the UserDAO class was instantiated
            expect(mockedUserDAO).toHaveBeenCalledTimes(1);
            // Testing that the correct dao function is called and with the correct params
            expect(mockDeleteUser).toHaveBeenCalledTimes(1);
            expect(mockDeleteUser).toHaveBeenCalledWith(testUser.id);
            // Testing that the return value from the controller method is as expected
            expect(res).toEqual({deleteResult: true, id: testUser.id});
        });
        it("should throw an error", async () => {
            await expect(userController.deleteUser(loggedInUser, 2))
                .rejects
                .toThrow(EntityNotFoundError);
        });
    });
});
