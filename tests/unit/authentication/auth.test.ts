import "jest-extended";
import { Action, BadRequestError } from "routing-controllers";
import { ConflictError } from "../../../src/api/middlewares/ErrorHandler";
import {
    authorizationChecker,
    currentUserChecker,
    deserializeUser,
    generateHashedPassword,
    passwordResetDateIsValid,
    serializeUser,
    signInAuthentication,
    signUpAuthentication,
} from "../../../src/authentication/auth";
import UserDAO from "../../../src/DAO/UserDAO";
import User, { Role } from "../../../src/models/user";
import { UserFactory } from "../../factories/UserFactory";
import logger from "../../../src/bootstrap/logger";
import { MockObj } from "../DAO/daoHelpers";

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
const testUser = UserFactory.getUser("j@gm.com", "Jatheesh", undefined, Role.OWNER);
const hashedPassword = generateHashedPassword(testUser.password!);
const passwordlessUser = new User({ ...testUser });
delete passwordlessUser.password;

const mockUserDAO: MockObj = {
    getUserById: jest.fn(),
    findUserWithPasswordByEmail: jest.fn(),
    createUsers: jest.fn(),
    updateUser: jest.fn(),
};

beforeAll(() => {
    logger.debug("~~~~~~AUTH TESTS BEGIN~~~~~~");
});
afterAll(() => {
    logger.debug("~~~~~~AUTH TESTS COMPLETE~~~~~~");
});
beforeEach(() => {
    mockUserDAO.getUserById.mockResolvedValue(testUser);
});
afterEach(() => {
    Object.values(mockUserDAO).forEach(mockFn => mockFn.mockReset());
});

describe("Authorization helper methods", () => {
    describe("serializeUser", () => {
        it("should return the user ID", () => {
            const id = serializeUser(testUser);

            expect(id).toBeString();
            expect(id).toEqual(testUser.id);
        });
        it("should return undefined if no user passed in", () => {
            expect(serializeUser((undefined as unknown) as User)).toBeUndefined();
        });
    });

    describe("deserializeUser", () => {
        it("should return the user from a given ID", async () => {
            const user = await deserializeUser(testUser.id!, (mockUserDAO as unknown) as UserDAO);

            expect(mockUserDAO.getUserById).toBeCalledTimes(1);
            expect(mockUserDAO.getUserById).toBeCalledWith(testUser.id);
            expect(user).toEqual(testUser);
        });
    });

    describe("signUpAuthentication", () => {
        const cb = jest.fn();
        afterEach(() => {
            cb.mockReset();
        });

        it("if no user with the email exists, should create a new one and return the password-less version", async () => {
            mockUserDAO.findUserWithPasswordByEmail.mockResolvedValueOnce(undefined);
            mockUserDAO.createUsers.mockResolvedValueOnce([passwordlessUser]);

            await signUpAuthentication(testUser.email, testUser.password!, (mockUserDAO as unknown) as UserDAO, cb);

            expect(mockUserDAO.findUserWithPasswordByEmail).toBeCalledTimes(1);
            expect(mockUserDAO.findUserWithPasswordByEmail).toBeCalledWith(testUser.email);
            expect(mockUserDAO.createUsers).toHaveBeenCalledTimes(1);
            expect(mockUserDAO.createUsers).toHaveBeenCalledWith([
                {
                    email: testUser.email,
                    password: expect.any(String),
                    lastLoggedIn: expect.any(Date),
                },
            ]);
            expect(cb).toBeCalledTimes(1);
            expect(cb).toBeCalledWith(undefined, passwordlessUser);
        });
        it("if a user exists but has no password set yet, should update the user with the given hashed password and return the password-less version", async () => {
            mockUserDAO.findUserWithPasswordByEmail.mockResolvedValueOnce(passwordlessUser);
            mockUserDAO.updateUser.mockResolvedValueOnce(passwordlessUser);

            await signUpAuthentication(testUser.email, testUser.password!, (mockUserDAO as unknown) as UserDAO, cb);

            expect(mockUserDAO.findUserWithPasswordByEmail).toBeCalledTimes(1);
            expect(mockUserDAO.findUserWithPasswordByEmail).toBeCalledWith(testUser.email);
            expect(mockUserDAO.updateUser).toHaveBeenCalledTimes(1);
            expect(mockUserDAO.updateUser).toHaveBeenCalledWith(testUser.id, {
                password: expect.any(String),
                lastLoggedIn: expect.any(Date),
            });
            expect(cb).toBeCalledTimes(1);
            expect(cb).toBeCalledWith(undefined, passwordlessUser);
        });
        it("if a user exists and already h as a password, should return a ConflictError", async () => {
            mockUserDAO.findUserWithPasswordByEmail.mockResolvedValueOnce(testUser);

            await signUpAuthentication(testUser.email, testUser.password!, (mockUserDAO as unknown) as UserDAO, cb);

            expect(mockUserDAO.createUsers).toHaveBeenCalledTimes(0);
            expect(mockUserDAO.updateUser).toHaveBeenCalledTimes(0);
            expect(cb).toBeCalledTimes(1);
            expect(cb).toBeCalledWith(new ConflictError("Email already in use and signed up."));
        });
    });

    describe("signInAuthentication", () => {
        const cb = jest.fn();
        afterEach(() => {
            cb.mockReset();
        });

        it("if signing in with the correct password, should update lastLoggedIn and return a password-less user", async () => {
            const testsUserWithHashedPassword = new User({ ...testUser, password: await hashedPassword });
            mockUserDAO.findUserWithPasswordByEmail.mockResolvedValueOnce(testsUserWithHashedPassword);
            mockUserDAO.updateUser.mockResolvedValueOnce(passwordlessUser);

            await signInAuthentication(testUser.email, testUser.password!, (mockUserDAO as unknown) as UserDAO, cb);

            expect(mockUserDAO.findUserWithPasswordByEmail).toBeCalledTimes(1);
            expect(mockUserDAO.findUserWithPasswordByEmail).toBeCalledWith(testUser.email);
            expect(mockUserDAO.updateUser).toHaveBeenCalledTimes(1);
            expect(mockUserDAO.updateUser).toHaveBeenCalledWith(testUser.id, {
                lastLoggedIn: expect.any(Date),
            });
            expect(cb).toBeCalledTimes(1);
            expect(cb).toBeCalledWith(undefined, passwordlessUser);
        });
        it("should return an error if the password is not matching", async () => {
            mockUserDAO.findUserWithPasswordByEmail.mockResolvedValueOnce(
                new User({ ...testUser, password: "somethingsomething" })
            );

            await signInAuthentication(testUser.email, testUser.password!, (mockUserDAO as unknown) as UserDAO, cb);

            expect(mockUserDAO.findUserWithPasswordByEmail).toBeCalledTimes(1);
            expect(mockUserDAO.findUserWithPasswordByEmail).toBeCalledWith(testUser.email);
            expect(mockUserDAO.updateUser).toHaveBeenCalledTimes(0);
            expect(cb).toBeCalledTimes(1);
            expect(cb).toBeCalledWith(new BadRequestError("Incorrect password"));
        });
    });
    //
    describe("authorizationChecker", () => {
        const action: Action = { request: { session: { user: testUser.id } }, response: {} };
        const roles = [Role.OWNER, Role.ADMIN];

        it("should return true if the user has at least one of the required roles", async () => {
            const res = await authorizationChecker(action, roles, (mockUserDAO as unknown) as UserDAO);
            expect(mockUserDAO.getUserById).toBeCalledTimes(1);
            expect(mockUserDAO.getUserById).toBeCalledWith(testUser.id);
            expect(res).toBeTrue();
        });
        it("should return true if the user is an admin no matter what", async () => {
            const adminUser = UserFactory.getAdminUser();
            mockUserDAO.getUserById.mockResolvedValueOnce(adminUser);
            const adminAction: Action = { request: { session: { user: adminUser.id } }, response: {} };
            const res = await authorizationChecker(adminAction, [roles[0]], (mockUserDAO as unknown) as UserDAO);

            expect(mockUserDAO.getUserById).toBeCalledTimes(1);
            expect(mockUserDAO.getUserById).toBeCalledWith(adminUser.id);
            expect(res).toBeTrue();
        });
        it("should return false if the user does not have any of the required roles", async () => {
            const res = await authorizationChecker(action, [roles[1]], (mockUserDAO as unknown) as UserDAO);

            expect(mockUserDAO.getUserById).toBeCalledTimes(1);
            expect(mockUserDAO.getUserById).toBeCalledWith(testUser.id);
            expect(res).toBeFalse();
        });
        it("should return false if the user is not logged in", async () => {
            const actionWithoutUser: Action = { request: { session: {} }, response: {} };

            const res = await authorizationChecker(actionWithoutUser, roles, (mockUserDAO as unknown) as UserDAO);
            expect(res).toBeFalse();
        });
    });

    describe("currentUserChecker", () => {
        const action: Action = { request: { session: { user: testUser.id } }, response: {} };

        it("should return the user from the action if it exists on the request.session object", async () => {
            const res = await currentUserChecker(action, (mockUserDAO as unknown) as UserDAO);
            expect(res).toEqual(testUser);
            expect(mockUserDAO.getUserById).toBeCalledTimes(1);
            expect(mockUserDAO.getUserById).toBeCalledWith(testUser.id);
        });
        it("should return undefined if the session doesn't exist", async () => {
            const actionWithoutUser: Action = { request: { session: {} }, response: {} };

            const res = await currentUserChecker(actionWithoutUser, (mockUserDAO as unknown) as UserDAO);
            expect(res).toBeUndefined();
            expect(mockUserDAO.getUserById).toBeCalledTimes(0);
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
            expect(testUser.password).not.toEqual(hashedPassword);
        });
    });
});
/* eslint-enable @typescript-eslint/no-unsafe-assignment */
