import { hash } from "bcryptjs";
import { NextFunction, Request, Response } from "express";
import "jest";
import "jest-extended";
import { UnauthorizedError } from "routing-controllers";
import { LoginHandler, RegisterHandler } from "../../../../src/api/middlewares/AuthenticationHandler";
import { ConflictError } from "../../../../src/api/middlewares/ErrorHandler";
import UserDAO from "../../../../src/DAO/UserDAO";
import UserDO from "../../../../src/models/user";
import { UserFactory } from "../../../factories/UserFactory";

const mockUserDAO = {
    findUser: jest.fn(),
    getUserPassword: jest.fn(),
    updateUser: jest.fn(),
};

describe("Authentication middleware", () => {
    const testUser = UserFactory.getUser("j@gm.com", "Jatheesh", undefined, undefined, {id: "d4e3fe52-1b18-4cb6-96b1-600ed86ec45b"});
    const testUserModel = testUser.toUserModel();

    describe("LoginHandler", () => {
        it("should serialize the user and return the next function if sign in was successful", async () => {
            mockUserDAO.findUser.mockReturnValueOnce(testUserModel);
            const hashedPassword = await hash(testUser.password!, 1);
            mockUserDAO.getUserPassword.mockReturnValueOnce(hashedPassword);
            mockUserDAO.updateUser.mockReturnValueOnce(testUserModel);
            const next: NextFunction = jest.fn();
            const request: Request = {
                body: {email: testUser.email!, password: testUser.password!},
                // @ts-ignore
                session: {save: jest.fn()},
            };
            // @ts-ignore
            const response: Response  = {};
            const loginHandler = new LoginHandler(mockUserDAO as unknown as UserDAO);
            await loginHandler.use(request, response, next);

            expect(request.session!.save).toBeCalledTimes(1);
            expect(request.session!.user).toBeDefined();
            expect(request.session!.user).toEqual(testUser.id);
        });
        it(`should return and call next with an Unauthorized error and not serialize the user if sign in fails
        or user is empty`, async () => {
            mockUserDAO.findUser.mockReturnValueOnce(testUserModel);
            mockUserDAO.getUserPassword.mockReturnValueOnce("nonmatching password");
            const next: NextFunction = jest.fn();
            const request: Request = {
                body: {email: testUser.email!, password: testUser.password!},
                // @ts-ignore
                session: {destroy: jest.fn()},
            };
            // @ts-ignore
            const response: Response  = {};
            const loginHandler = new LoginHandler(mockUserDAO as unknown as UserDAO);
            await loginHandler.use(request, response, next);

            expect(next).toBeCalledTimes(1);
            expect(next).toBeCalledWith(new UnauthorizedError("User could not be authenticated. Incorrect password"));
            expect(request.session!.destroy).toBeCalledTimes(1);
            expect(request.session!.user).toBeUndefined();
        });
    });
    describe("Register Handler", () => {
        it("should serialize the user and return the next function if sign up was successful", async () => {
            const passwordlessUser = new UserDO({...testUser, password: undefined});
            const passwordlessUserModel = passwordlessUser.toUserModel();
            mockUserDAO.findUser.mockReturnValueOnce(passwordlessUserModel);
            mockUserDAO.updateUser.mockReturnValueOnce(testUserModel);
            const next: NextFunction = jest.fn();
            const request: Request = {
                body: {email: testUser.email!, password: testUser.password!},
                // @ts-ignore
                session: {},
            };
            // @ts-ignore
            const response: Response  = {};
            const registerHandler = new RegisterHandler(mockUserDAO as unknown as UserDAO);
            await registerHandler.use(request, response, next);

            expect(next).toBeCalledTimes(1);
            expect(next).toBeCalledWith();
            expect(request.session!.user).toBeDefined();
            expect(request.session!.user).toEqual(testUser.id);
        });
        it("should return the original error if the signup method returns an error", async () => {
            mockUserDAO.findUser.mockReturnValueOnce(testUserModel);
            const next: NextFunction = jest.fn();
            const request: Request = {
                body: {email: testUser.email!, password: testUser.password!},
                // @ts-ignore
                session: {},
            };
            // @ts-ignore
            const response: Response  = {};
            const registerHandler = new RegisterHandler(mockUserDAO as unknown as UserDAO);
            await registerHandler.use(request, response, next);

            expect(next).toBeCalledTimes(1);
            expect(next).toBeCalledWith(new ConflictError("Email already in use and signed up."));
            expect(request.session!.user).toBeUndefined();
        });
    });
});
