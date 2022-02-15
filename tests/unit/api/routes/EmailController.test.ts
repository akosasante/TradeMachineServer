import { Response } from "express";
import { NotFoundError } from "routing-controllers";
import EmailController from "../../../../src/api/routes/EmailController";
import UserDAO from "../../../../src/DAO/UserDAO";
import { UserFactory } from "../../../factories/UserFactory";
import { EmailPublisher } from "../../../../src/email/publishers";
import logger from "../../../../src/bootstrap/logger";

describe("EmailController", () => {
    const mockUserDAO = {
        findUser: jest.fn(),
        setPasswordExpires: jest.fn(),
    };
    const mockMailPublisher = {
        queueTestEmail: jest.fn(),
        queueWebhookResponse: jest.fn(),
    };

    const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
    };
    const testUser = UserFactory.getUser();
    const emailController = new EmailController(
        mockUserDAO as unknown as UserDAO,
        mockMailPublisher as unknown as EmailPublisher
    );

    beforeAll(() => {
        logger.debug("~~~~~~EMAIL CONTROLLER TESTS BEGIN~~~~~~");
    });
    afterAll(() => {
        logger.debug("~~~~~~EMAIL CONTROLLER TESTS COMPLETE~~~~~~");
    });
    afterEach(() => {
        [mockUserDAO, mockMailPublisher].forEach(mockedThing =>
            Object.values(mockedThing).forEach(mockFn => mockFn.mockReset())
        );
        Object.values(mockRes).forEach(mockFn => mockFn.mockClear());
    });

    describe("sendTestEmail method", () => {
        it("should find a user and call mailQueue", async () => {
            mockUserDAO.findUser.mockResolvedValueOnce(testUser);

            await emailController.sendTestEmail(testUser.email, mockRes as unknown as Response);

            expect(mockUserDAO.findUser).toHaveBeenCalledTimes(1);
            expect(mockUserDAO.findUser).toHaveBeenCalledWith({ email: testUser.email });
            expect(mockUserDAO.setPasswordExpires).toHaveBeenCalledTimes(0);
            expect(mockMailPublisher.queueTestEmail).toHaveBeenCalledTimes(1);
            expect(mockMailPublisher.queueTestEmail).toHaveBeenCalledWith(testUser);
            expect(mockRes.status).toHaveBeenCalledTimes(1);
            expect(mockRes.status).toHaveBeenCalledWith(202);
            expect(mockRes.json).toHaveBeenCalledTimes(1);
            expect(mockRes.json).toHaveBeenCalledWith({ status: "email queued" });
        });

        it("should throw an error if there's something wrong inside", async () => {
            await expect(emailController.sendTestEmail(testUser.email, mockRes as unknown as Response)).rejects.toThrow(
                NotFoundError
            );
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
                // eslint-disable-next-line @typescript-eslint/naming-convention
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
