import { TradeFactory } from "../../factories/TradeFactory";
import logger from "../../../src/bootstrap/logger";
import { processTradeAnnounceJob } from "../../../src/slack/processors";

const mockSlackAnnouncer = {
    sendTradeAnnouncement: jest.fn(),
};

const trade = TradeFactory.getTrade();
const tradeJson = JSON.stringify(trade);

beforeAll(() => {
    logger.debug("~~~~~~SLACK QUEUE PROCESSORS TESTS BEGIN~~~~~~");
});
afterAll(() => {
    logger.debug("~~~~~~SLACK QUEUE PROCESSORS TESTS COMPLETE~~~~~~");
});
afterEach(() => {
    Object.values(mockSlackAnnouncer).forEach(mockFn => mockFn.mockReset());
});

describe("Slack queue processors", () => {
    it("processTradeAnnounceJob - should pass the trade into the slack announcer", async () => {
        // @ts-ignore
        await processTradeAnnounceJob({ name: "trade_announce", data: { trade: tradeJson } }, mockSlackAnnouncer);
        expect(mockSlackAnnouncer.sendTradeAnnouncement).toHaveBeenCalledTimes(1);
        expect(mockSlackAnnouncer.sendTradeAnnouncement).toHaveBeenCalledWith(trade);
    });
});
