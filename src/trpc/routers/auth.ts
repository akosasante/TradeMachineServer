import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { context } from '@opentelemetry/api';
import { router, publicProcedure } from '../trpc';
import {
    createSpanFromRequest,
    finishSpanWithStatusCode,
    addSpanAttributes,
    addSpanEvent,
    extractTraceContext
} from '../../utils/tracing';
import logger from '../../bootstrap/logger';
import { rollbar } from '../../bootstrap/rollbar';
import ObanDAO from '../../DAO/v2/ObanDAO';

// Input validation schemas
const emailSchema = z.object({
    email: z.string().email('Please provide a valid email address')
});

export const authRouter = router({
    login: router({
        sendResetEmail: publicProcedure
            .input(emailSchema)
            .mutation(async ({ input, ctx }) => {
                const { span, context: traceContext } = createSpanFromRequest("trpc.auth.sendResetEmail", ctx.req);

                return await context.with(traceContext, async () => {
                    logger.debug(`Preparing to send reset password email via Oban to...: ${input.email}`);
                    rollbar.info("trpc sendResetEmail", { email: input.email }, ctx.req);

                    addSpanAttributes({
                        "auth.action": "sendResetEmail",
                        "auth.method": "trpc",
                        "email.requested": !!input.email,
                        "email.domain": input.email ? input.email.split("@")[1] : "unknown",
                    });

                    addSpanEvent("reset_email.start", { emailProvided: !!input.email });

                    try {
                        // Use v2 Prisma DAO to find user
                        const user = await ctx.userDao.findUserWithPasswordByEmail(input.email);

                        if (!user) {
                            addSpanEvent("reset_email.user_not_found", { email: input.email });
                            finishSpanWithStatusCode(span, 404);
                            throw new TRPCError({
                                code: 'NOT_FOUND',
                                message: 'No user found with the given email.'
                            });
                        }

                        addSpanAttributes({
                            "user.id": user.id?.toString() || "unknown",
                            "user.found": true,
                        });

                        addSpanEvent("user.found", { userId: user.id?.toString() || "unknown" });

                        // Update current user with reset request time
                        const updatedUser = await ctx.userDao.setPasswordExpires(user.id!);

                        addSpanEvent("user.password_expires_set", { userId: updatedUser.id?.toString() || "unknown" });

                        // Check if obanJob is available
                        if (!ctx.prisma.obanJob) {
                            logger.error("obanJob model not available in Prisma client");
                            addSpanEvent("oban.error", { reason: "obanJob not available in Prisma client" });
                            finishSpanWithStatusCode(span, 500);
                            throw new TRPCError({
                                code: 'INTERNAL_SERVER_ERROR',
                                message: 'obanJob not available in Prisma client'
                            });
                        }

                        // Extract current trace context for Elixir continuation
                        const currentTraceContext = extractTraceContext();

                        addSpanEvent("trace_context.extracted", {
                            hasTraceContext: !!currentTraceContext,
                            traceparentLength: currentTraceContext?.traceparent?.length || 0,
                        });

                        // Queue job in Oban for Elixir to process
                        const obanDao = new ObanDAO(ctx.prisma.obanJob);
                        const job = await obanDao.enqueuePasswordResetEmail(updatedUser.id!, currentTraceContext || undefined);

                        addSpanAttributes({
                            "oban.job_id": job.id.toString(),
                            "oban.queue_success": true,
                            "oban.trace_context_included": !!currentTraceContext,
                        });

                        addSpanEvent("oban.job_queued", {
                            jobId: job.id.toString(),
                            userId: updatedUser.id?.toString() || "unknown",
                        });

                        logger.info("Oban job queued for password reset", { jobId: job.id.toString(), userId: updatedUser.id });

                        finishSpanWithStatusCode(span, 202);

                        return {
                            status: "oban job queued",
                            jobId: job.id.toString(),
                            userId: updatedUser.id,
                        };
                    } catch (error) {
                        addSpanEvent("reset_email.error", {
                            error: error instanceof Error ? error.message : "Unknown error"
                        });

                        if (error instanceof TRPCError) {
                            finishSpanWithStatusCode(span, error.code === 'NOT_FOUND' ? 404 : 500);
                            throw error;
                        }

                        finishSpanWithStatusCode(span, 500);
                        throw new TRPCError({
                            code: 'INTERNAL_SERVER_ERROR',
                            message: 'An unexpected error occurred'
                        });
                    }
                });
            }),
    }),
});