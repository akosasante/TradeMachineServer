"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.protectedProcedure = exports.publicProcedure = exports.router = void 0;
const server_1 = require("@trpc/server");
const api_1 = require("@opentelemetry/api");
const tracing_1 = require("../utils/tracing");
// Create the tRPC instance
const t = server_1.initTRPC.context().create();
// Export reusable pieces
exports.router = t.router;
exports.publicProcedure = t.procedure;
// Create a protected procedure that requires authentication
exports.protectedProcedure = exports.publicProcedure.use(async ({ ctx, next }) => {
    const { span, context: traceContext } = (0, tracing_1.createSpanFromRequest)("trpc.auth_check", ctx.req);
    return await api_1.context.with(traceContext, async () => {
        if (!ctx.session?.user) {
            (0, tracing_1.addSpanEvent)("auth.failed", { reason: "No session user" });
            (0, tracing_1.finishSpanWithStatusCode)(span, 401);
            throw new server_1.TRPCError({ code: "UNAUTHORIZED", message: "Authentication required" });
        }
        (0, tracing_1.addSpanAttributes)({
            "user.session_id": ctx.session.user,
            "auth.method": "session",
        });
        try {
            // Use v2 Prisma DAO only - getUserById returns PublicUser (without password)
            const user = await ctx.userDao.getUserById(ctx.session.user);
            if (!user) {
                (0, tracing_1.addSpanEvent)("auth.user_not_found", { sessionUserId: ctx.session.user });
                (0, tracing_1.finishSpanWithStatusCode)(span, 401);
                throw new server_1.TRPCError({ code: "UNAUTHORIZED", message: "User not found" });
            }
            (0, tracing_1.addSpanAttributes)({
                "user.id": user.id?.toString() || "unknown",
                "user.is_admin": user.isAdmin(),
            });
            (0, tracing_1.addSpanEvent)("auth.success", {
                userId: user.id?.toString() || "unknown",
                userType: user.isAdmin() ? "admin" : "user",
            });
            (0, tracing_1.finishSpanWithStatusCode)(span, 200);
            return next({
                ctx: {
                    ...ctx,
                    user,
                },
            });
        }
        catch (error) {
            (0, tracing_1.addSpanEvent)("auth.error", { error: error instanceof Error ? error.message : "Unknown error" });
            (0, tracing_1.finishSpanWithStatusCode)(span, 401);
            throw new server_1.TRPCError({ code: "UNAUTHORIZED", message: "Invalid session" });
        }
    });
});
//# sourceMappingURL=trpc.js.map