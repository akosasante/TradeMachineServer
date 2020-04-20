import Bull, { Job } from "bull";
import { inspect } from "util";
import { EmailJob, processEmailJob } from "./processors";
import logger from "../bootstrap/logger";

const emailQueue = new Bull("email_queue");

emailQueue.process(async (emailJob: Job<EmailJob>) => {
    logger.debug(`processing job: ${inspect(emailJob)}`);
    return await processEmailJob(emailJob);
});
