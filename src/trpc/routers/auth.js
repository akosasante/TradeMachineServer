"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRouter = void 0;
const zod_1 = require("zod");
const server_1 = require("@trpc/server");
const api_1 = require("@opentelemetry/api");
const trpc_1 = require("../trpc");
const tracing_1 = require("../../utils/tracing");
const logger_1 = __importDefault(require("../../bootstrap/logger"));
const rollbar_1 = require("../../bootstrap/rollbar");
const ObanDAO_1 = __importDefault(require("../../DAO/v2/ObanDAO"));
// Input validation schemas
const emailSchema = zod_1.z.object({
    email: zod_1.z.string().email('Please provide a valid email address')
});
exports.authRouter = (0, trpc_1.router)({
    login: (0, trpc_1.router)({
        sendResetEmail: trpc_1.publicProcedure
            .input(emailSchema)
            .mutation(async ({ input, ctx }) => {
            const { span, context: traceContext } = (0, tracing_1.createSpanFromRequest)("trpc.auth.sendResetEmail", ctx.req);
            return await api_1.context.with(traceContext, async () => {
                logger_1.default.debug(`Preparing to send reset password email via Oban to...: ${input.email}`);
                rollbar_1.rollbar.info("trpc sendResetEmail", { email: input.email }, ctx.req);
                (0, tracing_1.addSpanAttributes)({
                    "auth.action": "sendResetEmail",
                    "auth.method": "trpc",
                    "email.requested": !!input.email,
                    "email.domain": input.email ? input.email.split("@")[1] : "unknown",
                });
                (0, tracing_1.addSpanEvent)("reset_email.start", { emailProvided: !!input.email });
                try {
                    // Use v2 Prisma DAO to find user
                    const user = await ctx.userDao.findUserWithPasswordByEmail(input.email);
                    if (!user) {
                        (0, tracing_1.addSpanEvent)("reset_email.user_not_found", { email: input.email });
                        (0, tracing_1.finishSpanWithStatusCode)(span, 404);
                        throw new server_1.TRPCError({
                            code: 'NOT_FOUND',
                            message: 'No user found with the given email.'
                        });
                    }
                    (0, tracing_1.addSpanAttributes)({
                        "user.id": user.id?.toString() || "unknown",
                        "user.found": true,
                    });
                    (0, tracing_1.addSpanEvent)("user.found", { userId: user.id?.toString() || "unknown" });
                    // Update current user with reset request time
                    const updatedUser = await ctx.userDao.setPasswordExpires(user.id);
                    (0, tracing_1.addSpanEvent)("user.password_expires_set", { userId: updatedUser.id?.toString() || "unknown" });
                    // Check if obanJob is available
                    if (!ctx.prisma.obanJob) {
                        logger_1.default.error("obanJob model not available in Prisma client");
                        (0, tracing_1.addSpanEvent)("oban.error", { reason: "obanJob not available in Prisma client" });
                        (0, tracing_1.finishSpanWithStatusCode)(span, 500);
                        throw new server_1.TRPCError({
                            code: 'INTERNAL_SERVER_ERROR',
                            message: 'obanJob not available in Prisma client'
                        });
                    }
                    // Extract current trace context for Elixir continuation
                    const currentTraceContext = (0, tracing_1.extractTraceContext)();
                    (0, tracing_1.addSpanEvent)("trace_context.extracted", {
                        hasTraceContext: !!currentTraceContext,
                        traceparentLength: currentTraceContext?.traceparent?.length || 0,
                    });
                    // Queue job in Oban for Elixir to process
                    const obanDao = new ObanDAO_1.default(ctx.prisma.obanJob);
                    const job = await obanDao.enqueuePasswordResetEmail(updatedUser.id, currentTraceContext || undefined);
                    (0, tracing_1.addSpanAttributes)({
                        "oban.job_id": job.id.toString(),
                        "oban.queue_success": true,
                        "oban.trace_context_included": !!currentTraceContext,
                    });
                    (0, tracing_1.addSpanEvent)("oban.job_queued", {
                        jobId: job.id.toString(),
                        userId: updatedUser.id?.toString() || "unknown",
                    });
                    logger_1.default.info("Oban job queued for password reset", { jobId: job.id.toString(), userId: updatedUser.id });
                    (0, tracing_1.finishSpanWithStatusCode)(span, 202);
                    return {
                        status: "oban job queued",
                        jobId: job.id.toString(),
                        userId: updatedUser.id,
                    };
                }
                catch (error) {
                    (0, tracing_1.addSpanEvent)("reset_email.error", {
                        error: error instanceof Error ? error.message : "Unknown error"
                    });
                    if (error instanceof server_1.TRPCError) {
                        (0, tracing_1.finishSpanWithStatusCode)(span, error.code === 'NOT_FOUND' ? 404 : 500);
                        throw error;
                    }
                    (0, tracing_1.finishSpanWithStatusCode)(span, 500);
                    throw new server_1.TRPCError({
                        code: 'INTERNAL_SERVER_ERROR',
                        message: 'An unexpected error occurred'
                    });
                }
            });
        }),
    }),
});
//# sourceMappingURL=auth.js.map