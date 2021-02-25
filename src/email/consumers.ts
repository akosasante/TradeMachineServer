import Bull from "bull";
import { handleEmailJob, handleTradeEmailJob } from "./processors";
import logger from "../bootstrap/logger";
import { inspect } from "util";
import Trade from "../models/trade";
import { cleanJobForLogging } from "../scheduled_jobs/job_utils";
import User from "../models/user";
import { rollbar } from "../bootstrap/rollbar";

export function setupEmailConsumers() {
    logger.info("registering email consumers");
    const emailQueue = new Bull("email_queue", {settings: {maxStalledCount: 0, lockDuration: 60000}});
    const cleanLoggedData = (data: any) => {
        if (data.user) {
            const user: User = JSON.parse(data.user || "{}");
            return {
                userId: user.id,
                userName: user.displayName,
            };
        } else if (data.trade) {
            const trade: Trade = JSON.parse(data.trade || "{}");
            return {
                tradeId: trade.id,
                status: trade.status,
                participantIds: trade.tradeParticipants?.map(tp => tp.team.id),
                itemIds: trade.tradeItems?.map(ti => ti.tradeItemId),
            };
        } else {
            return JSON.stringify(data);
        }
    };
    const cleanLoggedReturn = (returnValue: any) => {
        return returnValue ? {
            messageId: returnValue?.messageId,
            code: returnValue?.code,
            message: returnValue?.message,
            to: returnValue?.originalMessage.to,
            from: returnValue?.originalMessage.from,
            subject: returnValue?.originalMessage.subject,
        } : "";
    };

    emailQueue.process("reset_pass", handleEmailJob);
    emailQueue.process("registration_email", handleEmailJob);
    emailQueue.process("test_email", handleEmailJob);
    emailQueue.process("handle_webhook", handleEmailJob);
    emailQueue.process("request_trade", handleTradeEmailJob);
    emailQueue.process("trade_declined", handleTradeEmailJob);
    emailQueue.process("trade_accepted", handleTradeEmailJob);

    emailQueue.on("error", error => {
        logger.error(`Bull error during Email Worker job: ${inspect(error)}`);
        rollbar.error("Email Worker error", error);
    });

    emailQueue.on("stalled", job => {
        logger.error(`Bull stalled during Email Worker job: ${inspect(cleanJobForLogging(job, cleanLoggedReturn, cleanLoggedData))}`);
        rollbar.error("Email Worker job stalled", cleanJobForLogging(job, cleanLoggedReturn, cleanLoggedData));
    });

    emailQueue.on("active", job => {
        logger.info(`Email Worker job started: ${inspect(cleanJobForLogging(job, cleanLoggedReturn, cleanLoggedData))}`);
    });

    emailQueue.on("completed", (job, _result) => {
        rollbar.info("Email Worker completed", cleanJobForLogging(job, cleanLoggedReturn, cleanLoggedData));
        logger.info(`Email Worker completed: ${inspect(cleanJobForLogging(job, cleanLoggedReturn, cleanLoggedData))}`);
    });

    emailQueue.on("failed", (job, err) => {
        logger.error(`"Email Worker failed: ${inspect(cleanJobForLogging(job, cleanLoggedReturn, cleanLoggedData))}, ${inspect(err)}`);
        rollbar.error("Email Worker job failed", err);
    });
}
