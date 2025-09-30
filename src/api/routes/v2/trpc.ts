import { initTRPC, TRPCError } from "@trpc/server";
import { Request, Response } from "express";
import { context } from "@opentelemetry/api";
import { ExtendedPrismaClient } from "../../../bootstrap/prisma-db";
import Users from "../../../DAO/v2/UserDAO";
import { createSpanFromRequest, finishSpanWithStatusCode, addSpanAttributes, addSpanEvent } from "../../../utils/tracing";

// Define the context type that will be available in all procedures
export interface Context {
    req: Request;
    res: Response;
    session?: {
        user?: string;
    };
    prisma: ExtendedPrismaClient;
    userDao: Users;
}

// Create the tRPC instance
const t = initTRPC.context<Context>().create();

// Export reusable pieces
export const router = t.router;
export const createCallerFactory = t.createCallerFactory;
export const publicProcedure = t.procedure;

// Create a protected procedure that requires authentication
export const protectedProcedure = publicProcedure.use(async ({ ctx, next }) => {
    const { span, context: traceContext } = createSpanFromRequest("trpc.auth_check", ctx.req);

    return await context.with(traceContext, async () => {
        if (!ctx.session?.user) {
            addSpanEvent("auth.failed", { reason: "No session user" });
            finishSpanWithStatusCode(span, 401);
            throw new TRPCError({ code: "UNAUTHORIZED", message: "Authentication required" });
        }

        addSpanAttributes({
            "user.session_id": ctx.session.user,
            "auth.method": "session",
        });

        try {
            // Use v2 Prisma DAO only - getUserById returns PublicUser (without password)
            const user = await ctx.userDao.getUserById(ctx.session.user);

            if (!user) {
                addSpanEvent("auth.user_not_found", { sessionUserId: ctx.session.user });
                finishSpanWithStatusCode(span, 401);
                throw new TRPCError({ code: "UNAUTHORIZED", message: "User not found" });
            }

            addSpanAttributes({
                "user.id": user.id?.toString() || "unknown",
                "user.is_admin": user.isAdmin(),
            });

            addSpanEvent("auth.success", {
                userId: user.id?.toString() || "unknown",
                userType: user.isAdmin() ? "admin" : "user",
            });

            finishSpanWithStatusCode(span, 200);

            return next({
                ctx: {
                    ...ctx,
                    user ,
                },
            });
        } catch (error) {
            addSpanEvent("auth.error", { error: error instanceof Error ? error.message : "Unknown error" });
            finishSpanWithStatusCode(span, 401);
            throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid session" });
        }
    });
});
