import { Response } from "express";
import "jest";
import "jest-extended";
import EmailController from "../../../../src/api/routes/EmailController";
import UserDAO from "../../../../src/DAO/UserDAO";
import User from "../../../../src/models/user";
import { MailQueue } from "../../../../src/queue/mailQueue";

describe("EmailController", () => {
    const mockUserDAO: any = {
        findUser: jest.fn(),
        setPasswordExpires: jest.fn(),
    };
    const mockMailQueue: any = {
        addEmail: jest.fn(),
    };
    const testUser = new User({id: 1, name: "Jatheesh", password: "pswd", email: "jat@example.com"});
    const emailController = new EmailController(mockUserDAO as UserDAO, mockMailQueue as MailQueue);
    const mockRes = {
        status: jest.fn(function() {
            // @ts-ignore
            return this;
        }),
        json: jest.fn(function() {
            // @ts-ignore
            return this;
        }),
    };

    afterEach(() => {
        const clearMock = (mockInstance: object) =>
            Object.entries(mockInstance).forEach((kvp: [string, jest.Mock<any, any>]) => {
                kvp[1].mockClear();
            });
        [mockUserDAO, mockRes, mockMailQueue].forEach(clearMock);
    });

    describe("sendResetEmail method", () => {
        it("should find a user, set a new password expriy date, and call mailQueue", async () => {
            mockUserDAO.findUser.mockReturnValueOnce(testUser);
            const expectedQueueMessage = `{"topic":"reset_pass","args":[${JSON.stringify(testUser)}]}`;

            await emailController.sendResetEmail(testUser.email!, mockRes as unknown as Response);

            expect(mockUserDAO.findUser).toHaveBeenCalledTimes(1);
            expect(mockUserDAO.findUser).toHaveBeenCalledWith({email: testUser.email});
            expect(mockUserDAO.setPasswordExpires).toHaveBeenCalledTimes(1);
            expect(mockUserDAO.setPasswordExpires).toHaveBeenCalledWith(testUser.id);
            expect(mockMailQueue.addEmail).toHaveBeenCalledTimes(1);
            expect(mockMailQueue.addEmail).toHaveBeenCalledWith(expectedQueueMessage);
            expect(mockRes.status).toHaveBeenCalledTimes(1);
            expect(mockRes.status).toHaveBeenCalledWith(202);
            expect(mockRes.json).toHaveBeenCalledTimes(1);
        });

        it("should throw an error if there's something wrong inside", async () => {
            mockUserDAO.findUser.mockImplementationOnce(() => {
                throw new Error("Generic Error");
            });

            await expect(emailController.sendResetEmail(testUser.email!, mockRes as unknown as Response))
                .rejects.toThrow(Error);
            expect(mockRes.status).toHaveBeenCalledTimes(0);
            expect(mockRes.json).toHaveBeenCalledTimes(0);
        });
    });

    describe("sendTestEmail method", () => {
        it("should find a user and call mailQueue", async () => {
            mockUserDAO.findUser.mockReturnValueOnce(testUser);
            const expectedQueueMessage = `{"topic":"test_email","args":[${JSON.stringify(testUser)}]}`;

            await emailController.sendTestEmail(testUser.email!, mockRes as unknown as Response);

            expect(mockUserDAO.findUser).toHaveBeenCalledTimes(1);
            expect(mockUserDAO.findUser).toHaveBeenCalledWith({email: testUser.email});
            expect(mockUserDAO.setPasswordExpires).toHaveBeenCalledTimes(0);
            expect(mockMailQueue.addEmail).toHaveBeenCalledTimes(1);
            expect(mockMailQueue.addEmail).toHaveBeenCalledWith(expectedQueueMessage);
            expect(mockRes.status).toHaveBeenCalledTimes(1);
            expect(mockRes.status).toHaveBeenCalledWith(202);
            expect(mockRes.json).toHaveBeenCalledTimes(1);
        });

        it("should throw an error if there's something wrong inside", async () => {
            mockUserDAO.findUser.mockImplementationOnce(() => {
                throw new Error("Generic Error");
            });

            await expect(emailController.sendTestEmail(testUser.email!, mockRes as unknown as Response))
                .rejects.toThrow(Error);
            expect(mockRes.status).toHaveBeenCalledTimes(0);
            expect(mockRes.json).toHaveBeenCalledTimes(0);
        });
    });

    describe("sendRegistrationEmail method", () => {
        it("should find a user and call mailQueue", async () => {
            mockUserDAO.findUser.mockReturnValueOnce(testUser);
            const expectedQueueMessage = `{"topic":"registration_email","args":[${JSON.stringify(testUser)}]}`;

            await emailController.sendRegistrationEmail(testUser.email!, mockRes as unknown as Response);

            expect(mockUserDAO.findUser).toHaveBeenCalledTimes(1);
            expect(mockUserDAO.findUser).toHaveBeenCalledWith({email: testUser.email});
            expect(mockUserDAO.setPasswordExpires).toHaveBeenCalledTimes(0);
            expect(mockMailQueue.addEmail).toHaveBeenCalledTimes(1);
            expect(mockMailQueue.addEmail).toHaveBeenCalledWith(expectedQueueMessage);
            expect(mockRes.status).toHaveBeenCalledTimes(1);
            expect(mockRes.status).toHaveBeenCalledWith(202);
            expect(mockRes.json).toHaveBeenCalledTimes(1);
        });

        it("should throw an error if there's something wrong inside", async () => {
            mockUserDAO.findUser.mockImplementationOnce(() => {
                throw new Error("Generic Error");
            });

            await expect(emailController.sendRegistrationEmail(testUser.email!, mockRes as unknown as Response))
                .rejects.toThrow(Error);
            expect(mockRes.status).toHaveBeenCalledTimes(0);
            expect(mockRes.json).toHaveBeenCalledTimes(0);
        });
    });
});
