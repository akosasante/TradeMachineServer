import { NextFunction, Request, Response } from "express";
import "jest";
import "jest-extended";
import { UnauthorizedError } from "routing-controllers";
import { LoginHandler, RegisterHandler } from "../../../../src/api/middlewares/AuthenticationHandler";
import { ConflictError } from "../../../../src/api/middlewares/ErrorHandler";
import * as AuthFuncs from "../../../../src/bootstrap/auth";
import User from "../../../../src/models/user";

describe("Authentication middleware", () => {
    const email = "test@example.com";
    const password = "test";
    const testUser = new User({id: 1, email, password, lastLoggedIn: new Date()});
    describe("LoginHandler", () => {
        it("should serialize the user and return the next function if sign in was successful", async () => {
            // @ts-ignore
            AuthFuncs.signInAuthentication = jest.fn((mail, psswrd, done) => {
                return done(undefined, testUser);
            });
            const next: NextFunction = jest.fn();
            // @ts-ignore
            const request: Request = {body: {email, password}, session: {}};
            // @ts-ignore
            const response: Response  = {};
            const loginHandler = new LoginHandler();
            await loginHandler.use(request, response, next);
            expect(next).toBeCalledTimes(1);
            expect(next).toBeCalledWith();
            expect(request.session!.user).toBeDefined();
            expect(request.session!.user).toEqual(testUser.id);
        });
        it(`should return and call next with an Unauthorized error and not serialize the user if sign in fails
        or user is empty`, async () => {
            // @ts-ignore
            AuthFuncs.signInAuthentication = jest.fn((mail, psswrd, done) => {
                return done(new Error("Incorrect password"));
            });
            const next: NextFunction = jest.fn();
            // @ts-ignore
            const request: Request = {body: {email, password}, session: {}};
            // @ts-ignore
            const response: Response  = {};
            const loginHandler = new LoginHandler();
            await loginHandler.use(request, response, next);
            expect(next).toBeCalledTimes(1);
            expect(next).toBeCalledWith(new UnauthorizedError("User could not be authenticated. Incorrect password"));
            expect(request.session!.user).toBeUndefined();
        });
    });
    describe("Register Handler", () => {
        it("should serialize the user and return the next function if sign up was successful", async () => {
            // @ts-ignore
            AuthFuncs.signUpAuthentication = jest.fn((mail, psswrd, done) => {
                return done(undefined, testUser);
            });
            const next: NextFunction = jest.fn();
            // @ts-ignore
            const request: Request = {body: {email, password}, session: {}};
            // @ts-ignore
            const response: Response  = {};
            const registerHandler = new RegisterHandler();
            await registerHandler.use(request, response, next);

            expect(next).toBeCalledTimes(1);
            expect(next).toBeCalledWith();
            expect(request.session!.user).toBeDefined();
            expect(request.session!.user).toEqual(testUser.id);
        });
        it("should return the original error if the signup method returns an error", async () => {
            // @ts-ignore
            AuthFuncs.signUpAuthentication = jest.fn((mail, psswrd, done) => {
                return done(new ConflictError("Email already in use and signed up."));
            });
            const next: NextFunction = jest.fn();
            // @ts-ignore
            const request: Request = {body: {email, password}, session: {}};
            // @ts-ignore
            const response: Response  = {};
            const registerHandler = new RegisterHandler();
            await registerHandler.use(request, response, next);

            expect(next).toBeCalledTimes(1);
            expect(next).toBeCalledWith(new ConflictError("Email already in use and signed up."));
            expect(request.session!.user).toBeUndefined();
        });
    });
});
