import { hash } from "bcryptjs";
import "jest";
import "jest-extended";
import { Action } from "routing-controllers";
import { ConflictError } from "../../../src/api/middlewares/ErrorHandler";
import {
    authorizationChecker,
    currentUserChecker,
    deserializeUser,
    serializeUser,
    signInAuthentication,
    signUpAuthentication,
} from "../../../src/authentication/auth";
import UserDAO from "../../../src/DAO/UserDAO";
import UserDO, { Role } from "../../../src/models/user";
import { UserFactory } from "../../factories/UserFactory";

const testUser = UserFactory.getUser("j@gm.com", "Jatheesh", undefined, Role.OWNER, {id: "d4e3fe52-1b18-4cb6-96b1-600ed86ec45b"});
const testUserModel = testUser.toUserModel();
const mockUserDAO = {
    getUserById: jest.fn(),
    findUser: jest.fn(),
    getUserPassword: jest.fn(),
    createUsers: jest.fn(),
    updateUser: jest.fn(),
};

describe("Authorization helper methods", () => {
    describe("serializeUser", () => {
        it("should return the user ID", async () => {
            const id = await serializeUser(testUserModel);

            expect(id).toBeString();
            expect(id).toEqual(testUserModel.id);
        });
    });

    describe("deserializeUser", () => {
        it("should return the user from a given ID", async () => {
            mockUserDAO.getUserById.mockReturnValueOnce(testUserModel);
            const user = await deserializeUser("uuid", mockUserDAO as unknown as UserDAO);

            expect(user).toEqual(testUserModel);
        });
    });

    describe("signUpAuthentication", () => {
        const cb = jest.fn();
        afterEach(() => {
            cb.mockClear();
        });

        it("should create and return a new user if none existed before", async () => {
            mockUserDAO.findUser.mockReturnValueOnce(undefined);
            mockUserDAO.createUsers.mockReturnValueOnce([testUserModel]);
            await signUpAuthentication(testUser.email!, testUser.password!, mockUserDAO as unknown as UserDAO, cb);

            expect(cb).toBeCalledTimes(1);
            expect(cb).toBeCalledWith(undefined, testUserModel);
        });
        it("should update and return an existing user with no password", async () => {
            const passwordlessUser = new UserDO({...testUser, password: undefined});
            const passwordlessUserModel = passwordlessUser.toUserModel();
            mockUserDAO.findUser.mockReturnValueOnce(passwordlessUserModel);
            mockUserDAO.updateUser.mockReturnValueOnce(testUserModel);
            await signUpAuthentication(testUser.email!, testUser.password!, mockUserDAO as unknown as UserDAO, cb);

            expect(cb).toBeCalledTimes(1);
            expect(cb).toBeCalledWith(undefined, testUserModel);
        });
        it("should return a ConflictError if the player is already signed up", async () => {
            mockUserDAO.findUser.mockReturnValueOnce(testUserModel);
            await signUpAuthentication(testUser.email!, testUser.password!, mockUserDAO as unknown as UserDAO, cb);

            expect(cb).toBeCalledTimes(1);
            expect(cb).toBeCalledWith(new ConflictError("Email already in use and signed up."));
        });
    });

    describe("signInAuthentication", () => {
        const cb = jest.fn();
        afterEach(() => {
            cb.mockClear();
        });

        it("should return an updated user if the password is matching", async () => {
            mockUserDAO.findUser.mockReturnValueOnce(testUserModel);
            const hashedPassword = await hash(testUser.password!, 1);
            mockUserDAO.getUserPassword.mockReturnValueOnce(hashedPassword);
            mockUserDAO.updateUser.mockReturnValueOnce(testUserModel);
            await signInAuthentication(testUser.email!, testUser.password!, mockUserDAO as unknown as UserDAO, cb);

            expect(cb).toBeCalledTimes(1);
            expect(cb).toBeCalledWith(undefined, testUserModel);
        });
        it("should return an error if the password is not matching", async () => {
            mockUserDAO.findUser.mockReturnValueOnce(testUserModel);
            mockUserDAO.getUserPassword.mockReturnValueOnce("completely-different-saved-password");
            await signInAuthentication(testUser.email!, testUser.password!, mockUserDAO as unknown as UserDAO, cb);

            expect(cb).toBeCalledTimes(1);
            expect(cb).toBeCalledWith(new Error("Incorrect password"));
        });
    });

    describe("authorizationChecker", () => {
        const action: Action = {request: {session: {user: 1}}, response: {}};
        const roles = [ Role.OWNER, Role.ADMIN ];

        it("should return true if the user has at least one of the required roles", async () => {
            mockUserDAO.getUserById.mockReturnValueOnce(testUserModel);

            const res = await authorizationChecker(action, roles, mockUserDAO as unknown as UserDAO);
            expect(res).toBeTrue();
        });
        it("should return true if the user is an admin no matter what", async () => {
            const adminUser = UserFactory.getAdminUser();
            mockUserDAO.getUserById.mockReturnValueOnce(adminUser.toUserModel());

            const res = await authorizationChecker(action, [roles[0]], mockUserDAO as unknown as UserDAO);
            expect(res).toBeTrue();
        });
        it("should return false if the user does not have any of the required roles", async () => {
            mockUserDAO.getUserById.mockReturnValueOnce(testUserModel);

            const res = await authorizationChecker(action, [roles[1]], mockUserDAO as unknown as UserDAO);
            expect(res).toBeFalse();
        });
        it("should return false if the user is not logged in", async () => {
            const actionWithoutUser: Action = {request: {session: {}}, response: {}};

            const res = await authorizationChecker(actionWithoutUser, roles, mockUserDAO as unknown as UserDAO);
            expect(res).toBeFalse();
        });
    });

    describe("currentUserChecker", () => {
        const action: Action = {request: {session: {user: 1}}, response: {}};

        it("should return the true from the action if it exists on the request.session object", async () => {
            mockUserDAO.getUserById.mockReturnValueOnce(testUserModel);

            const res = await currentUserChecker(action, mockUserDAO as unknown as UserDAO);
            expect(res).toBeTrue();
        });
        it("should return false if the session doesn't exist", async () => {
            const actionWithoutUser: Action = {request: {session: {}}, response: {}};

            const res = await currentUserChecker(actionWithoutUser, mockUserDAO as unknown as UserDAO);
            await expect(res).toBeFalse();
        });
    });
});
