/* eslint-disable @typescript-eslint/naming-convention */

import { Prisma, oban_job_state } from "@prisma/client";
import { ExtendedPrismaClient } from "../../bootstrap/prisma-db";

// Job type interfaces
export interface EmailJobData {
    email_type: "reset_password";
    data: string; // user ID for reset_password
    trace_context?: {
        traceparent: string;
        tracestate?: string;
    };
}

export interface CreateObanJobInput {
    queue: string;
    worker: string;
    args: EmailJobData;
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
        const job = await this.obanJobsDb.create({
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
        return job;
    }

    /**
     * Enqueue an email job (convenience method)
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
    public async enqueuePasswordResetEmail(
        userId: string,
        traceContext?: { traceparent: string; tracestate?: string }
    ): Promise<ObanJob> {
        return this.enqueueEmailJob({
            email_type: "reset_password",
            data: userId,
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
