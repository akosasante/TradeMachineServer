import { hash } from "bcryptjs";
import { NextFunction, Request, Response } from "express";
import { UnauthorizedError } from "routing-controllers";
import { LoginHandler, RegisterHandler } from "../../../../src/api/middlewares/AuthenticationHandler";
import { ConflictError } from "../../../../src/api/middlewares/ErrorHandler";
import UserDAO from "../../../../src/DAO/UserDAO";
import { UserFactory } from "../../../factories/UserFactory";
import logger from "../../../../src/bootstrap/logger";

const mockUserDAO = {
    findUserWithPassword: jest.fn(),
    updateUser: jest.fn(),
};

describe("Authentication middleware", () => {
    beforeAll(() => {
        logger.debug("~~~~~~AUTHENTICATION MIDDLEWARE TESTS BEGIN~~~~~~");
    });
    afterAll(() => {
        logger.debug("~~~~~~AUTHENTICATION MIDDLEWARE TESTS COMPLETE~~~~~~");
    });
    const testUser = UserFactory.getUser("j@gm.com", "Jatheesh", undefined, undefined);

    describe("LoginHandler", () => {
        it("should serialize the user and return the next function if sign in was successful", async () => {
            const testUserWithPass = {...testUser, password: await hash(testUser.password!, 1)};
            mockUserDAO.findUserWithPassword.mockResolvedValueOnce(testUserWithPass);
            mockUserDAO.updateUser.mockResolvedValueOnce(testUserWithPass);
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
        it("should return and call next with an Unauthorized error and not serialize the user if sign in fails", async () => {
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
            expect(next).toBeCalledWith(new UnauthorizedError("User could not be authenticated. Error with sign-in strategy: no user found"));
            expect(request.session!.destroy).toBeCalledTimes(1);
            expect(request.session!.user).toBeUndefined();
        });
    });
    describe("Register Handler", () => {
        it("should serialize the user and return the next function if sign up was successful", async () => {
            const passwordlessUser = {...testUser};
            delete passwordlessUser.password;
            mockUserDAO.findUserWithPassword.mockResolvedValueOnce(passwordlessUser);
            mockUserDAO.updateUser.mockResolvedValueOnce(testUser);
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
            mockUserDAO.findUserWithPassword.mockResolvedValueOnce(testUser);
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
