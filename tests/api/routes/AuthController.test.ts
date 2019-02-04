import { Request } from "express";
import * as routingControllers from "routing-controllers";
import util from "util";
import AuthController from "../../../src/api/routes/AuthController";
import { deserializeUser } from "../../../src/bootstrap/auth";
import logger from "../../../src/bootstrap/logger";
import User from "../../../src/models/user";

describe("AuthController", () => {
    let authController: AuthController;
    let mockReq: Request;
    let mockSess: any;

    beforeAll(() => {
        routingControllers.Req = jest.fn();
        deserializeUser = jest.fn((userId: number) =>
            new User({ id: userId, email: "example@test.com", password: "test" }));
        mockReq = { session: {} };
        mockSess = { user: 1 };
        authController = new AuthController();
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
            mockReq.session.destroy = jest.fn(cb => {
                return cb();
            });
            expect(mockSess).toEqual({ user: 1 });
            const res = authController.logout(mockReq, mockSess);
            await expect(res).resolves.toBeTrue();
            expect(mockReq.session.destroy).toHaveBeenCalledTimes(1);
            expect(mockSess).toBeEmpty();
        });
        it("should resolve the promise if there is no userId on the session", async () => {
            mockSess = {};
            mockReq.session.destroy = jest.fn(cb => {
                return cb();
            });
            const res = authController.logout(mockReq, mockSess);
            await expect(res).resolves.toBeTrue();
            expect(mockReq.session.destroy).toHaveBeenCalledTimes(0);
            // Reset mockSess for following tests
            mockSess = { user: 1 };
        });
        it("should reject the promise if destroying the request session fails somehow", async () => {
            const err = new Error("Failed to destroy request session");
            mockReq.session.destroy = jest.fn(cb => {
                return cb(err);
            });
            const res = authController.logout(mockReq, mockSess);
            await expect(res).rejects.toThrow(err);
        });
    });
});
