import { Request, Response } from "express";
import AuthController from "../../../../src/api/routes/AuthController";
import UserDAO from "../../../../src/DAO/UserDAO";
import User from "../../../../src/models/user";
import { UserFactory } from "../../../factories/UserFactory";
import logger from "../../../../src/bootstrap/logger";
import { NotFoundError } from "routing-controllers";
import { EmailPublisher } from "../../../../src/email/publishers";
import { SessionData as ExpressSessionData } from "express-session";
import { mockDeep } from "jest-mock-extended";

declare module "express-session" {
    interface SessionData {
        user: string | undefined;
    }
}

type AppSessionData = ExpressSessionData;

describe("AuthController", () => {
    beforeAll(() => {
        logger.debug("~~~~~~AUTH CONTROLLER TESTS BEGIN~~~~~~");
    });
    afterAll(() => {
        logger.debug("~~~~~~AUTH CONTROLLER TESTS COMPLETE~~~~~~");
    });
    const mockMailPublisher = mockDeep<EmailPublisher>();
    const mockUserDAO = mockDeep<UserDAO>();
    const authController: AuthController = new AuthController(
        mockUserDAO as unknown as UserDAO,
        mockMailPublisher as unknown as EmailPublisher
    );
    const mockReq = mockDeep<Request>();
    const mockRes = mockDeep<Response>();

    // Configure Response mock for method chaining
    mockRes.status.mockReturnValue(mockRes);
    mockRes.json.mockReturnValue(mockRes);
    const testUser = UserFactory.getUser("j@gm.com", "Jatheesh", undefined, undefined, {
        passwordResetToken: "xyz-uuid",
    });
    let mockSess = { user: testUser.id };

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe("login method", () => {
        it("should return the user model that logged in", async () => {
            mockReq.app.settings.prisma.user.findUniqueOrThrow.mockResolvedValueOnce(testUser);
            const res = await authController.login(mockReq as unknown as Request, mockSess as AppSessionData);
            expect(res).toEqual(testUser);
        });
    });

    describe("signup method", () => {
        it("should return the user model that signed in", async () => {
            mockUserDAO.getUserById.mockResolvedValueOnce(testUser);
            const res = await authController.signup(mockReq as unknown as Request, mockSess as AppSessionData);
            expect(res).toEqual(testUser);
        });
    });

    describe("logout method", () => {
        it("should resolve the promise and destroy the session if logout is successful", async () => {
            (mockReq.session.destroy as any).mockImplementationOnce((cb: any) => {
                return cb(undefined);
            });
            const res = await authController.logout(mockReq as unknown as Request, mockSess as AppSessionData);

            expect(mockReq.session.destroy).toHaveBeenCalledTimes(1);
            expect(mockSess.user).toBeUndefined();
            expect(res).toBe(true);
            expect(mockReq.app.settings.prisma.user.updateUser).toHaveBeenCalledTimes(0);
        });
        it("should resolve the promise if there is no userId on the session", async () => {
            const res = await authController.logout(mockReq as unknown as Request, {} as AppSessionData);

            expect(res).toBe(true);
            expect(mockReq.session.destroy).toHaveBeenCalledTimes(0);
            expect(mockReq.app.settings.prisma.user.updateUser).toHaveBeenCalledTimes(0);
        });
        it("should reject the promise if destroying the request session fails somehow", async () => {
            mockSess = { user: testUser.id };
            const err = new Error("Failed to destroy request session");
            mockReq.session.destroy.mockImplementationOnce((cb: any) => {
                cb(err);
                return {} as any;
            });
            const res = authController.logout(mockReq as unknown as Request, mockSess as AppSessionData);

            await expect(res).rejects.toEqual(err);
            expect(mockReq.app.settings.prisma.user.updateUser).toHaveBeenCalledTimes(0);
        });
    });

    describe("resetPassword method", () => {
        it("should return a successful response and update user", async () => {
            const date = new Date(Date.now() + 30 * 60 * 1000); // half an hour from now
            mockUserDAO.getUserById.mockResolvedValueOnce({ ...testUser, passwordResetExpiresOn: date } as unknown as User);
            await authController.resetPassword(testUser.id!, "lol2", "xyz-uuid", mockRes);
            const expectedUserUpdateObj = {
                password: expect.any(String),
                passwordResetExpiresOn: undefined,
                passwordResetToken: undefined,
            };

            expect(mockUserDAO.updateUser).toHaveBeenCalledTimes(1);
            expect(mockUserDAO.updateUser).toHaveBeenCalledWith(testUser.id!, expectedUserUpdateObj);
            expect(mockRes.status).toHaveBeenCalledWith(200);
            expect(mockRes.json).toHaveBeenCalledWith("success");
        });
        it("should return a 404 Not Found status if the user with that ID don't exist", async () => {
            mockUserDAO.getUserById.mockResolvedValueOnce(undefined as unknown as User);
            await authController.resetPassword(testUser.id!, "lol2", "xyz-uuid", mockRes);

            expect(mockUserDAO.updateUser).toHaveBeenCalledTimes(0);
            expect(mockRes.status).toHaveBeenCalledWith(404);
        });
        it("should return a 404 Not Found status if the user passwordResetToken doesn't doesn't match", async () => {
            mockUserDAO.getUserById.mockResolvedValueOnce(testUser);
            await authController.resetPassword(testUser.id!, "lol2", "abc-uuid", mockRes);

            expect(mockUserDAO.updateUser).toHaveBeenCalledTimes(0);
            expect(mockRes.status).toHaveBeenCalledWith(404);
        });
        it("should return a 404 Not Found status if the user doesn't have a passwordResetToken", async () => {
            mockUserDAO.getUserById.mockResolvedValueOnce({
                ...testUser,
                passwordResetToken: undefined,
            } as unknown as User);
            await authController.resetPassword(testUser.id!, "lol2", "xyz-uuid", mockRes);

            expect(mockUserDAO.updateUser).toHaveBeenCalledTimes(0);
            expect(mockRes.status).toHaveBeenCalledWith(404);
        });

        it("should return a 403 Forbidden status if the user's reset token has expired", async () => {
            const date = new Date(Date.now() - 30 * 60 * 1000); // half an hour from ago
            mockUserDAO.getUserById.mockResolvedValueOnce({
                ...testUser,
                passwordResetExpiresOn: date,
            } as unknown as User);
            await authController.resetPassword(testUser.id!, "lol2", "xyz-uuid", mockRes);

            expect(mockUserDAO.updateUser).toHaveBeenCalledTimes(0);
            expect(mockRes.status).toHaveBeenCalledWith(403);
        });
    });

    describe("sendResetEmail method", () => {
        it("should find a user, set a new password expiry date, and call mailQueue", async () => {
            mockUserDAO.findUser.mockResolvedValueOnce(testUser);
            mockUserDAO.setPasswordExpires.mockResolvedValueOnce(testUser);

            await authController.sendResetEmail(testUser.email, mockRes as unknown as Response);

            expect(mockUserDAO.findUser).toHaveBeenCalledTimes(1);
            expect(mockUserDAO.findUser).toHaveBeenCalledWith({ email: testUser.email });
            expect(mockUserDAO.setPasswordExpires).toHaveBeenCalledTimes(1);
            expect(mockUserDAO.setPasswordExpires).toHaveBeenCalledWith(testUser.id);
            expect(mockMailPublisher.queueResetEmail).toHaveBeenCalledTimes(1);
            expect(mockMailPublisher.queueResetEmail).toHaveBeenCalledWith(testUser);
            expect(mockRes.status).toHaveBeenCalledTimes(1);
            expect(mockRes.status).toHaveBeenCalledWith(202);
            expect(mockRes.json).toHaveBeenCalledTimes(1);
            expect(mockRes.json).toHaveBeenCalledWith({ status: "email queued" });
        });

        it("should throw an error if no user found", async () => {
            await expect(authController.sendResetEmail(testUser.email, mockRes as unknown as Response)).rejects.toThrow(
                NotFoundError
            );
            expect(mockRes.status).toHaveBeenCalledTimes(0);
            expect(mockRes.json).toHaveBeenCalledTimes(0);
        });
    });

    describe("sendRegistrationEmail method", () => {
        it("should find a user and call mailQueue", async () => {
            mockUserDAO.findUser.mockResolvedValueOnce(testUser);

            await authController.sendRegistrationEmail(testUser.email, mockRes as unknown as Response);

            expect(mockUserDAO.findUser).toHaveBeenCalledTimes(1);
            expect(mockUserDAO.findUser).toHaveBeenCalledWith({ email: testUser.email });
            expect(mockUserDAO.setPasswordExpires).toHaveBeenCalledTimes(0);
            expect(mockMailPublisher.queueRegistrationEmail).toHaveBeenCalledTimes(1);
            expect(mockMailPublisher.queueRegistrationEmail).toHaveBeenCalledWith(testUser);
            expect(mockRes.status).toHaveBeenCalledTimes(1);
            expect(mockRes.status).toHaveBeenCalledWith(202);
            expect(mockRes.json).toHaveBeenCalledTimes(1);
            expect(mockRes.json).toHaveBeenCalledWith({ status: "email queued" });
        });

        it("should throw an error if there's something wrong inside", async () => {
            await expect(
                authController.sendRegistrationEmail(testUser.email, mockRes as unknown as Response)
            ).rejects.toThrow(NotFoundError);
            expect(mockRes.status).toHaveBeenCalledTimes(0);
            expect(mockRes.json).toHaveBeenCalledTimes(0);
        });
    });
});
