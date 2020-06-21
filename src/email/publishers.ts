import Bull, { Job, JobOptions, Queue } from "bull";
import { inspect } from "util";
import logger from "../bootstrap/logger";
import { EmailJob, EmailJobName, TradeEmail } from "./processors";
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

    private async queueEmail(user: User, jobName: EmailJobName) {
        const job: EmailJob = {
            user: JSON.stringify(user),
        };
        const opts: JobOptions = { attempts: 3, backoff: {type: "exponential", delay: 30000}};
        logger.debug(`queuing email job ${jobName}, for entity ${user.id}`);
        return await this.queue!.add(jobName, job, opts);
    }

    private async queueTradeEmail(trade: Trade, email: string, jobName: EmailJobName): Promise<Job<TradeEmail>> {
        const job: TradeEmail = {
            trade: JSON.stringify(trade),
            recipient: email,
        };
        const opts: JobOptions = { attempts: 3, backoff: {type: "exponential", delay: 30000}};
        logger.debug(`queuing email job ${jobName}, for trade ${trade.id} to ${email}`);
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
            event: JSON.stringify(event),
        };
        const opts: JobOptions = { attempts: 3, backoff: 10000 };
        logger.debug(`queuing webhook response: ${inspect(event)}`);
        return await this.queue!.add(jobName, job, opts);
    }

    public async queueTradeRequestMail(trade: Trade, email: string): Promise<Job<TradeEmail>> {
        return await this.queueTradeEmail(trade, email, "request_trade");
    }

    public async queueTradeDeclinedMail(trade: Trade, email: string): Promise<Job<TradeEmail>> {
        return await this.queueTradeEmail(trade, email, "trade_declined");
    }

    public async queueTradeAcceptedMail(trade: Trade, email: string): Promise<Job<TradeEmail>> {
        return await this.queueTradeEmail(trade, email, "trade_accepted");
    }
}
