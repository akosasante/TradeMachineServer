import { hash } from "bcryptjs";
import { NextFunction, Request, Response } from "express";
import { UnauthorizedError } from "routing-controllers";
import { LoginHandler, RegisterHandler } from "../../../../src/api/middlewares/AuthenticationHandler";
import { ConflictError } from "../../../../src/api/middlewares/ErrorHandler";
import UserDAO from "../../../../src/DAO/UserDAO";
import { UserFactory } from "../../../factories/UserFactory";
import logger from "../../../../src/bootstrap/logger";
import { Session, SessionData } from "express-session";

// declare the additional fields that we add to express session (via routing-controllers)
declare module "express-session" {
    interface SessionData {
        user: string | undefined;
    }
}

const mockUserDAO = {
    findUserWithPasswordByEmail: jest.fn(),
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
            const testUserWithPass = { ...testUser, password: await hash(testUser.password!, 1) };
            mockUserDAO.findUserWithPasswordByEmail.mockResolvedValueOnce(testUserWithPass);
            mockUserDAO.updateUser.mockResolvedValueOnce(testUserWithPass);
            const next: NextFunction = jest.fn();
            const request: Pick<Request, "body" | "session"> = {
                body: { email: testUser.email, password: testUser.password! },
                session: { save: jest.fn() } as unknown as Session & SessionData,
            };

            const loginHandler = new LoginHandler(mockUserDAO as unknown as UserDAO);
            await loginHandler.use(request as Request, {} as Response, next);

            expect(request.session.save).toHaveBeenCalledTimes(1);
            expect(request.session.user).toBeDefined();
            expect(request.session.user).toEqual(testUser.id);
        });
        it("should return and call next with an Unauthorized error and not serialize the user if sign in fails", async () => {
            const next: NextFunction = jest.fn();
            const request: Pick<Request, "body" | "session"> = {
                body: { email: testUser.email, password: testUser.password! },
                session: { destroy: jest.fn() } as unknown as Session & SessionData,
            };

            const loginHandler = new LoginHandler(mockUserDAO as unknown as UserDAO);
            await loginHandler.use(request as Request, {} as Response, next);

            expect(next).toHaveBeenCalledTimes(1);
            expect(next).toHaveBeenCalledWith(
                new UnauthorizedError("User could not be authenticated. Error with sign-in strategy: no user found")
            );
            expect(request.session.destroy).toHaveBeenCalledTimes(1);
            expect(request.session.user).toBeUndefined();
        });
    });
    describe("Register Handler", () => {
        it("should serialize the user and return the next function if sign up was successful", async () => {
            const passwordlessUser = { ...testUser };
            delete passwordlessUser.password;
            mockUserDAO.findUserWithPasswordByEmail.mockResolvedValueOnce(passwordlessUser);
            mockUserDAO.updateUser.mockResolvedValueOnce(passwordlessUser);
            const next: NextFunction = jest.fn();
            const request: Pick<Request, "body" | "session"> = {
                body: { email: testUser.email, password: testUser.password! },
                session: {} as unknown as Session & SessionData,
            };

            const registerHandler = new RegisterHandler(mockUserDAO as unknown as UserDAO);
            await registerHandler.use(request as Request, {} as Response, next);

            expect(next).toHaveBeenCalledTimes(1);
            expect(next).toHaveBeenCalledWith();
            expect(request.session.user).toBeDefined();
            expect(request.session.user).toEqual(testUser.id);
        });
        it("should return the original error if the signup method returns an error", async () => {
            mockUserDAO.findUserWithPasswordByEmail.mockResolvedValueOnce(testUser);
            const next: NextFunction = jest.fn();
            const request: Pick<Request, "body" | "session"> = {
                body: { email: testUser.email, password: testUser.password! },
                session: {} as unknown as Session & SessionData,
            };

            const registerHandler = new RegisterHandler(mockUserDAO as unknown as UserDAO);
            await registerHandler.use(request as Request, {} as Response, next);

            expect(next).toHaveBeenCalledTimes(1);
            expect(next).toHaveBeenCalledWith(new ConflictError("Email already in use and signed up."));
            expect(request.session.user).toBeUndefined();
        });
    });
});
