import {IncomingWebhook} from "@slack/webhook";
import Trade from "../models/trade";
import TradeParticipant from "../models/tradeParticipant";
import logger from "../bootstrap/logger";
import {inspect} from "util";
import TradeFormatter from "./tradeFormatter";

const SlackBlocks = {
    divider: {type: "divider"},
    mrkdwnSection(text: string) {
        return {
            type: "section",
            text: {
                type: "mrkdwn",
                text,
            },
        };
    },
    context(elementTexts: string[]) {
        return {
            type: "context",
            elements: elementTexts.map((text: string) => ({
                type: "mrkdwn",
                text,
            })),
        };
    },
};

export class SlackTradeAnnouncer {
    private static url: string = process.env.SLACK_WEBHOOK_URL || "";
    private static webhook = new IncomingWebhook(SlackTradeAnnouncer.url);

    // eslint-disable-next-line no-empty,@typescript-eslint/no-empty-function
    constructor() {
    }

    public static async buildTradeAnnouncementMsg(trade: Trade) {
        logger.info("building trade announcement mesasge");
        const twoPlayerTrade = trade.tradeParticipants!.length === 2;
        const tradeText = await Promise.all(trade.tradeParticipants!.map((participant: TradeParticipant) => {
            return TradeFormatter.getTradeTextForParticipant(twoPlayerTrade, trade, participant);
        }));

        return {
            text: TradeFormatter.getNotificationText(trade),
            blocks: [
                SlackBlocks.mrkdwnSection(TradeFormatter.getTitleText()),
                SlackBlocks.context([TradeFormatter.getSubtitleText(trade)]),
                SlackBlocks.divider,
                ...(tradeText.flatMap((text: string) => [
                    SlackBlocks.mrkdwnSection(text),
                    SlackBlocks.divider,
                ])),
                SlackBlocks.context([TradeFormatter.getLinkText()]),
            ],
        };
    }

    public static async sendTradeAnnouncement(trade: Trade) {
        logger.info("preparing to send trade announcement");
        const res = await SlackTradeAnnouncer.buildTradeAnnouncementMsg(trade);
        logger.debug(inspect(res));
        return await SlackTradeAnnouncer.webhook.send(res);
    }
}
