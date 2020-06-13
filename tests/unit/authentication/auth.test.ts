import "jest";
import "jest-extended";
import { Action, BadRequestError } from "routing-controllers";
import { ConflictError } from "../../../src/api/middlewares/ErrorHandler";
import { authorizationChecker, currentUserChecker, deserializeUser, generateHashedPassword,
    passwordResetDateIsValid, serializeUser, signInAuthentication, signUpAuthentication } from "../../../src/authentication/auth";
import UserDAO from "../../../src/DAO/UserDAO";
import User, { Role } from "../../../src/models/user";
import { UserFactory } from "../../factories/UserFactory";
import logger from "../../../src/bootstrap/logger";
import { MockObj } from "../DAO/daoHelpers";

const testUser = UserFactory.getUser("j@gm.com", "Jatheesh", undefined, Role.OWNER);

const mockUserDAO: MockObj = {
    getUserById: jest.fn().mockResolvedValue(testUser),
    findUserWithPassword: jest.fn(),
    createUsers: jest.fn(),
    updateUser: jest.fn(),
};

beforeAll(() => {
    logger.debug("~~~~~~AUTH TESTS BEGIN~~~~~~");
});
afterAll(() => {
    logger.debug("~~~~~~AUTH TESTS COMPLETE~~~~~~");
});
afterEach(() => {
    Object.keys(mockUserDAO).forEach((action: string) => {
        (mockUserDAO[action as keyof MockObj] as jest.Mock).mockClear();
    });
});

describe("Authorization helper methods", () => {
    describe("serializeUser", () => {
        it("should return the user ID", () => {
            const id = serializeUser(testUser);

            expect(id).toBeString();
            expect(id).toEqual(testUser.id);
        });
        it("should return undefined if no user passed in", () => {
            expect(serializeUser(undefined as unknown as User)).toBeUndefined();
        });
    });

    describe("deserializeUser", () => {
        it("should return the user from a given ID", async () => {
            const user = await deserializeUser(testUser.id!, mockUserDAO as unknown as UserDAO);

            expect(mockUserDAO.getUserById).toBeCalledTimes(1);
            expect(mockUserDAO.getUserById).toBeCalledWith(testUser.id);
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

            expect(mockUserDAO.findUserWithPassword).toBeCalledTimes(1);
            expect(mockUserDAO.findUserWithPassword).toBeCalledWith({email: testUser.email});
            expect(mockUserDAO.createUsers).toHaveBeenCalledTimes(1);
            expect(mockUserDAO.createUsers).toHaveBeenCalledWith([{
                email: testUser.email,
                password: expect.toBeString(),
                lastLoggedIn: expect.toBeDate(),
            }]);
            expect(cb).toBeCalledTimes(1);
            expect(cb).toBeCalledWith(undefined, testUser);
        });
        it("should update and return an existing user with no password", async () => {
                const passwordlessUser = new User({...testUser});
                delete passwordlessUser.password;
            mockUserDAO.findUserWithPassword.mockResolvedValueOnce(passwordlessUser);
            mockUserDAO.updateUser.mockResolvedValueOnce(testUser);
            await signUpAuthentication(testUser.email!, testUser.password!, mockUserDAO as unknown as UserDAO, cb);

            expect(mockUserDAO.findUserWithPassword).toBeCalledTimes(1);
            expect(mockUserDAO.findUserWithPassword).toBeCalledWith({email: testUser.email});
            expect(mockUserDAO.updateUser).toHaveBeenCalledTimes(1);
            expect(mockUserDAO.updateUser).toHaveBeenCalledWith(testUser.id, {
                password: expect.toBeString(),
                lastLoggedIn: expect.toBeDate(),
            });
            expect(cb).toBeCalledTimes(1);
            expect(cb).toBeCalledWith(undefined, testUser);
        });
        it("should return a ConflictError if the player is already signed up", async () => {
            mockUserDAO.findUserWithPassword.mockResolvedValueOnce(testUser);
            await signUpAuthentication(testUser.email!, testUser.password!, mockUserDAO as unknown as UserDAO, cb);

            expect(mockUserDAO.createUsers).toHaveBeenCalledTimes(0);
            expect(mockUserDAO.updateUser).toHaveBeenCalledTimes(0);
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
            const testsUserWithHashedPassword = new User({...testUser, password: hashedPassword});
            mockUserDAO.findUserWithPassword.mockResolvedValueOnce(testsUserWithHashedPassword);
            const passwordlessUser = new User({...testUser});
            delete passwordlessUser.password;
            mockUserDAO.updateUser.mockResolvedValueOnce(passwordlessUser);

            await signInAuthentication(testUser.email!, testUser.password!, mockUserDAO as unknown as UserDAO, cb);

            expect(mockUserDAO.findUserWithPassword).toBeCalledTimes(1);
            expect(mockUserDAO.findUserWithPassword).toBeCalledWith({email: testUser.email});
            expect(mockUserDAO.updateUser).toHaveBeenCalledTimes(1);
            expect(mockUserDAO.updateUser).toHaveBeenCalledWith(testUser.id, {
                lastLoggedIn: expect.toBeDate(),
            });
            expect(cb).toBeCalledTimes(1);
            expect(cb).toBeCalledWith(undefined, passwordlessUser);
        });
        it("should return an error if the password is not matching", async () => {
            mockUserDAO.findUserWithPassword.mockResolvedValueOnce(testUser);
            await signInAuthentication(testUser.email!, testUser.password!, mockUserDAO as unknown as UserDAO, cb);

            expect(mockUserDAO.findUserWithPassword).toBeCalledTimes(1);
            expect(mockUserDAO.findUserWithPassword).toBeCalledWith({email: testUser.email});
            expect(mockUserDAO.updateUser).toHaveBeenCalledTimes(0);
            expect(cb).toBeCalledTimes(1);
            expect(cb).toBeCalledWith(new BadRequestError("Incorrect password"));
        });
    });
    //
    describe("authorizationChecker", () => {
        const action: Action = {request: {session: {user: testUser.id}}, response: {}};
        const roles = [ Role.OWNER, Role.ADMIN ];

        it("should return true if the user has at least one of the required roles", async () => {
            const res = await authorizationChecker(action, roles, mockUserDAO as unknown as UserDAO);
            expect(mockUserDAO.getUserById).toBeCalledTimes(1);
            expect(mockUserDAO.getUserById).toBeCalledWith(testUser.id);
            expect(res).toBeTrue();
        });
        it("should return true if the user is an admin no matter what", async () => {
            const adminUser = UserFactory.getAdminUser();
            mockUserDAO.getUserById.mockResolvedValueOnce(adminUser);
            const adminAction: Action = {request: {session: {user: adminUser.id}}, response: {}};
            const res = await authorizationChecker(adminAction, [roles[0]], mockUserDAO as unknown as UserDAO);

            expect(mockUserDAO.getUserById).toBeCalledTimes(1);
            expect(mockUserDAO.getUserById).toBeCalledWith(adminUser.id);
            expect(res).toBeTrue();
        });
        it("should return false if the user does not have any of the required roles", async () => {
            const res = await authorizationChecker(action, [roles[1]], mockUserDAO as unknown as UserDAO);

            expect(mockUserDAO.getUserById).toBeCalledTimes(1);
            expect(mockUserDAO.getUserById).toBeCalledWith(testUser.id);
            expect(res).toBeFalse();
        });
        it("should return false if the user is not logged in", async () => {
            const actionWithoutUser: Action = {request: {session: {}}, response: {}};

            const res = await authorizationChecker(actionWithoutUser, roles, mockUserDAO as unknown as UserDAO);
            expect(res).toBeFalse();
        });
    });

    describe("currentUserChecker", () => {
        const action: Action = {request: {session: {user: testUser.id}}, response: {}};

        it("should return the user from the action if it exists on the request.session object", async () => {
            const res = await currentUserChecker(action, mockUserDAO as unknown as UserDAO);
            expect(res).toEqual(testUser);
            expect(mockUserDAO.getUserById).toBeCalledTimes(1);
            expect(mockUserDAO.getUserById).toBeCalledWith(testUser.id);
        });
        it("should return undefined if the session doesn't exist", async () => {
            const actionWithoutUser: Action = {request: {session: {}}, response: {}};

            const res = await currentUserChecker(actionWithoutUser, mockUserDAO as unknown as UserDAO);
            await expect(res).toBeUndefined();
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
            const hashedPassword = await generateHashedPassword(testUser.password!);
            expect(testUser.password).not.toEqual(hashedPassword);
        });
    });
});
