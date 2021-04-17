import { Job } from "bull";
import { SlackTradeAnnouncer } from "./tradeAnnouncer";
import logger from "../bootstrap/logger";
import Trade from "../models/trade";

export interface SlackJob {
    trade?: string; // JSON representation of trade
}

export async function processTradeAnnounceJob(tradeJob: Job<SlackJob>, slackAnnouncer = SlackTradeAnnouncer): Promise<void> {
    logger.debug(`processing ${tradeJob.name} trade job#${tradeJob.id}`);
    if (tradeJob.data.trade) {
        const trade = new Trade(JSON.parse(tradeJob.data.trade));
        await slackAnnouncer.sendTradeAnnouncement(trade);
    }
}
