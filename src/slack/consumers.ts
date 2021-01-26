import Trade from "../models/trade";
import Bull from "bull";
import logger from "../bootstrap/logger";
import { processTradeAnnounceJob } from "./processors";
import { inspect } from "util";
import { cleanJobForLogging } from "../scheduled_jobs/job_utils";
import { rollbar } from "../bootstrap/rollbar";

export function setupSlackConsumers() {
    logger.info("registering slack consumers");
    const slackQueue = new Bull("slack_queue");
    const cleanLoggedData = (data: any) => {
        const trade: Trade = JSON.parse(data.trade || "{}");
        return {
            tradeId: trade.id,
            status: trade.status,
            participantIds: trade.tradeParticipants?.map(tp => tp.team.id),
            itemIds: trade.tradeItems?.map(ti => ti.tradeItemId),
        };
    };
    const cleanLoggedReturn = (returnValue: any) => returnValue;

    slackQueue.process("trade_announce", x => processTradeAnnounceJob(x));

    slackQueue.on("error", error => {
        logger.error(`Bull error during slack queue cron job: ${inspect(error)}`);
        rollbar.error(error);
    });

    slackQueue.on("active", job => {
        logger.info(`Slack Worker job started: ${inspect(cleanJobForLogging(job, cleanLoggedReturn, cleanLoggedData))}`);
    });

    slackQueue.on("completed", (job, _result) => {
        rollbar.info("Slack Worker completed", cleanJobForLogging(job, cleanLoggedReturn, cleanLoggedData));
        logger.info(`Slack Worker completed: ${inspect(cleanJobForLogging(job, cleanLoggedReturn, cleanLoggedData))}`);
    });

    slackQueue.on("failed", (job, err) => {
        logger.error(`"Slack Worker failed: ${inspect(cleanJobForLogging(job, cleanLoggedReturn, cleanLoggedData))}, ${inspect(err)}`);
        rollbar.error(err);
    });
}
