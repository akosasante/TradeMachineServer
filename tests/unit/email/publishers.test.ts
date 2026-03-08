import { EmailPublisher } from "../../../src/email/publishers";
import Bull from "bull";
import { UserFactory } from "../../factories/UserFactory";
import logger from "../../../src/bootstrap/logger";
import { TradeFactory } from "../../factories/TradeFactory";
import { mockDeep } from "jest-mock-extended";
import { clearJobMetricsIntervals } from "../../../src/scheduled_jobs/metrics";

const mockQueue = mockDeep<Bull.Queue>();

beforeAll(() => {
    logger.debug("~~~~~~EMAIL PUBLISHER TESTS BEGIN~~~~~~");
});
afterAll(() => {
    // Clear job metrics intervals to prevent Jest from hanging
    clearJobMetricsIntervals();
    logger.debug("~~~~~~EMAIL PUBLISHER COMPLETE~~~~~~");
});
afterEach(() => {
    jest.clearAllMocks();
});

describe("EmailPublisher", () => {
    const publisher = EmailPublisher.getInstance(mockQueue as unknown as Bull.Queue);
    const user = UserFactory.getUser();
    const trade = TradeFactory.getTrade();
    const userJson = JSON.stringify(user);
    const tradeJson = JSON.stringify(trade);
    const exponentialBackoff = { attempts: 3, backoff: { type: "exponential", delay: 30000 } };

    it("queueResetEmail/1 - should add email job with correct parameters to the emailQueue", async () => {
        await publisher.queueResetEmail(user);
        expect(mockQueue.add).toHaveBeenCalledTimes(1);
        expect(mockQueue.add).toHaveBeenCalledWith("reset_pass", { user: userJson }, exponentialBackoff);
    });

    it("queueRegistrationEmail/1 - should add email job with correct parameters to the emailQueue", async () => {
        await publisher.queueRegistrationEmail(user);
        expect(mockQueue.add).toHaveBeenCalledTimes(1);
        expect(mockQueue.add).toHaveBeenCalledWith("registration_email", { user: userJson }, exponentialBackoff);
    });

    it("queueTestEmail/1 - should add email job with correct parameters to the emailQueue", async () => {
        await publisher.queueTestEmail(user);
        expect(mockQueue.add).toHaveBeenCalledTimes(1);
        expect(mockQueue.add).toHaveBeenCalledWith("test_email", { user: userJson }, exponentialBackoff);
    });

    it("queueTradeRequestMail/1 - should add email job with correct parameters to emailQueue", async () => {
        await publisher.queueTradeRequestMail(trade, "test_email@exmple.com");
        expect(mockQueue.add).toHaveBeenCalledTimes(1);
        expect(mockQueue.add).toHaveBeenCalledWith(
            "request_trade",
            {
                trade: tradeJson,
                recipient: "test_email@exmple.com",
            },
            exponentialBackoff
        );
    });

    it("queueTradeDeclinedMail/1 - should add email job with correct parameters to emailQueue", async () => {
        await publisher.queueTradeDeclinedMail(trade, "test_email@exmple.com");
        expect(mockQueue.add).toHaveBeenCalledTimes(1);
        expect(mockQueue.add).toHaveBeenCalledWith(
            "trade_declined",
            {
                trade: tradeJson,
                recipient: "test_email@exmple.com",
            },
            exponentialBackoff
        );
    });

    it("queueTradeAcceptedMail/1 - should add email job with correct parameters to emailQueue", async () => {
        await publisher.queueTradeAcceptedMail(trade, "test_email@exmple.com");
        expect(mockQueue.add).toHaveBeenCalledTimes(1);
        expect(mockQueue.add).toHaveBeenCalledWith(
            "trade_accepted",
            {
                trade: tradeJson,
                recipient: "test_email@exmple.com",
            },
            exponentialBackoff
        );
    });
});
