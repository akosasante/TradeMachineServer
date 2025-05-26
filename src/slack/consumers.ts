import Trade from "../models/trade";
import Bull from "bull";
import logger from "../bootstrap/logger";
import { processTradeAnnounceJob } from "./processors";
import { inspect } from "util";
import { cleanJobForLogging } from "../scheduled_jobs/job_utils";
import { rollbar } from "../bootstrap/rollbar";
import { recordJobMetrics } from "../scheduled_jobs/metrics";

export function setupSlackConsumers(): void {
    logger.info("registering slack consumers");
    const queueName = process.env.ORM_CONFIG === "staging" ? "stg_slack_queue" : "slack_queue"; // TODO: Should this also have a conditional for test env?
    const slackQueue = new Bull(queueName);
    const cleanLoggedData = (data: any) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-argument
        const trade: Trade = JSON.parse(data.trade || "{}");
        return {
            tradeId: trade.id,
            status: trade.status,
            participantIds: trade.tradeParticipants?.map(tp => tp.team.id),
            itemIds: trade.tradeItems?.map(ti => ti.tradeItemId),
        };
    };
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    const cleanLoggedReturn = (returnValue: any) => returnValue;

    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    void slackQueue.process("trade_announce", x => processTradeAnnounceJob(x));

    slackQueue.on("error", error => {
        logger.error(`Bull error during Slack Worker job: ${inspect(error)}`);
        rollbar.error("Slack Worker job error", error);
    });

    slackQueue.on("stalled", job => {
        logger.error(
            `Bull stalled during Slack Worker job: ${inspect(
                cleanJobForLogging(job, cleanLoggedReturn, cleanLoggedData)
            )}`
        );
        rollbar.error("Slack Worker job stalled", cleanJobForLogging(job, cleanLoggedReturn, cleanLoggedData));
    });

    slackQueue.on("active", job => {
        logger.info(
            `Slack Worker job started: ${inspect(cleanJobForLogging(job, cleanLoggedReturn, cleanLoggedData))}`
        );
    });

    slackQueue.on("completed", (job, _result) => {
        rollbar.info("Slack Worker completed", cleanJobForLogging(job, cleanLoggedReturn, cleanLoggedData));
        logger.info(`Slack Worker completed: ${inspect(cleanJobForLogging(job, cleanLoggedReturn, cleanLoggedData))}`);
    });

    slackQueue.on("failed", (job, err) => {
        logger.error(
            `"Slack Worker failed: ${inspect(cleanJobForLogging(job, cleanLoggedReturn, cleanLoggedData))}, ${inspect(
                err
            )}`
        );
        rollbar.error("Slack Worker failed", err);
    });

    recordJobMetrics(slackQueue);
    logger.info("Slack consumers registered successfully");
}
