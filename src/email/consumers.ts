import Bull from "bull";
import { handleEmailJob, handleTradeEmailJob } from "./processors";
import logger from "../bootstrap/logger";
import { inspect } from "util";
import Trade from "../models/trade";
import { cleanJobForLogging } from "../scheduled_jobs/job_utils";
import User from "../models/user";
import Rollbar from "rollbar";

const rollbar = new Rollbar({
    accessToken: process.env.ROLLBAR_TOKEN,
    environment: process.env.NODE_ENV,
    verbose: true,
});

export function setupEmailConsumers() {
    logger.info("registering email consumers");
    const emailQueue = new Bull("email_queue");
    const cleanLoggedData = (data: any) => {
        if (data.user) {
            const user: User = JSON.parse(data.parse || "{}");
            return {
                userId: user.id,
                userName: user.displayName,
            };
        } else if (data.trade) {
            const trade: Trade = JSON.parse(data.entity || "{}");
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
        return {
            messageId: returnValue?.messageId,
            code: returnValue?.code,
            message: returnValue?.message,
            to: returnValue?.originalMessage.to,
            from: returnValue?.originalMessage.from,
            subject: returnValue?.originalMessage.subject,
        };
    };

    emailQueue.process("reset_pass", handleEmailJob);
    emailQueue.process("registration_email", handleEmailJob);
    emailQueue.process("test_email", handleEmailJob);
    emailQueue.process("handle_webhook", handleEmailJob);
    emailQueue.process("request_trade", handleTradeEmailJob);
    emailQueue.process("trade_declined", handleTradeEmailJob);
    emailQueue.process("trade_accepted", handleTradeEmailJob);

    emailQueue.on("error", error => {
        logger.error(`Bull error during email queue job: ${inspect(error)}`);
        rollbar.error(error);
    });

    emailQueue.on("active", job => {
        logger.info(`Email Worker job started: ${inspect(cleanJobForLogging(job, cleanLoggedReturn, cleanLoggedData))}`);
    });

    emailQueue.on("completed", (job, _result) => {
        logger.info(`Email Worker completed: ${inspect(cleanJobForLogging(job, cleanLoggedReturn, cleanLoggedData))}`);
    });

    emailQueue.on("failed", (job, err) => {
        logger.error(`"Email Worker failed: ${inspect(cleanJobForLogging(job, cleanLoggedReturn, cleanLoggedData))}, ${inspect(err)}`);
        rollbar.error(err);
    });
}
