import { Request, Response } from "express";
import { NotFoundError } from "routing-controllers";
import EmailController from "../../../../src/api/routes/EmailController";
import UserDAO from "../../../../src/DAO/UserDAO";
import { UserFactory } from "../../../factories/UserFactory";
import { EmailPublisher } from "../../../../src/email/publishers";
import logger from "../../../../src/bootstrap/logger";
import { getPrismaClientFromRequest } from "../../../../src/bootstrap/prisma-db";
import ObanDAO from "../../../../src/DAO/v2/ObanDAO";
import { extractTraceContext } from "../../../../src/utils/tracing";

jest.mock("../../../../src/bootstrap/prisma-db");
jest.mock("../../../../src/DAO/v2/ObanDAO");
jest.mock("../../../../src/utils/tracing");

const mockEnqueueEmailWebhookJob = jest.fn().mockResolvedValue({});
const mockGetPrismaClientFromRequest = getPrismaClientFromRequest as jest.Mock;
const mockExtractTraceContext = extractTraceContext as jest.Mock;

describe("EmailController", () => {
    const mockUserDAO = {
        findUser: jest.fn(),
        setPasswordExpires: jest.fn(),
    };
    const mockMailPublisher = {
        queueTestEmail: jest.fn(),
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
    beforeEach(() => {
        mockGetPrismaClientFromRequest.mockReturnValue({ obanJob: {} });
        mockExtractTraceContext.mockReturnValue(null);
        (ObanDAO as jest.Mock).mockImplementation(() => ({
            enqueueEmailWebhookJob: mockEnqueueEmailWebhookJob,
        }));
    });
    afterEach(() => {
        [mockUserDAO, mockMailPublisher].forEach(mockedThing =>
            Object.values(mockedThing).forEach(mockFn => mockFn.mockReset())
        );
        Object.values(mockRes).forEach(mockFn => mockFn.mockClear());
        mockEnqueueEmailWebhookJob.mockReset();
        jest.clearAllMocks();
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
        const webhookEvent = {
            event: "delivered",
            email: "example@example.com",
            id: 134503,
            date: "2020-04-11 00:13:02",
            ts: 1586556782,
            /* eslint-disable @typescript-eslint/naming-convention */
            "message-id": "<5d0e2800bbddbd4ed05cc56a@domain.com>",
            /* eslint-enable @typescript-eslint/naming-convention */
            ts_event: 1586556782,
        };
        const mockReq = {} as Request;

        it("should enqueue an Oban webhook job and return 200", async () => {
            await emailController.receiveSendInMailWebhook(webhookEvent, mockRes as unknown as Response, mockReq);

            expect(mockEnqueueEmailWebhookJob).toHaveBeenCalledTimes(1);
            expect(mockEnqueueEmailWebhookJob).toHaveBeenCalledWith(
                expect.objectContaining({
                    message_id: "<5d0e2800bbddbd4ed05cc56a@domain.com>",
                    event: "delivered",
                    env: "production",
                })
            );
            expect(mockRes.status).toHaveBeenCalledWith(200);
            expect(mockRes.json).toHaveBeenCalledWith({});
        });

        it("should return 500 when prisma client is unavailable", async () => {
            mockGetPrismaClientFromRequest.mockReturnValueOnce(undefined);

            await emailController.receiveSendInMailWebhook(webhookEvent, mockRes as unknown as Response, mockReq);

            expect(mockEnqueueEmailWebhookJob).not.toHaveBeenCalled();
            expect(mockRes.status).toHaveBeenCalledWith(500);
        });
    });
});
