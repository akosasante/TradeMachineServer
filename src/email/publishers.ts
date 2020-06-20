import Bull, { Job, JobOptions, Queue } from "bull";
import { inspect } from "util";
import logger from "../bootstrap/logger";
import { EmailJob, EmailJobName } from "./processors";
import User from "../models/user";
import { EmailStatusEvent } from "../api/routes/EmailController";
import Trade from "../models/trade";
import { Publisher } from "../scheduled_jobs/publisher";

export class EmailPublisher extends Publisher {
    private static instance: EmailPublisher;

    private constructor(queue: Queue) {
        super();
        this.queue = queue;
    }

    public static getInstance(queue?: Bull.Queue): EmailPublisher {
        if (!EmailPublisher.instance) {
            const queueName = process.env.NODE_ENV === "test" ? "test_email_queue" : "email_queue";
            EmailPublisher.instance = new EmailPublisher(queue || new Bull(queueName));
        }

        return EmailPublisher.instance;
    }

    private async queueEmail(entity: User|Trade, jobName: EmailJobName) {
        const job: EmailJob = {
            entity: JSON.stringify(entity),
        };
        const opts: JobOptions = { attempts: 3, backoff: {type: "exponential", delay: 30000}};
        logger.debug(`queuing email job ${jobName}, for entity ${entity.id}`);
        return await this.queue!.add(jobName, job, opts);
    }

    public async queueResetEmail(user: User): Promise<Job<EmailJob>> {
        return await this.queueEmail(user, "reset_pass");
    }

    public async queueRegistrationEmail(user: User): Promise<Job<EmailJob>> {
        return await this.queueEmail(user, "registration_email");
    }

    public async queueTestEmail(user: User): Promise<Job<EmailJob>> {
        return await this.queueEmail(user, "test_email");
    }

    public async queueWebhookResponse(event: EmailStatusEvent) {
        const jobName = "handle_webhook";
        const job: EmailJob = {
            entity: JSON.stringify(event),
        };
        const opts: JobOptions = { attempts: 3, backoff: 10000 };
        logger.debug(`queuing webhook response: ${inspect(event)}`);
        return await this.queue!.add(jobName, job, opts);
    }

    public async queueTradeRequestMail(trade: Trade): Promise<Job<EmailJob>> {
        logger.debug("queuing trade request email");
        return await this.queueEmail(trade, "request_trade");
    }
}
