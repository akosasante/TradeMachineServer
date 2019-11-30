import { Request, Response } from "express";
import "jest";
import "jest-extended";
import * as routingControllers from "routing-controllers";
import AuthController from "../../../../src/api/routes/AuthController";
import { deserializeUser } from "../../../../src/authentication/auth";
import UserDAO from "../../../../src/DAO/UserDAO";
import User from "../../../../src/models/user";
import {UserFactory} from "../../../factories/UserFactory";

describe("AuthController", () => {
    const mockUserDAO = {
        getUserById: jest.fn(),
        updateUser: jest.fn(),
        // findUser: jest.fn(),
    };
    const authController: AuthController = new AuthController(mockUserDAO as unknown as UserDAO);
    // @ts-ignore
    const mockReq = { session: {destroy: jest.fn()} };
    // const mockRes: Response = ;
    // @ts-ignore
    let mockSess = { user: 1 };
    const testUser = UserFactory.getUser("j@gm.com", "Jatheesh", undefined, undefined, {id: "d4e3fe52-1b18-4cb6-96b1-600ed86ec45b"});
    const testUserModel = testUser.toUserModel();

    afterEach(() => {
        Object.entries(mockUserDAO).forEach((kvp: [string, jest.Mock<any, any>]) => {
            kvp[1].mockClear();
        });
        mockReq.session.destroy.mockClear();
    });

    describe("login method", () => {
        it("should return the user model that logged in", async () => {
            mockUserDAO.getUserById.mockReturnValueOnce(testUserModel);
            const res = await authController.login(mockReq as unknown as Request, mockSess);
            expect(res).toEqual(testUserModel);
        });
    });

    describe("signup method", () => {
        it("should return the user model that signed in", async () => {
            mockUserDAO.getUserById.mockReturnValueOnce(testUserModel);
            const res = await authController.signup(mockReq as unknown as Request, mockSess);
            expect(res).toEqual(testUserModel);
        });
    });

    describe("logout method", () => {
        it("should resolve the promise and destroy the session if logout is successful", async () => {
            mockReq.session!.destroy.mockImplementationOnce(cb => {
                return cb(undefined);
            });
            const res = await authController.logout(mockReq as unknown as Request, mockSess);
            
            expect(mockReq.session!.destroy).toHaveBeenCalledTimes(1);
            expect(mockSess.user).toBeUndefined();
            expect(res).toBeTrue();
            expect(mockUserDAO.updateUser).toHaveBeenCalledTimes(1);
            expect(mockUserDAO.updateUser).toHaveBeenCalledWith(1, {lastLoggedIn: expect.toBeDate()});
        });
        it("should resolve the promise if there is no userId on the session", async () => {
            const res = await authController.logout(mockReq as unknown as Request, {});
            
            expect(res).toBeTrue();
            expect(mockReq.session!.destroy).toHaveBeenCalledTimes(0);
            expect(mockUserDAO.updateUser).toHaveBeenCalledTimes(0);
        });
        it("should reject the promise if destroying the request session fails somehow", async () => {
            mockSess = { user: 1 };
            const err = new Error("Failed to destroy request session");
            mockReq.session!.destroy.mockImplementationOnce(cb => {
                return cb(err);
            });
            const res = authController.logout(mockReq as unknown as Request, mockSess);
            
            await expect(res).rejects.toEqual(err);
            expect(mockUserDAO.updateUser).toHaveBeenCalledTimes(0);
        });
    });
    //
    // describe("resetPassword method", () => {
    //     it("should return a successful response and update user", async () => {
    //         const date = new Date(Date.now() + (30 * 60 * 1000)); // half an hour from now
    //         mockUserDAO.findUser.mockResolvedValueOnce(new User({id: 1, passwordResetExpiresOn: date}));
    //         await authController.resetPassword(1, "lol", "xyz-uuid", mockRes);
    //         const expectedUserObj = {password: expect.toBeString(),
    //             passwordResetExpiresOn: undefined, passwordResetToken: undefined};
    //         expect(mockUserDAO.findUser).toHaveBeenCalledTimes(1);
    //         expect(mockUserDAO.findUser).toHaveBeenCalledWith({id: 1, passwordResetToken: "xyz-uuid"}, false);
    //         expect(mockUserDAO.updateUser).toHaveBeenCalledTimes(1);
    //         expect(mockUserDAO.updateUser).toHaveBeenCalledWith(1, expectedUserObj);
    //         expect(mockRes.status).toHaveBeenCalledWith(200);
    //         expect(mockRes.json).toHaveBeenCalledWith("success");
    //     });
    //
    //     it("should return a 404 Not Found status if the user with that ID/password token don't exist", async () => {
    //         // Actually I think the DAO function will just fail anyway
    //         mockUserDAO.findUser.mockResolvedValueOnce(undefined);
    //         await authController.resetPassword(1, "lol", "not-found-uuid", mockRes);
    //         expect(mockUserDAO.findUser).toHaveBeenCalledTimes(1);
    //         expect(mockUserDAO.findUser).toHaveBeenCalledWith({id: 1, passwordResetToken: "not-found-uuid"}, false);
    //         expect(mockUserDAO.updateUser).toHaveBeenCalledTimes(0);
    //         expect(mockRes.status).toHaveBeenCalledWith(404);
    //     });
    //
    //     it("should return a 403 Forbidden status if the user's reset token has expired", async () => {
    //         const date = new Date("January 1 1990");
    //         mockUserDAO.findUser.mockResolvedValueOnce(new User({id: 1, passwordResetExpiresOn: date}));
    //         await authController.resetPassword(1, "lol", "xyz-uuid", mockRes);
    //         expect(mockUserDAO.findUser).toHaveBeenCalledTimes(1);
    //         expect(mockUserDAO.findUser).toHaveBeenCalledWith({id: 1, passwordResetToken: "xyz-uuid"}, false);
    //         expect(mockUserDAO.updateUser).toHaveBeenCalledTimes(0);
    //         expect(mockRes.status).toHaveBeenCalledWith(403);
    //     });
    // });
});
