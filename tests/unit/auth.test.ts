import "jest";
import "jest-extended";
import { Action } from "routing-controllers";
import * as typeorm from "typeorm";
import { EntityNotFoundError } from "typeorm/error/EntityNotFoundError";
import { ConflictError } from "../../src/api/middlewares/ErrorHandler";
import {
    authorizationChecker,
    currentUserChecker, deserializeUser, generateHashedPassword, serializeUser,
    signInAuthentication,

} from "../../src/bootstrap/auth";
import UserDO, { Role } from "../../src/models/user";
import { User } from "@akosasante/trade-machine-models";
import {UserFactory} from "../factories/UserFactory";

const testUser = UserFactory.getUser("j@gm.com", "Jatheesh", undefined, undefined, {id: "d4e3fe52-1b18-4cb6-96b1-600ed86ec45b"});
const testUserModel = testUser.toUserModel();

describe("Authorization helper methods", () => {
    describe("serializeUser", () => {
        it("should return the user ID", async () => {
            const id = await serializeUser(testUserModel);
            expect(id).toBeString();
            expect(id).toEqual(testUserModel.id);
        });
    });
    //
    // describe("deserializeUser", () => {
    //     it("should return the user from a given ID", async () => {
    //         const user = await deserializeUser(1);
    //         expect(user!.equals(testUser)).toBeTrue();
    //     });
    //     it("should throw an error if the user ID is not found", async () => {
    //         mockUserDb.findOneOrFail = jest.fn(id => {
    //             throw new EntityNotFoundError("User", `No user found with this ${id}`);
    //         });
    //         const user = deserializeUser(200);
    //         await expect(user).rejects.toThrow(EntityNotFoundError);
    //     });
    // });
    //
    // describe("signUpAuthentication", () => {
    //     const email = "test@example.com";
    //     const expectedUser = new User({
    //         email,
    //         password: testUser.password!,
    //         lastLoggedIn: new Date(),
    //     });
    //     it("should create and return a new user if none existed before", async () => {
    //         const cb = jest.fn();
    //         mockUserDb.findOne = jest.fn(id => undefined);
    //         mockUserDb.save = jest.fn(userObj => expectedUser);
    //         generateHashedPassword = jest.fn();
    //
    //         await signUpAuthentication(email, testUser.password!, cb);
    //         expect(mockUserDb.save).toBeCalledTimes(1);
    //         expect(cb).toBeCalledTimes(1);
    //         expect(cb).toBeCalledWith(undefined, expectedUser);
    //     });
    //     it("should update and return an existing user with no password", async () => {
    //         const cb = jest.fn();
    //         mockUserDb.findOne = jest.fn(id => (new User({id: 1, email})));
    //         mockUserDb.findOneOrFail = jest.fn((id, userObj) => expectedUser);
    //         generateHashedPassword = jest.fn();
    //
    //         await signUpAuthentication(email, testUser.password!, cb);
    //         expect(mockUserDb.update).toBeCalledTimes(1);
    //         expect(cb).toBeCalledTimes(1);
    //         expect(cb).toBeCalledWith(undefined, expectedUser);
    //     });
    //     it("should return a ConflictError if the player is already signed up", async () => {
    //         const cb = jest.fn();
    //         mockUserDb.findOne = jest.fn(id => testUser);
    //
    //         await signUpAuthentication(email, testUser.password!, cb);
    //         expect(cb).toBeCalledTimes(1);
    //         expect(cb).toBeCalledWith(new ConflictError("Email already in use and signed up."));
    //     });
    //     it("should return any other errors encountered", async () => {
    //         const cb = jest.fn();
    //         mockUserDb.findOne.mockImplementationOnce(() => {
    //             throw new Error("Error while fetching user");
    //         });
    //
    //         await signUpAuthentication(email, testUser.password!, cb);
    //         expect(cb).toHaveBeenCalledTimes(1);
    //         expect(cb).toHaveBeenCalledWith(new Error("Error while fetching user"));
    //     });
    // });
    //
    // describe("signInAuthentication", () => {
    //     const email = "test@example.com";
    //     const expectedUser = new User({
    //         id: 1,
    //         email,
    //         password: testUser.password!,
    //         lastLoggedIn: new Date(),
    //     });
    //     it("should return an updated user if the password is matching", async () => {
    //         const cb = jest.fn();
    //         // @ts-ignore
    //         User.prototype.isPasswordMatching = jest.fn(() => true);
    //         mockUserDb.findOneOrFail = jest.fn((id, userObj) => expectedUser);
    //
    //         await signInAuthentication(email, testUser.password!, cb);
    //         expect(cb).toBeCalledTimes(1);
    //         expect(cb).toBeCalledWith(undefined, expectedUser);
    //     });
    //     it("should return an error if the password is not matching", async () => {
    //         const cb = jest.fn();
    //         // @ts-ignore
    //         User.prototype.isPasswordMatching = jest.fn(() => false);
    //
    //         await signInAuthentication(email, testUser.password!, cb);
    //         expect(cb).toBeCalledTimes(1);
    //         expect(cb).toBeCalledWith(new Error("Incorrect password"));
    //     });
    //     it("should return an error if the user is not found", async () => {
    //         const cb = jest.fn();
    //         mockUserDb.findOneOrFail = jest.fn(id => {
    //             throw new EntityNotFoundError("User", `No user found with this ${id}`);
    //         });
    //
    //         await signInAuthentication(email, testUser.password!, cb);
    //         expect(cb).toBeCalledTimes(1);
    //         expect(cb).toBeCalledWith(expect.any(EntityNotFoundError));
    //     });
    // });
    //
    // describe("authorizationChecker", () => {
    //     const action: Action = {request: {session: {user: 1}}, response: {}};
    //     const roles = [ Role.OWNER, Role.ADMIN ];
    //
    //     it("should return true if the user has at least one of the required roles", async () => {
    //         const userWithRoles = new User({...testUser, roles: [Role.OWNER]});
    //         mockUserDb.findOneOrFail = jest.fn(id => userWithRoles);
    //
    //         const res = await authorizationChecker(action, roles);
    //         expect(res).toBeTrue();
    //     });
    //     it("should return true if the user is an admin no matter what", async () => {
    //         const ownerRoles = [Role.OWNER];
    //         const adminUser = new User({...testUser, roles: [Role.ADMIN]});
    //         mockUserDb.findOneOrFail = jest.fn(id => adminUser);
    //
    //         const res = await authorizationChecker(action, ownerRoles);
    //         expect(res).toBeTrue();
    //     });
    //     it("should return false if the user does not have any of the required roles", async () => {
    //         mockUserDb.findOneOrFail = jest.fn(id => testUser);
    //
    //         const res = await authorizationChecker(action, roles);
    //         expect(res).toBeFalse();
    //     });
    //     it("should return false if the user is not logged in", async () => {
    //         const actionWithoutUser: Action = {request: {session: {}}, response: {}};
    //
    //         const res = await authorizationChecker(actionWithoutUser, roles);
    //         expect(res).toBeFalse();
    //     });
    // });
    //
    // describe("currentUserChecker", () => {
    //     it("should return the true from the action if it exists on the request.session object", async () => {
    //         const action: Action = {request: {session: {user: 1}}, response: {}};
    //         mockUserDb.findOneOrFail = jest.fn(id => testUser);
    //
    //         const res = await currentUserChecker(action);
    //         expect(res).toBeTrue();
    //     });
    //     it("should return false if the session doesn't exist", async () => {
    //         const action: Action = {request: {}, response: {}};
    //
    //         const res = await currentUserChecker(action);
    //         await expect(res).toBeFalse();
    //     });
    //     it("should return false if the user for that Id doesn't exist", async () => {
    //         const action: Action = {request: {session: {user: 1}}, response: {}};
    //         mockUserDb.findOneOrFail = jest.fn(id => {
    //             throw new EntityNotFoundError("User", `No user found with this ${id}`);
    //         });
    //
    //         const res = await currentUserChecker(action);
    //         expect(res).toBeFalse();
    //     });
    // });
});
