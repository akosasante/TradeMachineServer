import { UserFactory } from "../../factories/UserFactory";
import { handleEmailJob, handleTradeEmailJob, handleWebhookResponse } from "../../../src/email/processors";
import { EMAILER } from "../../../src/email/mailer";
import logger from "../../../src/bootstrap/logger";
import EmailDAO from "../../../src/DAO/EmailDAO";
import { TradeFactory } from "../../factories/TradeFactory";

jest.mock("../../../src/email/mailer", () => ({
    // eslint-disable-next-line @typescript-eslint/naming-convention
    EMAILER: {
        sendPasswordResetEmail: jest.fn(),
        sendTestEmail: jest.fn(),
        sendRegistrationEmail: jest.fn(),
        sendTradeRequestEmail: jest.fn(),
        sendTradeDeclinedEmail: jest.fn(),
        sendTradeSubmissionEmail: jest.fn(),
    },
}));

const mockEmailDAO = {
    getEmailByMessageId: jest.fn(),
    updateEmail: jest.fn(),
};

const user = UserFactory.getUser();
const trade = TradeFactory.getTrade();
const userJson = JSON.stringify(user);
const tradeJson = JSON.stringify(trade);

beforeAll(() => {
    logger.debug("~~~~~~EMAIL QUEUE PROCESSORS TESTS BEGIN~~~~~~");
});
afterAll(() => {
    logger.debug("~~~~~~EMAIL QUEUE PROCESSORS TESTS COMPLETE~~~~~~");
});
afterEach(() => {
    [EMAILER, mockEmailDAO].forEach(mockedThing =>
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-return
        Object.values(mockedThing).forEach(mockFn => mockFn.mockReset())
    );
});

describe("Email queue processors", () => {
    describe("handleEmailJob/1 - it should call the appropriate EMAILER methods with the right arguments", () => {
        it("calls sendPasswordResetEmail", async () => {
            // @ts-ignore
            await handleEmailJob({ name: "reset_pass", data: { user: userJson } });
            expect(EMAILER.sendPasswordResetEmail).toHaveBeenCalledTimes(1);
            expect(EMAILER.sendPasswordResetEmail).toHaveBeenCalledWith(user);
        });
        it("calls sendTestEmail", async () => {
            // @ts-ignore
            await handleEmailJob({ name: "test_email", data: { user: userJson } });
            expect(EMAILER.sendTestEmail).toHaveBeenCalledTimes(1);
            expect(EMAILER.sendTestEmail).toHaveBeenCalledWith(user);
        });
        it("calls sendRegistrationEmail", async () => {
            // @ts-ignore
            await handleEmailJob({ name: "registration_email", data: { user: userJson } });
            expect(EMAILER.sendRegistrationEmail).toHaveBeenCalledTimes(1);
            expect(EMAILER.sendRegistrationEmail).toHaveBeenCalledWith(user);
        });
    });

    describe("handleTradeEmailJob/1 - it should call the appropriate EMAILER methods with the right arguments", () => {
        it("should call sendTradeRequestEmail for request_trade jobs", async () => {
            // @ts-ignore
            await handleTradeEmailJob({
                name: "request_trade",
                data: { trade: tradeJson, recipient: "me@example.com" },
            });
            expect(EMAILER.sendTradeRequestEmail).toHaveBeenCalledTimes(1);
            expect(EMAILER.sendTradeRequestEmail).toHaveBeenCalledWith("me@example.com", trade);
        });
        it("should call sendTradeDeclinedEmail for trade_declined jobs", async () => {
            // @ts-ignore
            await handleTradeEmailJob({
                name: "trade_declined",
                data: { trade: tradeJson, recipient: "me@example.com" },
            });
            expect(EMAILER.sendTradeDeclinedEmail).toHaveBeenCalledTimes(1);
            expect(EMAILER.sendTradeDeclinedEmail).toHaveBeenCalledWith("me@example.com", trade);
        });
        it("should call sendTradeSubmissionEmail for trade_accepted jobs", async () => {
            // @ts-ignore
            await handleTradeEmailJob({
                name: "trade_accepted",
                data: { trade: tradeJson, recipient: "me@example.com" },
            });
            expect(EMAILER.sendTradeSubmissionEmail).toHaveBeenCalledTimes(1);
            expect(EMAILER.sendTradeSubmissionEmail).toHaveBeenCalledWith("me@example.com", trade);
        });
    });

    it("handleWebhookResponse - it should get the email by id and that's it for now", async () => {
        const webhookEvent = {
            event: "request",
            email: "example@example.com",
            id: 134503,
            date: "2020-04-11 00:13:02",
            ts: 1586556782,
            /* eslint-disable @typescript-eslint/naming-convention */
            "message-id": "<5d0e2800bbddbd4ed05cc56a@domain.com>",
            ts_event: 1586556782,
            /* eslint-enable @typescript-eslint/naming-convention */
        };
        await handleWebhookResponse(webhookEvent, mockEmailDAO as unknown as EmailDAO);
        expect(mockEmailDAO.getEmailByMessageId).toHaveBeenCalledTimes(1);
        expect(mockEmailDAO.getEmailByMessageId).toHaveBeenCalledWith("<5d0e2800bbddbd4ed05cc56a@domain.com>");
    });
});
