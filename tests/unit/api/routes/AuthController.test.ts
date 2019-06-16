import { Request, Response } from "express";
import "jest";
import "jest-extended";
import * as routingControllers from "routing-controllers";
import AuthController from "../../../../src/api/routes/AuthController";
import { deserializeUser } from "../../../../src/bootstrap/auth";
import UserDAO from "../../../../src/DAO/UserDAO";
import User from "../../../../src/models/user";

describe("AuthController", () => {
    let authController: AuthController;
    let mockReq: Request;
    let mockRes: Response;
    let mockSess: any;
    const mockUserDAO = {
        updateUser: jest.fn(),
        findUser: jest.fn(),
    };

    beforeAll(() => {
        // @ts-ignore
        routingControllers.Req = jest.fn();
        // @ts-ignore
        deserializeUser = jest.fn((userId: number) =>
            new User({ id: userId, email: "example@test.com", password: "test" }));
        // @ts-ignore
        mockReq = { session: {} };
        mockSess = { user: 1 };
        // @ts-ignore
        mockRes = {
            status: jest.fn(function() {
                // @ts-ignore
                return this;
            }),
            json: jest.fn(function() {
                // @ts-ignore
                return this;
            }),
        };
        authController = new AuthController(mockUserDAO as unknown as UserDAO);
    });

    afterEach(() => {
        Object.entries(mockUserDAO).forEach((kvp: [string, jest.Mock<any, any>]) => {
            kvp[1].mockClear();
        });
    });

    describe("login method", () => {
        it("should return the public user that logged in", async () => {
            const expectedUser = new User({id: 1, email: "example@test.com", password: "test"});
            const res = await authController.login(mockReq, mockSess);
            expect(res).toEqual(expectedUser.publicUser);
        });
    });

    describe("signup method", () => {
        it("should return the public user that signed in", async () => {
            const expectedUser = new User({id: 1, email: "example@test.com", password: "test"});
            const res = await authController.signup(mockReq, mockSess);
            expect(res).toEqual(expectedUser.publicUser);
        });
    });

    describe("logout method", () => {
        it("should resolve the promise and destroy the session if logout is successful", async () => {
            mockReq.session!.destroy = jest.fn(cb => {
                return cb(undefined);
            });
            expect(mockSess).toEqual({ user: 1 });
            const res = authController.logout(mockReq, mockSess);
            await expect(res).resolves.toBeTrue();
            expect(mockReq.session!.destroy).toHaveBeenCalledTimes(1);
            expect(mockSess).toBeEmpty();
            expect(mockUserDAO.updateUser).toHaveBeenCalledTimes(1);
            expect(mockUserDAO.updateUser).toHaveBeenCalledWith(1, {lastLoggedIn: expect.toBeDate()});
        });
        it("should resolve the promise if there is no userId on the session", async () => {
            mockSess = {};
            mockReq.session!.destroy = jest.fn(cb => {
                return cb(undefined);
            });
            const res = authController.logout(mockReq, mockSess);
            await expect(res).resolves.toBeTrue();
            expect(mockReq.session!.destroy).toHaveBeenCalledTimes(0);
            expect(mockUserDAO.updateUser).toHaveBeenCalledTimes(0);
            // Reset mockSess for following tests
            mockSess = { user: 1 };
        });
        it("should reject the promise if destroying the request session fails somehow", async () => {
            const err = new Error("Failed to destroy request session");
            mockReq.session!.destroy = jest.fn(cb => {
                return cb(err);
            });
            const res = authController.logout(mockReq, mockSess);
            await expect(res).rejects.toThrow(err);
            expect(mockUserDAO.updateUser).toHaveBeenCalledTimes(0);
        });
    });

    describe("resetPassword method", () => {
        it("should return a successful response and update user", async () => {
            const date = new Date(Date.now() + (30 * 60 * 1000)); // half an hour from now
            mockUserDAO.findUser.mockResolvedValueOnce(new User({id: 1, passwordResetExpiresOn: date}));
            await authController.resetPassword(1, "lol", "xyz-uuid", mockRes);
            const expectedUserObj = {password: expect.toBeString(),
                passwordResetExpiresOn: undefined, passwordResetToken: undefined};
            expect(mockUserDAO.findUser).toHaveBeenCalledTimes(1);
            expect(mockUserDAO.findUser).toHaveBeenCalledWith({id: 1, passwordResetToken: "xyz-uuid"}, false);
            expect(mockUserDAO.updateUser).toHaveBeenCalledTimes(1);
            expect(mockUserDAO.updateUser).toHaveBeenCalledWith(1, expectedUserObj);
            expect(mockRes.status).toHaveBeenCalledWith(200);
            expect(mockRes.json).toHaveBeenCalledWith("success");
        });

        it("should return a 404 Not Found status if the user with that ID/password token don't exist", async () => {
            // Actually I think the DAO function will just fail anyway
            mockUserDAO.findUser.mockResolvedValueOnce(undefined);
            await authController.resetPassword(1, "lol", "not-found-uuid", mockRes);
            expect(mockUserDAO.findUser).toHaveBeenCalledTimes(1);
            expect(mockUserDAO.findUser).toHaveBeenCalledWith({id: 1, passwordResetToken: "not-found-uuid"}, false);
            expect(mockUserDAO.updateUser).toHaveBeenCalledTimes(0);
            expect(mockRes.status).toHaveBeenCalledWith(404);
        });

        it("should return a 403 Forbidden status if the user's reset token has expired", async () => {
            const date = new Date("January 1 1990");
            mockUserDAO.findUser.mockResolvedValueOnce(new User({id: 1, passwordResetExpiresOn: date}));
            await authController.resetPassword(1, "lol", "xyz-uuid", mockRes);
            expect(mockUserDAO.findUser).toHaveBeenCalledTimes(1);
            expect(mockUserDAO.findUser).toHaveBeenCalledWith({id: 1, passwordResetToken: "xyz-uuid"}, false);
            expect(mockUserDAO.updateUser).toHaveBeenCalledTimes(0);
            expect(mockRes.status).toHaveBeenCalledWith(403);
        });
    });
});
