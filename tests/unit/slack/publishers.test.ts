import logger from "../../../src/bootstrap/logger";
import { SlackPublisher } from "../../../src/slack/publishers";
import Bull from "bull";
import { TradeFactory } from "../../factories/TradeFactory";
import { mockDeep } from "jest-mock-extended";
import { clearJobMetricsIntervals } from "../../../src/scheduled_jobs/metrics";

const mockQueue = mockDeep<Bull.Queue>();

beforeAll(() => {
    logger.debug("~~~~~~SLACK PUBLISHER TESTS BEGIN~~~~~~");
});
afterAll(() => {
    // Clear job metrics intervals to prevent Jest from hanging
    clearJobMetricsIntervals();
    logger.debug("~~~~~~SLACK PUBLISHER COMPLETE~~~~~~");
});
afterEach(() => {
    jest.clearAllMocks();
});

describe("SlackPublisher", () => {
    const publisher = SlackPublisher.getInstance(mockQueue as unknown as Bull.Queue);
    const trade = TradeFactory.getTrade();
    const tradeJson = JSON.stringify(trade);
    const exponentialBackoff = { attempts: 3, backoff: { type: "exponential", delay: 30000 } };

    it("queueTradeAnnouncement/1 - should add a trade announcement job", async () => {
        await publisher.queueTradeAnnouncement(trade);
        expect(mockQueue.add).toHaveBeenCalledTimes(1);
        expect(mockQueue.add).toHaveBeenCalledWith("trade_announce", { trade: tradeJson }, exponentialBackoff);
    });
});
