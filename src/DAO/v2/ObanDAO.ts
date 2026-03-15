/* eslint-disable @typescript-eslint/naming-convention */

import { Prisma, oban_job_state } from "@prisma/client";
import { ExtendedPrismaClient } from "../../bootstrap/prisma-db";

type ObanEnv = "production" | "staging" | "development";

// Shared trace context shape
interface TraceContext {
    traceparent: string;
    tracestate?: string;
}

// Job type interfaces

export interface UserEmailJobData {
    env: ObanEnv;
    email_type: "reset_password" | "registration_email";
    data: string; // user ID
    trace_context?: TraceContext;
}

export interface TradeRequestJobData {
    env: ObanEnv;
    email_type: "trade_request";
    trade_id: string;
    recipient_user_id: string;
    accept_url: string;
    decline_url: string;
    trace_context?: TraceContext;
}

export interface TradeDeclinedJobData {
    env: ObanEnv;
    email_type: "trade_declined";
    trade_id: string;
    recipient_user_id: string;
    is_creator: boolean;
    decline_url?: string; // V3 only: /trades/:id summary page (no token); omitted for V2
    trace_context?: TraceContext;
}

export interface TradeSubmitJobData {
    env: ObanEnv;
    email_type: "trade_submit";
    trade_id: string;
    recipient_user_id: string;
    submit_url: string; // V3: /trades/:id?action=submit&token=… or V2: /trade/:id/submit
    trace_context?: TraceContext;
}

// Union of all jobs handled by TradeMachine.Jobs.EmailWorker
export type EmailJobData = UserEmailJobData | TradeRequestJobData | TradeDeclinedJobData | TradeSubmitJobData;

export interface DiscordJobData {
    env: ObanEnv;
    job_type: "trade_announcement";
    data: string; // trade ID
    trace_context?: TraceContext;
}

export interface WebhookStatusJobData {
    env: ObanEnv;
    message_id: string;
    event: string; // e.g. "delivered", "opened", "bounced"
    email?: string;
    reason?: string;
    trace_context?: TraceContext;
}

export interface CreateObanJobInput {
    queue: string;
    worker: string;
    args: EmailJobData | DiscordJobData | WebhookStatusJobData;
    scheduled_at?: Date;
    priority?: number;
    max_attempts?: number;
}

type ObanJob = Prisma.Result<ExtendedPrismaClient["obanJob"], Record<string, unknown>, "create">;

export default class ObanDAO {
    private readonly obanJobsDb: ExtendedPrismaClient["obanJob"];

    constructor(obanJobsDb: ExtendedPrismaClient["obanJob"] | undefined) {
        if (!obanJobsDb) {
            throw new Error("ObanDAO must be initialized with a PrismaClient obanJob instance!");
        }
        this.obanJobsDb = obanJobsDb;
    }

    /**
     * Enqueue a job for the Elixir application to process
     */
    public async enqueueJob(jobInput: CreateObanJobInput): Promise<ObanJob> {
        return await this.obanJobsDb.create({
            data: {
                queue: jobInput.queue,
                worker: jobInput.worker,
                args: jobInput.args as unknown as Prisma.JsonObject,
                scheduled_at: jobInput.scheduled_at || new Date(),
                priority: jobInput.priority || 0,
                max_attempts: jobInput.max_attempts || 20,
                state: oban_job_state.available,
            },
        });
    }

    /**
     * Enqueue an email job via TradeMachine.Jobs.EmailWorker.
     * Single place that owns the queue name and worker for all email jobs.
     */
    public async enqueueEmailJob(emailJobData: EmailJobData): Promise<ObanJob> {
        return this.enqueueJob({
            queue: "emails",
            worker: "TradeMachine.Jobs.EmailWorker",
            args: emailJobData,
        });
    }

    /**
     * Enqueue a password reset email job (convenience method)
     */
    public async enqueuePasswordResetEmail(userId: string, traceContext?: TraceContext): Promise<ObanJob> {
        return this.enqueueEmailJob({
            env: (process.env.APP_ENV as ObanEnv) || "staging",
            email_type: "reset_password",
            data: userId,
            trace_context: traceContext,
        });
    }

    /**
     * Enqueue a registration email job (convenience method)
     */
    public async enqueueRegistrationEmail(userId: string, traceContext?: TraceContext): Promise<ObanJob> {
        return this.enqueueEmailJob({
            env: (process.env.APP_ENV as ObanEnv) || "staging",
            email_type: "registration_email",
            data: userId,
            trace_context: traceContext,
        });
    }

    /**
     * Enqueue a trade request email for Elixir to process.
     * TypeScript pre-computes accept_url and decline_url (V3 magic-link or V2 plain)
     * so Elixir can remain feature-flag agnostic.
     */
    public async enqueueTradeRequestEmail(
        tradeId: string,
        recipientUserId: string,
        acceptUrl: string,
        declineUrl: string,
        traceContext?: TraceContext
    ): Promise<ObanJob> {
        return this.enqueueEmailJob({
            env: (process.env.APP_ENV as ObanEnv) || "staging",
            email_type: "trade_request",
            trade_id: tradeId,
            recipient_user_id: recipientUserId,
            accept_url: acceptUrl,
            decline_url: declineUrl,
            trace_context: traceContext,
        });
    }

    /**
     * Enqueue a trade declined email for Elixir to process.
     * TypeScript pre-computes decline_url (V3 summary page) so Elixir stays feature-flag agnostic.
     * decline_url is omitted for V2 environments where no link is shown in the email.
     */
    public async enqueueTradeDeclinedEmail(
        tradeId: string,
        recipientUserId: string,
        isCreator: boolean,
        declineUrl: string | undefined,
        traceContext?: TraceContext
    ): Promise<ObanJob> {
        return this.enqueueEmailJob({
            env: (process.env.APP_ENV as ObanEnv) || "staging",
            email_type: "trade_declined",
            trade_id: tradeId,
            recipient_user_id: recipientUserId,
            is_creator: isCreator,
            decline_url: declineUrl,
            trace_context: traceContext,
        });
    }

    /**
     * Enqueue a trade submit email for Elixir to process.
     * TypeScript pre-computes submit_url (V3 magic-link or V2 plain) so Elixir stays feature-flag agnostic.
     */
    public async enqueueTradeSubmitEmail(
        tradeId: string,
        recipientUserId: string,
        submitUrl: string,
        traceContext?: TraceContext
    ): Promise<ObanJob> {
        return this.enqueueEmailJob({
            env: (process.env.APP_ENV as ObanEnv) || "staging",
            email_type: "trade_submit",
            trade_id: tradeId,
            recipient_user_id: recipientUserId,
            submit_url: submitUrl,
            trace_context: traceContext,
        });
    }

    /**
     * Enqueue a Discord job (convenience method)
     */
    public async enqueueDiscordJob(discordJobData: DiscordJobData): Promise<ObanJob> {
        return this.enqueueJob({
            queue: "discord",
            worker: "TradeMachine.Jobs.DiscordWorker",
            args: discordJobData,
            max_attempts: 3,
        });
    }

    /**
     * Enqueue a webhook status update job (convenience method)
     */
    public async enqueueEmailWebhookJob(webhookJobData: WebhookStatusJobData): Promise<ObanJob> {
        return this.enqueueJob({
            queue: "emails",
            worker: "TradeMachine.Jobs.EmailWebhookWorker",
            args: webhookJobData,
            max_attempts: 3,
        });
    }

    /**
     * Enqueue a trade announcement for the Discord channel
     */
    public async enqueueTradeAnnouncement(
        tradeId: string,
        traceContext?: { traceparent: string; tracestate?: string }
    ): Promise<ObanJob> {
        return this.enqueueDiscordJob({
            env: (process.env.APP_ENV as ObanEnv) || "staging",
            job_type: "trade_announcement",
            data: tradeId,
            trace_context: traceContext,
        });
    }

    /**
     * Get job by ID (for debugging/monitoring)
     */
    public async getJobById(id: bigint): Promise<ObanJob | null> {
        return this.obanJobsDb.findUnique({
            where: { id },
        });
    }

    /**
     * Get jobs by queue and state (for debugging/monitoring)
     */
    public async getJobsByQueueAndState(queue: string, state: oban_job_state, limit = 50): Promise<ObanJob[]> {
        return this.obanJobsDb.findMany({
            where: {
                queue,
                state,
            },
            orderBy: {
                scheduled_at: "asc",
            },
            take: limit,
        });
    }
}
/* eslint-enable @typescript-eslint/naming-convention */
