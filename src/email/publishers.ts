import Bull, { Job, JobOptions, Queue } from "bull";
import { inspect } from "util";
import logger from "../bootstrap/logger";
import { EmailJob, EmailJobName, TradeEmail } from "./processors";
import User from "../models/user";
import { EmailStatusEvent } from "../api/routes/EmailController";
import Trade from "../models/trade";
import { Publisher } from "../scheduled_jobs/publisher";
import { recordJobMetrics } from "../scheduled_jobs/metrics";

export class EmailPublisher extends Publisher {
    private static instance: EmailPublisher;

    private constructor(queue: Queue) {
        super();
        this.queue = queue;
    }

    public static getInstance(queue?: Bull.Queue): EmailPublisher {
        if (!EmailPublisher.instance) {
            let queueName;
            if (process.env.NODE_ENV === "test") {
                queueName = "test_email_queue";
            } else if (process.env.ORM_CONFIG === "staging") {
                queueName = "stg_email_queue";
            } else {
                queueName = "email_queue";
            }
            EmailPublisher.instance = new EmailPublisher(queue || new Bull(queueName));
            recordJobMetrics(EmailPublisher.instance.queue!);
            logger.info(`EmailPublisher initialized with queue: ${queueName}`);
        }

        return EmailPublisher.instance;
    }

    private static isValidEmail(email: string) {
        return !email.includes("@example.com");
    }

    public async queueResetEmail(user: User): Promise<Job<EmailJob> | undefined> {
        return await this.queueEmail(user, "reset_pass");
    }

    public async queueRegistrationEmail(user: User): Promise<Job<EmailJob> | undefined> {
        return await this.queueEmail(user, "registration_email");
    }

    public async queueTestEmail(user: User): Promise<Job<EmailJob> | undefined> {
        return await this.queueEmail(user, "test_email");
    }

    public async queueWebhookResponse(event: EmailStatusEvent): Promise<Bull.Job> {
        const jobName = "handle_webhook";
        const job: EmailJob = {
            event: JSON.stringify(event),
        };
        const opts: JobOptions = { attempts: 3, backoff: 10000 };
        logger.debug(`queuing webhook response: ${inspect(event)}`);
        return await this.queue!.add(jobName, job, opts);
    }

    public async queueTradeRequestMail(trade: Trade, email: string): Promise<Job<TradeEmail> | undefined> {
        return await this.queueTradeEmail(trade, email, "request_trade");
    }

    public async queueTradeDeclinedMail(trade: Trade, email: string): Promise<Job<TradeEmail> | undefined> {
        return await this.queueTradeEmail(trade, email, "trade_declined");
    }

    public async queueTradeAcceptedMail(trade: Trade, email: string): Promise<Job<TradeEmail> | undefined> {
        return await this.queueTradeEmail(trade, email, "trade_accepted");
    }

    private async queueEmail(user: User, jobName: EmailJobName): Promise<Job<EmailJob> | undefined> {
        if (EmailPublisher.isValidEmail(user.email)) {
            const job: EmailJob = {
                user: JSON.stringify(user),
            };
            const opts: JobOptions = { attempts: 3, backoff: { type: "exponential", delay: 30000 } };
            logger.debug(`queuing email job ${jobName}, for entity ${user.id}`);
            return await this.queue!.add(jobName, job, opts);
        }
    }

    private async queueTradeEmail(
        trade: Trade,
        email: string,
        jobName: EmailJobName
    ): Promise<Job<TradeEmail> | undefined> {
        if (EmailPublisher.isValidEmail(email)) {
            const job: TradeEmail = {
                trade: JSON.stringify(trade),
                recipient: email,
            };
            const opts: JobOptions = { attempts: 3, backoff: { type: "exponential", delay: 30000 } };
            logger.debug(`queuing email job ${jobName}, for trade ${trade.id} to ${email}`);
            return await this.queue!.add(jobName, job, opts);
        }
    }
}
