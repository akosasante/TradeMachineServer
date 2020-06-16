import "jest";
import "jest-extended";
import { UserFactory } from "../../factories/UserFactory";
import { processEmailJob, handleWebhookResponse } from "../../../src/email/processors";
import { Emailer } from "../../../src/email/mailer";
import logger from "../../../src/bootstrap/logger";
import EmailDAO from "../../../src/DAO/EmailDAO";
import {TradeFactory} from "../../factories/TradeFactory";

jest.mock( "../../../src/email/mailer", () => ({
    Emailer: {
        sendPasswordResetEmail: jest.fn(),
        sendTestEmail: jest.fn(),
        sendRegistrationEmail: jest.fn(),
        sendTradeRequestEmail: jest.fn(),
    },
}));

const mockEmailDAO = {
    getEmailByMessageId: jest.fn(),
};

const user = UserFactory.getUser();
const trade = TradeFactory.getTrade();
const userJson = JSON.stringify(user);
const tradeJson = JSON.stringify(trade);

beforeAll(() => {
    logger.debug("~~~~~~QUEUE PROCESSORS TESTS BEGIN~~~~~~");
});
afterAll(() => {
    logger.debug("~~~~~~QUEUE PROCESSORS TESTS COMPLETE~~~~~~");
});
afterEach(() => {
    [Emailer, mockEmailDAO].forEach(mockedThing =>
        Object.values(mockedThing).forEach(mockFn => mockFn.mockReset()));
});

describe("Queue processors", () => {
    describe("processEmailJob/1 - it should call the appropriate Emailer methods with the right arguments", () => {
        it("calls sendPasswordResetEmail", async () => {
            // @ts-ignore
            await processEmailJob({name: "reset_pass", data: { entity: userJson }});
            expect(Emailer.sendPasswordResetEmail).toBeCalledTimes(1);
            expect(Emailer.sendPasswordResetEmail).toBeCalledWith(user);
        });
        it("calls sendTestEmail", async () => {
            // @ts-ignore
            await processEmailJob({ name: "test_email", data: { entity: userJson } });
            expect(Emailer.sendTestEmail).toBeCalledTimes(1);
            expect(Emailer.sendTestEmail).toBeCalledWith(user);
        });
        it("calls sendRegistrationEmail", async () => {
            // @ts-ignore
            await processEmailJob({ name: "registration_email", data: { entity: userJson } });
            expect(Emailer.sendRegistrationEmail).toBeCalledTimes(1);
            expect(Emailer.sendRegistrationEmail).toBeCalledWith(user);
        });
        it("calls sendTradeRequestEmail", async () => {
            // @ts-ignore
            await processEmailJob({ name: "request_trade", data: { entity: tradeJson } });
            expect(Emailer.sendTradeRequestEmail).toBeCalledTimes(1);
            expect(Emailer.sendTradeRequestEmail).toBeCalledWith(trade);
        });
    });

    it("handleWebhookResponse - it should get the email by id and that's it for now", async () => {
        const webhookEvent = {
            event: "request",
            email: "example@example.com",
            id: 134503,
            date: "2020-04-11 00:13:02",
            ts: 1586556782,
            "message-id": "<5d0e2800bbddbd4ed05cc56a@domain.com>",
            ts_event: 1586556782,
        };
        await handleWebhookResponse(webhookEvent, mockEmailDAO as unknown as EmailDAO);
        expect(mockEmailDAO.getEmailByMessageId).toHaveBeenCalledTimes(1);
        expect(mockEmailDAO.getEmailByMessageId).toHaveBeenCalledWith("<5d0e2800bbddbd4ed05cc56a@domain.com>");
    });
});
