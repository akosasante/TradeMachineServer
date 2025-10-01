import { TradeFactory } from "../../factories/TradeFactory";
import logger from "../../../src/bootstrap/logger";
import {processTradeAnnounceJob, SlackJob} from "../../../src/slack/processors";
import {Job} from "bull";
import {SlackTradeAnnouncer} from "../../../src/slack/tradeAnnouncer";
import {mockDeep} from "jest-mock-extended";

const mockSlackAnnouncer = mockDeep<typeof SlackTradeAnnouncer>();

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
        const job = { name: "trade_announce", data: { trade: tradeJson } } as Job<SlackJob>;
        await processTradeAnnounceJob(job, mockSlackAnnouncer);
        expect(mockSlackAnnouncer.sendTradeAnnouncement).toHaveBeenCalledTimes(1);
        expect(mockSlackAnnouncer.sendTradeAnnouncement).toHaveBeenCalledWith(trade);
    });
});
