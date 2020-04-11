import Bull, { Job, JobOptions } from "bull";
import { inspect } from "util";
import logger from "../bootstrap/logger";
import { EmailJob, EmailJobName } from "./processors";
import User from "../models/user";

export class EmailPublisher {
    private static instance: EmailPublisher;
    private static emailQueue: Bull.Queue;

    private constructor() { }

    public static getInstance(queue?: Bull.Queue): EmailPublisher {
        if (!EmailPublisher.instance) {
            EmailPublisher.emailQueue = queue || new Bull("email_queue");
            EmailPublisher.instance = new EmailPublisher();
        }

        return EmailPublisher.instance;
    }

    private static async queueEmail(user: User, jobName: EmailJobName) {
        const job: EmailJob = {
            user: JSON.stringify(user),
            mailType: jobName,
        };
        const opts: JobOptions = { attempts: 3, backoff: {type: "exponential", delay: 30000}};
        logger.debug(`queuing email: ${inspect(job)}`);
        return await EmailPublisher.emailQueue.add(job, opts);
    }

    public async queueResetEmail(user: User): Promise<Job<EmailJob>> {
        return await EmailPublisher.queueEmail(user, "reset_pass");
    }

    public async queueRegistrationEmail(user: User): Promise<Job<EmailJob>> {
        return await EmailPublisher.queueEmail(user, "registration_email");
    }

    public async queueTestEmail(user: User): Promise<Job<EmailJob>> {
        return await EmailPublisher.queueEmail(user, "test_email");
    }
}
