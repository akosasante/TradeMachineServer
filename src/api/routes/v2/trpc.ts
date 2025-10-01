import { initTRPC, TRPCError } from "@trpc/server";
import { Request, Response } from "express";
import { Session } from "express-session";
import { context, Span } from "@opentelemetry/api";
import { ExtendedPrismaClient } from "../../../bootstrap/prisma-db";
import Users from "../../../DAO/v2/UserDAO";
import {
    createSpanFromRequest,
    finishSpanWithStatusCode,
    addSpanAttributes,
    addSpanEvent,
} from "../../../utils/tracing";

// Define the context type that will be available in all procedures
export interface Context {
    req: Request;
    res: Response;
    session?: Session & {
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
                    user,
                },
            });
        } catch (error) {
            addSpanEvent("auth.error", { error: error instanceof Error ? error.message : "Unknown error" });
            finishSpanWithStatusCode(span, 401);
            throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid session" });
        }
    });
});

/**
 * Utility function to map TRPCError codes to HTTP status codes
 */
const getTRPCErrorStatusCode = (error: TRPCError): number => {
    switch (error.code) {
        case "BAD_REQUEST":
            return 400;
        case "UNAUTHORIZED":
            return 401;
        case "FORBIDDEN":
            return 403;
        case "NOT_FOUND":
            return 404;
        case "METHOD_NOT_SUPPORTED":
            return 405;
        case "TIMEOUT":
            return 408;
        case "CONFLICT":
            return 409;
        case "PRECONDITION_FAILED":
            return 412;
        case "PAYLOAD_TOO_LARGE":
            return 413;
        case "UNPROCESSABLE_CONTENT":
            return 422;
        case "TOO_MANY_REQUESTS":
            return 429;
        case "CLIENT_CLOSED_REQUEST":
            return 499;
        case "INTERNAL_SERVER_ERROR":
        default:
            return 500;
    }
};

/**
 * Higher-order function that wraps tRPC procedure handlers with distributed tracing.
 * Automatically handles span creation, context management, and error handling.
 *
 * @param operationName - The name of the operation for tracing (e.g., "trpc.auth.login")
 * @param handler - The actual procedure handler function
 * @returns A wrapped handler function with tracing
 */
export const withTracing = <TInput, TOutput>(
    operationName: string,
    handler: (
        input: TInput,
        ctx: Context,
        span: Span,
        traceContext: any
    ) => Promise<TOutput>
) => {
    return async ({ input, ctx }: { input: TInput; ctx: Context }): Promise<TOutput> => {
        const { span, context: traceContext } = createSpanFromRequest(operationName, ctx.req);

        return await context.with(traceContext, async () => {
            try {
                const result = await handler(input, ctx, span, traceContext);
                finishSpanWithStatusCode(span, 200);
                return result;
            } catch (error) {
                const operationShortName = operationName.split('.').pop() || 'operation';

                addSpanEvent(`${operationShortName}.error`, {
                    error: error instanceof Error ? error.message : "Unknown error",
                });

                if (error instanceof TRPCError) {
                    const statusCode = getTRPCErrorStatusCode(error);
                    finishSpanWithStatusCode(span, statusCode);
                    throw error;
                }

                finishSpanWithStatusCode(span, 500);
                throw new TRPCError({
                    code: "INTERNAL_SERVER_ERROR",
                    message: error instanceof Error ? error.message : "An unexpected error occurred",
                });
            }
        });
    };
};
