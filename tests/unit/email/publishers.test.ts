import "jest";
import "jest-extended";
import { EmailPublisher } from "../../../src/email/publishers";
import Bull from "bull";
import { UserFactory } from "../../factories/UserFactory";
import logger from "../../../src/bootstrap/logger";

const mockQueue = {
    add: jest.fn(),
};

beforeAll(() => {
    logger.debug("~~~~~~EMAIL PUBLISHER TESTS BEGIN~~~~~~");
});
afterAll(() => {
    logger.debug("~~~~~~EMAIL PUBLISHER COMPLETE~~~~~~");
});
afterEach(() => {
    mockQueue.add.mockClear();
});

describe("EmailPublisher", () => {
    const publisher = EmailPublisher.getInstance(mockQueue as unknown as Bull.Queue);
    const user = UserFactory.getUser();
    const userJson = JSON.stringify(user);
    const event = {
        event: "request",
        email: "example@example.com",
        id: 134503,
        date: "2020-04-11 00:13:02",
        ts: 1586556782,
        "message-id": "<5d0e2800bbddbd4ed05cc56a@domain.com>",
        ts_event: 1586556782,
    };
    const eventJson = JSON.stringify(event);
    const exponentialBackoff = { attempts: 3, backoff: {type: "exponential", delay: 30000}};
    const linearBackoff = { attempts: 3, backoff: 10000 };

    it("queueResetEmail/1 - should add email job with correct parameters to the emailQueue", async () => {
        await publisher.queueResetEmail(user);
        expect(mockQueue.add).toBeCalledTimes(1);
        expect(mockQueue.add).toHaveBeenCalledWith("reset_pass", {user: userJson, mailType: "reset_pass"}, exponentialBackoff);
    });

    it("queueRegistrationEmail/1 - should add email job with correct parameters to the emailQueue", async () => {
        await publisher.queueRegistrationEmail(user);
        expect(mockQueue.add).toBeCalledTimes(1);
        expect(mockQueue.add).toHaveBeenCalledWith("registration_email", {user: userJson, mailType: "registration_email"}, exponentialBackoff);
    });

    it("queueTestEmail/1 - should add email job with correct parameters to the emailQueue", async () => {
        await publisher.queueTestEmail(user);
        expect(mockQueue.add).toBeCalledTimes(1);
        expect(mockQueue.add).toHaveBeenCalledWith("test_email", {user: userJson, mailType: "test_email"}, exponentialBackoff);
    });

    it("queueWebhookResponse/1 - should add job to handle the webhook response", async () => {
        await publisher.queueWebhookResponse(event);
        expect(mockQueue.add).toBeCalledTimes(1);
        expect(mockQueue.add).toHaveBeenCalledWith("handle_webhook", {event: eventJson, mailType: "handle_webhook"}, linearBackoff);
    });
});
