import logger from "../../../src/bootstrap/logger";
import TradeFormatter from "../../../src/slack/tradeFormatter";
import { TradeFactory } from "../../factories/TradeFactory";
import { SlackTradeAnnouncer } from "../../../src/slack/tradeAnnouncer";
import { IncomingWebhook } from "@slack/webhook";

jest.mock("../../../src/slack/tradeFormatter");
jest.mock("@slack/webhook");

const mockedIncomingWebhook = IncomingWebhook as jest.MockedClass<typeof IncomingWebhook>;
const trade = TradeFactory.getTrade();
const mockedTradeFormatter = TradeFormatter as jest.MockedObject<typeof TradeFormatter>;
mockedTradeFormatter.getTradeTextForParticipant.mockResolvedValue("trade participant text");
mockedTradeFormatter.getNotificationText.mockReturnValue("notification text");
mockedTradeFormatter.getTitleText.mockReturnValue("title text");
mockedTradeFormatter.getSubtitleText.mockReturnValue("subtitle text");
mockedTradeFormatter.getLinkText.mockReturnValue("link text");

beforeAll(() => {
    logger.debug("~~~~~~SLACK TRADE ANNOUNCER TESTS BEGIN~~~~~~");
});
afterAll(() => {
    logger.debug("~~~~~~SLACK TRADE ANNOUNCER TESTS COMPLETE~~~~~~");
});
afterEach(() => {
    mockedTradeFormatter.getTradeTextForParticipant.mockClear();
    mockedTradeFormatter.getNotificationText.mockClear();
    mockedTradeFormatter.getTitleText.mockClear();
    mockedTradeFormatter.getSubtitleText.mockClear();
    mockedTradeFormatter.getLinkText.mockClear();
});

describe("SlackTradeAnnouncer class", () => {
    const expected = {
        text: "notification text",
        blocks: [
            { type: "section", text: { type: "mrkdwn", text: "title text" } },
            { type: "context", elements: [{ type: "mrkdwn", text: "subtitle text" }] },
            { type: "divider" },
            { type: "section", text: { type: "mrkdwn", text: "trade participant text" } },
            { type: "divider" },
            { type: "section", text: { type: "mrkdwn", text: "trade participant text" } },
            { type: "divider" },
            { type: "context", elements: [{ type: "mrkdwn", text: "link text" }] },
        ],
    };

    it("buildTradeAnnouncementMsg/1 - should call the appropriate formatting methods", async () => {
        await SlackTradeAnnouncer.buildTradeAnnouncementMsg(trade);
        expect(mockedTradeFormatter.getTradeTextForParticipant).toHaveBeenCalledTimes(2);
        expect(mockedTradeFormatter.getTradeTextForParticipant).toHaveBeenCalledWith(
            true,
            trade,
            trade.tradeParticipants![0]
        );
        expect(mockedTradeFormatter.getTradeTextForParticipant).toHaveBeenCalledWith(
            true,
            trade,
            trade.tradeParticipants![1]
        );

        expect(mockedTradeFormatter.getNotificationText).toHaveBeenCalledTimes(1);
        expect(mockedTradeFormatter.getNotificationText).toHaveBeenCalledWith(trade);

        expect(mockedTradeFormatter.getSubtitleText).toHaveBeenCalledTimes(1);
        expect(mockedTradeFormatter.getSubtitleText).toHaveBeenCalledWith(trade);

        expect(mockedTradeFormatter.getLinkText).toHaveBeenCalledTimes(1);
        expect(mockedTradeFormatter.getLinkText).toHaveBeenCalledWith();
    });
    it("buildTradeAnnouncementMsg/1 - should return the expected slack message object", async () => {
        const res = await SlackTradeAnnouncer.buildTradeAnnouncementMsg(trade);
        expect(res).toMatchObject(expected);
    });
    it("sendTradeAnnouncement/1 - should call the slack webhook send method", async () => {
        await SlackTradeAnnouncer.sendTradeAnnouncement(trade);
        const mockInstance = mockedIncomingWebhook.mock.instances[0];
        expect(mockInstance.send).toHaveBeenCalledTimes(1);
        expect(mockInstance.send).toHaveBeenCalledWith(expected);
    });
});
