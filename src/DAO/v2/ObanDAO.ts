/* eslint-disable @typescript-eslint/naming-convention */

import { Prisma, oban_job_state } from "@prisma/client";
import { ExtendedPrismaClient } from "../../bootstrap/prisma-db";
import { SpanKind, trace, context, propagation } from "@opentelemetry/api";

// Job type interfaces
export interface EmailJobData {
    env: "production" | "staging" | "development";
    email_type: "reset_password" | "registration_email";
    data: string; // user ID for reset_password and registration_email
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
        const tracer = trace.getTracer("trademachine-server");
        const obanTraceAttributes = {
            kind: SpanKind.PRODUCER,
            attributes: {
                "messaging.system": "oban",
                "messaging.destination": jobInput.queue,
                "messaging.destination_kind": "queue",
                "messaging.operation": "publish",
                "oban.worker": jobInput.worker,
                "oban.priority": jobInput.priority || 0,
                "oban.max_attempts": jobInput.max_attempts || 20,
            },
        };
        return await tracer.startActiveSpan(`oban.job.produce.${jobInput.queue}`, obanTraceAttributes, async span => {
            try {
                // If trace context was explicitly provided, use it; otherwise extract from active span
                let traceContext = jobInput.args.trace_context;

                if (!traceContext) {
                    // Extract trace context from the PRODUCER span so the CONSUMER
                    // becomes a child of the PRODUCER (not the PRODUCER's parent)
                    const carrier: Record<string, string> = {};
                    propagation.inject(context.active(), carrier);

                    traceContext = {
                        traceparent: carrier.traceparent,
                        tracestate: carrier.tracestate,
                    };
                }

                const jobArgsWithTrace = {
                    ...jobInput.args,
                    trace_context: traceContext,
                };

                const job = await this.obanJobsDb.create({
                    data: {
                        queue: jobInput.queue,
                        worker: jobInput.worker,
                        args: jobArgsWithTrace as unknown as Prisma.JsonObject,
                        scheduled_at: jobInput.scheduled_at || new Date(),
                        priority: jobInput.priority || 0,
                        max_attempts: jobInput.max_attempts || 20,
                        state: oban_job_state.available,
                    },
                });

                // Add job ID to span for correlation
                span.setAttributes({
                    "oban.job.id": job.id.toString(),
                    "messaging.message_id": job.id.toString(),
                    "trace_context.provided_by_caller": !!jobInput.args.trace_context,
                });
                span.setStatus({ code: 1 }); // OK
                return job;
            } catch (error) {
                span.recordException(error as Error);
                span.setStatus({ code: 2, message: (error as Error).message }); // ERROR
                throw error;
            } finally {
                span.end();
            }
        });
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
            env: (process.env.APP_ENV as EmailJobData["env"]) || "staging",
            email_type: "reset_password",
            data: userId,
            trace_context: traceContext,
        });
    }

    /**
     * Enqueue a registration email job (convenience method)
     */
    public async enqueueRegistrationEmail(
        userId: string,
        traceContext?: { traceparent: string; tracestate?: string }
    ): Promise<ObanJob> {
        return this.enqueueEmailJob({
            env: (process.env.APP_ENV as EmailJobData["env"]) || "staging",
            email_type: "registration_email",
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
