import { Response } from "express";
import "jest";
import "jest-extended";
import { NotFoundError } from "routing-controllers";
import EmailController from "../../../../src/api/routes/EmailController";
import UserDAO from "../../../../src/DAO/UserDAO";
import { UserFactory } from "../../../factories/UserFactory";
import { EmailPublisher } from "../../../../src/queues/publishers";
import logger from "../../../../src/bootstrap/logger";

describe("EmailController", () => {
    const mockUserDAO = {
        findUser: jest.fn(),
        setPasswordExpires: jest.fn(),
    };
    const mockMailPublisher = {
        queueResetEmail: jest.fn(),
        queueTestEmail: jest.fn(),
        queueRegistrationEmail: jest.fn(),
        queueWebhookResponse: jest.fn(),
    };

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
    const testUser = UserFactory.getUser();
    const emailController = new EmailController(mockUserDAO as unknown as UserDAO, mockMailPublisher as unknown as EmailPublisher);

    beforeAll(() => {
        logger.debug("~~~~~~EMAIL CONTROLLER TESTS BEGIN~~~~~~");
    });
    afterAll(() => {
        logger.debug("~~~~~~EMAIL CONTROLLER TESTS COMPLETE~~~~~~");
    });
    afterEach(() => {
        [mockUserDAO, mockMailPublisher, mockRes].forEach(mockedThing =>
            Object.entries(mockedThing).forEach((kvp: [string, jest.Mock<any, any>]) => {
                kvp[1].mockClear();
            }));
    });

    describe("sendResetEmail method", () => {
        it("should find a user, set a new password expiry date, and call mailQueue", async () => {
            mockUserDAO.findUser.mockReturnValueOnce(testUser);

            await emailController.sendResetEmail(testUser.email!, mockRes as unknown as Response);

            expect(mockUserDAO.findUser).toHaveBeenCalledTimes(1);
            expect(mockUserDAO.findUser).toHaveBeenCalledWith({email: testUser.email});
            expect(mockUserDAO.setPasswordExpires).toHaveBeenCalledTimes(1);
            expect(mockUserDAO.setPasswordExpires).toHaveBeenCalledWith(testUser.id);
            expect(mockMailPublisher.queueResetEmail).toHaveBeenCalledTimes(1);
            expect(mockMailPublisher.queueResetEmail).toHaveBeenCalledWith(testUser);
            expect(mockRes.status).toHaveBeenCalledTimes(1);
            expect(mockRes.status).toHaveBeenCalledWith(202);
            expect(mockRes.json).toHaveBeenCalledTimes(1);
            expect(mockRes.json).toHaveBeenCalledWith({status: "email queued"});
        });

        it("should throw an error if no user found", async () => {
            await expect(emailController.sendResetEmail(testUser.email!, mockRes as unknown as Response))
                .rejects.toThrow(NotFoundError);
            expect(mockRes.status).toHaveBeenCalledTimes(0);
            expect(mockRes.json).toHaveBeenCalledTimes(0);
        });
    });

    describe("sendTestEmail method", () => {
        it("should find a user and call mailQueue", async () => {
            mockUserDAO.findUser.mockReturnValueOnce(testUser);

            await emailController.sendTestEmail(testUser.email!, mockRes as unknown as Response);

            expect(mockUserDAO.findUser).toHaveBeenCalledTimes(1);
            expect(mockUserDAO.findUser).toHaveBeenCalledWith({email: testUser.email});
            expect(mockUserDAO.setPasswordExpires).toHaveBeenCalledTimes(0);
            expect(mockMailPublisher.queueTestEmail).toHaveBeenCalledTimes(1);
            expect(mockMailPublisher.queueTestEmail).toHaveBeenCalledWith(testUser);
            expect(mockRes.status).toHaveBeenCalledTimes(1);
            expect(mockRes.status).toHaveBeenCalledWith(202);
            expect(mockRes.json).toHaveBeenCalledTimes(1);
            expect(mockRes.json).toHaveBeenCalledWith({status: "email queued"});
        });

        it("should throw an error if there's something wrong inside", async () => {
            await expect(emailController.sendTestEmail(testUser.email!, mockRes as unknown as Response))
                .rejects.toThrow(NotFoundError);
            expect(mockRes.status).toHaveBeenCalledTimes(0);
            expect(mockRes.json).toHaveBeenCalledTimes(0);
        });
    });

    describe("sendRegistrationEmail method", () => {
        it("should find a user and call mailQueue", async () => {
            mockUserDAO.findUser.mockReturnValueOnce(testUser);

            await emailController.sendRegistrationEmail(testUser.email!, mockRes as unknown as Response);

            expect(mockUserDAO.findUser).toHaveBeenCalledTimes(1);
            expect(mockUserDAO.findUser).toHaveBeenCalledWith({email: testUser.email});
            expect(mockUserDAO.setPasswordExpires).toHaveBeenCalledTimes(0);
            expect(mockMailPublisher.queueRegistrationEmail).toHaveBeenCalledTimes(1);
            expect(mockMailPublisher.queueRegistrationEmail).toHaveBeenCalledWith(testUser);
            expect(mockRes.status).toHaveBeenCalledTimes(1);
            expect(mockRes.status).toHaveBeenCalledWith(202);
            expect(mockRes.json).toHaveBeenCalledTimes(1);
            expect(mockRes.json).toHaveBeenCalledWith({status: "email queued"});
        });

        it("should throw an error if there's something wrong inside", async () => {
            await expect(emailController.sendRegistrationEmail(testUser.email!, mockRes as unknown as Response))
                .rejects.toThrow(NotFoundError);
            expect(mockRes.status).toHaveBeenCalledTimes(0);
            expect(mockRes.json).toHaveBeenCalledTimes(0);
        });
    });

    describe("receiveSendInMailWebhook method", () => {
        it("should return 200 with an empty body", async () => {
            const webhookEvent = {
                event: "request",
                email: "example@example.com",
                id: 134503,
                date: "2020-04-11 00:13:02",
                ts: 1586556782,
                "message-id": "<5d0e2800bbddbd4ed05cc56a@domain.com>",
                ts_event: 1586556782,
            };

            await emailController.receiveSendInMailWebhook(webhookEvent, mockRes as unknown as Response);

            expect(mockMailPublisher.queueWebhookResponse).toHaveBeenCalledTimes(1);
            expect(mockMailPublisher.queueWebhookResponse).toHaveBeenCalledWith(webhookEvent);
            expect(mockRes.status).toHaveBeenCalledTimes(1);
            expect(mockRes.status).toHaveBeenCalledWith(200);
            expect(mockRes.json).toHaveBeenCalledTimes(1);
            expect(mockRes.json).toHaveBeenCalledWith({});
        });
    });
});
