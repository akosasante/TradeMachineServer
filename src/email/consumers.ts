import Bull from "bull";
import { processEmailJob } from "./processors";
import logger from "../bootstrap/logger";
import { inspect } from "util";
import Trade from "../models/trade";
import { cleanJobForLogging } from "../scheduled_jobs/job_utils";

export function setupEmailConsumers() {
    logger.info("registering email consumers");
    const emailQueue = new Bull("email_queue");
    const cleanLoggedData = (data: any) => {
        const trade: Trade = JSON.parse(data.entity || "{}");
        return {
            tradeId: trade.id,
            status: trade.status,
            participantIds: trade.tradeParticipants?.map(tp => tp.team.id),
            itemIds: trade.tradeItems?.map(ti => ti.tradeItemId),
        };
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

    emailQueue.process("reset_pass", processEmailJob);
    emailQueue.process("registration_email", processEmailJob);
    emailQueue.process("request_trade", processEmailJob);
    emailQueue.process("test_email", processEmailJob);
    emailQueue.process("handle_webhook", processEmailJob);

    emailQueue.on("error", error => {
        logger.error(`Bull error during email queue cron job: ${inspect(error)}`);
    });

    emailQueue.on("active", job => {
        logger.info(`Email Worker job started: ${inspect(cleanJobForLogging(job, cleanLoggedReturn, cleanLoggedData))}`);
    });

    emailQueue.on("completed", (job, _result) => {
        logger.info(`Email Worker completed: ${inspect(cleanJobForLogging(job, cleanLoggedReturn, cleanLoggedData))}`);
    });

    emailQueue.on("failed", (job, err) => {
        logger.error(`"Email Worker failed: ${inspect(cleanJobForLogging(job, cleanLoggedReturn, cleanLoggedData))}, ${inspect(err)}`);
    });
}
