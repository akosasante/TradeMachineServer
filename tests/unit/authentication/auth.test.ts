import "jest";
import "jest-extended";
import { Action } from "routing-controllers";
import { ConflictError } from "../../../src/api/middlewares/ErrorHandler";
import { authorizationChecker, currentUserChecker, deserializeUser, generateHashedPassword,
    passwordResetDateIsValid, serializeUser, signInAuthentication, signUpAuthentication } from "../../../src/authentication/auth";
import UserDAO from "../../../src/DAO/UserDAO";
import { Role } from "../../../src/models/user";
import { UserFactory } from "../../factories/UserFactory";
import logger from "../../../src/bootstrap/logger";

const testUser = UserFactory.getUser("j@gm.com", "Jatheesh", undefined, Role.OWNER);
const mockUserDAO = {
    getUserById: jest.fn(),
    findUserWithPassword: jest.fn(),
    createUsers: jest.fn(),
    updateUser: jest.fn(),
};

describe("Authorization helper methods", () => {
    beforeAll(() => {
        logger.debug("~~~~~~AUTH TESTS BEGIN~~~~~~");
    });
    afterAll(() => {
        logger.debug("~~~~~~AUTH TESTS COMPLETE~~~~~~");
    });
    describe("serializeUser", () => {
        it("should return the user ID", async () => {
            const id = await serializeUser(testUser);

            expect(id).toBeString();
            expect(id).toEqual(testUser.id);
        });
    });

    describe("deserializeUser", () => {
        it("should return the user from a given ID", async () => {
            mockUserDAO.getUserById.mockResolvedValueOnce(testUser);
            const user = await deserializeUser("uuid", mockUserDAO as unknown as UserDAO);

            expect(user).toEqual(testUser);
        });
    });

    describe("signUpAuthentication", () => {
        const cb = jest.fn();
        afterEach(() => {
            cb.mockClear();
        });

        it("should create and return a new user if none existed before", async () => {
            mockUserDAO.findUserWithPassword.mockResolvedValueOnce(undefined);
            mockUserDAO.createUsers.mockResolvedValueOnce([testUser]);
            await signUpAuthentication(testUser.email!, testUser.password!, mockUserDAO as unknown as UserDAO, cb);

            expect(cb).toBeCalledTimes(1);
            expect(cb).toBeCalledWith(undefined, testUser);
        });
        it("should update and return an existing user with no password", async () => {
            const passwordlessUser = {...testUser};
            delete passwordlessUser.password;
            mockUserDAO.findUserWithPassword.mockResolvedValueOnce(passwordlessUser);
            mockUserDAO.updateUser.mockResolvedValueOnce(testUser);
            await signUpAuthentication(testUser.email!, testUser.password!, mockUserDAO as unknown as UserDAO, cb);

            expect(cb).toBeCalledTimes(1);
            expect(cb).toBeCalledWith(undefined, testUser);
        });
        it("should return a ConflictError if the player is already signed up", async () => {
            mockUserDAO.findUserWithPassword.mockResolvedValueOnce(testUser);
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
            const hashedPassword = await generateHashedPassword(testUser.password!);
            const testsUserWithHashedPassword = {...testUser, password: hashedPassword};
            const cleanedUser = {...testUser};
            delete cleanedUser.password;
            mockUserDAO.findUserWithPassword.mockResolvedValueOnce(testsUserWithHashedPassword);
            mockUserDAO.getUserById.mockResolvedValueOnce(testsUserWithHashedPassword);
            mockUserDAO.updateUser.mockResolvedValueOnce(cleanedUser);
            await signInAuthentication(testUser.email!, testUser.password!, mockUserDAO as unknown as UserDAO, cb);

            expect(cb).toBeCalledTimes(1);
            expect(cb).toBeCalledWith(undefined, cleanedUser);
        });
        it("should return an error if the password is not matching", async () => {
            mockUserDAO.findUserWithPassword.mockResolvedValueOnce(testUser);
            mockUserDAO.getUserById.mockResolvedValueOnce(
                {...testUser, password: "completely-different-saved-password"}
            );
            await signInAuthentication(testUser.email!, testUser.password!, mockUserDAO as unknown as UserDAO, cb);

            expect(cb).toBeCalledTimes(1);
            expect(cb).toBeCalledWith(new Error("Incorrect password"));
        });
    });

    describe("authorizationChecker", () => {
        const action: Action = {request: {session: {user: 1}}, response: {}};
        const roles = [ Role.OWNER, Role.ADMIN ];

        it("should return true if the user has at least one of the required roles", async () => {
            mockUserDAO.getUserById.mockResolvedValueOnce(testUser);

            const res = await authorizationChecker(action, roles, mockUserDAO as unknown as UserDAO);
            expect(res).toBeTrue();
        });
        it("should return true if the user is an admin no matter what", async () => {
            const adminUser = UserFactory.getAdminUser();
            mockUserDAO.getUserById.mockResolvedValueOnce(adminUser);

            const res = await authorizationChecker(action, [roles[0]], mockUserDAO as unknown as UserDAO);
            expect(res).toBeTrue();
        });
        it("should return false if the user does not have any of the required roles", async () => {
            mockUserDAO.getUserById.mockResolvedValueOnce(testUser);

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
            mockUserDAO.getUserById.mockResolvedValueOnce(testUser);

            const res = await currentUserChecker(action, mockUserDAO as unknown as UserDAO);
            expect(res).toBeTrue();
        });
        it("should return false if the session doesn't exist", async () => {
            const actionWithoutUser: Action = {request: {session: {}}, response: {}};

            const res = await currentUserChecker(actionWithoutUser, mockUserDAO as unknown as UserDAO);
            await expect(res).toBeFalse();
        });
    });

    describe("passwordResetDateIsValid", () => {
        it("should return true if the user's expiry date is after now", () => {
            const expiryDate = new Date("January 1 2091");
            expect(passwordResetDateIsValid(expiryDate)).toBeTrue();
        });
        it("should return false if a null value is passed in", () => {
            expect(passwordResetDateIsValid(undefined)).toBeFalse();
        });
        it("should return false if the user's expiry date is before now", () => {
            const expiryDate = new Date("January 1 1991");
            expect(passwordResetDateIsValid(expiryDate)).toBeFalse();
        });
    });

    describe("generateHashedPassword", () => {
        it("should return the hashed string", async () => {
            const hashedPassword = await generateHashedPassword(testUser.password!);
            expect(testUser.password).not.toEqual(hashedPassword);
        });
    });
});
