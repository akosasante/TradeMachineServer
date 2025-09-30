import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { context } from "@opentelemetry/api";
import { publicProcedure, router } from "../trpc";
import {
    addSpanAttributes,
    addSpanEvent,
    createSpanFromRequest,
    extractTraceContext,
    finishSpanWithStatusCode
} from "../../../../utils/tracing";
import logger from "../../../../bootstrap/logger";
import ObanDAO from "../../../../DAO/v2/ObanDAO";
import {
    deserializeUser,
    generateHashedPassword,
    passwordResetDateIsValid,
    serializeUser,
    signInAuthentication,
    signUpAuthentication
} from "../../../../authentication/auth";
import { activeUserMetric } from "../../../../bootstrap/metrics";
import { PublicUser } from "../../../../DAO/v2/UserDAO";

// Input validation schemas
const emailSchema = z.object({
    email: z.string().email("Please provide a valid email address"),
});

const loginSchema = z.object({
    email: z.string().email("Please provide a valid email address"),
    password: z.string().min(1, "Password is required"),
});

const resetPasswordSchema = z.object({
    id: z.string().min(1, "User ID is required").uuid("User ID must be a valid UUID"),
    password: z.string().min(1, "New password is required"),
    token: z.string().min(1, "Password reset token is required"),
});

export const authRouter = router({
    login: router({
        authenticate: publicProcedure.input(loginSchema).mutation(async ({ input, ctx }) => {
            const { span, context: traceContext } = createSpanFromRequest("trpc.auth.login", ctx.req);

            return await context.with(traceContext, async () => {
                logger.debug(`Attempting to authenticate user: ${input.email}`);

                addSpanAttributes({
                    "auth.action": "login",
                    "auth.method": "trpc",
                    "email.provided": !!input.email,
                    "email.domain": input.email ? input.email.split("@")[1] : "unknown",
                });

                addSpanEvent("login.start", { emailProvided: !!input.email });

                try {
                    // Use v2 DAO for consistency with other tRPC endpoints
                    const authenticatedUser = await new Promise<PublicUser>((resolve, reject) => {
                        void signInAuthentication(input.email, input.password, ctx.userDao, (err, authUser) => {
                            if (err || !authUser) {
                                reject(err || new Error("Authentication failed"));
                            } else {
                                resolve(authUser as PublicUser);
                            }
                        });
                    });

                    addSpanAttributes({
                        "user.id": authenticatedUser.id?.toString() || "unknown",
                        "user.authenticated": true,
                    });

                    addSpanEvent("login.authentication_success", {
                        userId: authenticatedUser.id?.toString() || "unknown",
                    });

                    // Ensure session exists before setting user
                    if (!ctx.session) {
                        throw new Error("Session not available");
                    }

                    // Set session like the original LoginHandler does
                    ctx.session.user = serializeUser(authenticatedUser);

                    // Save session and increment metrics
                    await new Promise<void>((resolve, reject) => {
                        ctx.session!.save((sessionErr: Error | null) => {
                            if (sessionErr) {
                                logger.error("Could not save session:", sessionErr);
                                reject(new Error("Could not save session"));
                            } else {
                                resolve();
                            }
                        });
                    });

                    activeUserMetric.inc();

                    // Return the deserialized user like the original endpoint
                    const deserializedUser = await deserializeUser(ctx.session!.user!, ctx.userDao);

                    addSpanEvent("login.success", {
                        userId: deserializedUser.id?.toString() || "unknown",
                        userType:
                            "isAdmin" in deserializedUser ? (deserializedUser.isAdmin() ? "admin" : "user") : "unknown",
                    });

                    addSpanAttributes({
                        "user.is_admin": "isAdmin" in deserializedUser ? deserializedUser.isAdmin() : false,
                    });

                    finishSpanWithStatusCode(span, 200);

                    logger.info("User successfully authenticated via tRPC", {
                        userId: deserializedUser.id,
                        email: input.email,
                    });

                    return deserializedUser;
                } catch (error) {
                    addSpanEvent("login.error", {
                        error: error instanceof Error ? error.message : "Unknown error",
                    });

                    // Destroy session on failed authentication like LoginHandler does
                    if (ctx.session) {
                        ctx.session.destroy((destroyErr: Error | null) => {
                            logger.debug(`Destroying failed auth session: ${destroyErr}`);
                        });
                    }

                    if (error instanceof Error) {
                        finishSpanWithStatusCode(span, 401);
                        throw new TRPCError({
                            code: "UNAUTHORIZED",
                            message: error.message,
                        });
                    }

                    finishSpanWithStatusCode(span, 500);
                    throw new TRPCError({
                        code: "INTERNAL_SERVER_ERROR",
                        message: "An unexpected error occurred during authentication",
                    });
                }
            });
        }),
        sendResetEmail: publicProcedure.input(emailSchema).mutation(async ({ input, ctx }) => {
            const { span, context: traceContext } = createSpanFromRequest("trpc.auth.sendResetEmail", ctx.req);

            return await context.with(traceContext, async () => {
                logger.debug(`Preparing to send reset password email via Oban to...: ${input.email}`);

                addSpanAttributes({
                    "auth.action": "sendResetEmail",
                    "auth.method": "trpc",
                    "email.requested": !!input.email,
                    "email.domain": input.email ? input.email.split("@")[1] : "unknown",
                });

                addSpanEvent("reset_email.start", { emailProvided: !!input.email });

                try {
                    const user = await ctx.userDao.findUserWithPasswordByEmail(input.email);

                    if (!user) {
                        addSpanEvent("reset_email.user_not_found", { email: input.email });
                        finishSpanWithStatusCode(span, 404);
                        throw new TRPCError({
                            code: "NOT_FOUND",
                            message: "No user found with the given email.",
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
                            code: "INTERNAL_SERVER_ERROR",
                            message: "obanJob not available in Prisma client",
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
                    const job = await obanDao.enqueuePasswordResetEmail(
                        updatedUser.id!,
                        currentTraceContext || undefined
                    );

                    addSpanAttributes({
                        "oban.job_id": job.id.toString(),
                        "oban.queue_success": true,
                        "oban.trace_context_included": !!currentTraceContext,
                    });

                    addSpanEvent("oban.job_queued", {
                        jobId: job.id.toString(),
                        userId: updatedUser.id?.toString() || "unknown",
                    });

                    logger.info("Oban job queued for password reset", {
                        jobId: job.id.toString(),
                        userId: updatedUser.id,
                    });

                    finishSpanWithStatusCode(span, 202);

                    return {
                        status: "oban job queued",
                        jobId: job.id.toString(),
                        userId: updatedUser.id,
                    };
                } catch (error) {
                    addSpanEvent("reset_email.error", {
                        error: error instanceof Error ? error.message : "Unknown error",
                    });

                    if (error instanceof TRPCError) {
                        finishSpanWithStatusCode(span, error.code === "NOT_FOUND" ? 404 : 500);
                        throw error;
                    }

                    finishSpanWithStatusCode(span, 500);
                    throw new TRPCError({
                        code: "INTERNAL_SERVER_ERROR",
                        message: "An unexpected error occurred",
                    });
                }
            });
        }),
    }),
    sessionCheck: publicProcedure.query(async ({ ctx }) => {
        const { span, context: traceContext } = createSpanFromRequest("trpc.auth.sessionCheck", ctx.req);

        return await context.with(traceContext, async () => {
            logger.debug("tRPC session check");

            addSpanAttributes({
                "auth.action": "sessionCheck",
                "auth.method": "trpc",
                "session.exists": !!ctx.session?.user,
            });

            addSpanEvent("session_check.start", { hasSession: !!ctx.session?.user });

            try {
                if (!ctx.session?.user) {
                    addSpanEvent("session_check.no_user");
                    finishSpanWithStatusCode(span, 401);
                    throw new TRPCError({
                        code: "UNAUTHORIZED",
                        message: "User not authenticated",
                    });
                }

                addSpanEvent("session_check.deserializing_user", { userId: ctx.session.user });

                // Deserialize user from session like the original endpoint does
                const user = await deserializeUser(ctx.session.user, ctx.userDao);

                addSpanAttributes({
                    "user.id": user.id?.toString() || "unknown",
                    "user.authenticated": true,
                    "user.is_admin": "isAdmin" in user ? user.isAdmin() : false,
                });

                addSpanEvent("session_check.success", {
                    userId: user.id?.toString() || "unknown",
                    userType: "isAdmin" in user ? (user.isAdmin() ? "admin" : "user") : "unknown",
                });

                finishSpanWithStatusCode(span, 200);

                logger.debug(`tRPC session check worked for user ${user.id}`);

                return user;
            } catch (error) {
                addSpanEvent("session_check.error", {
                    error: error instanceof Error ? error.message : "Unknown error",
                });

                if (error instanceof TRPCError) {
                    finishSpanWithStatusCode(span, error.code === "UNAUTHORIZED" ? 401 : 500);
                    throw error;
                }

                finishSpanWithStatusCode(span, 500);
                throw new TRPCError({
                    code: "INTERNAL_SERVER_ERROR",
                    message: "An unexpected error occurred during session check",
                });
            }
        });
    }),
    logout: publicProcedure.mutation(async ({ ctx }) => {
        const { span, context: traceContext } = createSpanFromRequest("trpc.auth.logout", ctx.req);

        return await context.with(traceContext, async () => {
            logger.debug("tRPC logout");

            addSpanAttributes({
                "auth.action": "logout",
                "auth.method": "trpc",
                "session.exists": !!ctx.session?.user,
            });

            addSpanEvent("logout.start", { hasSession: !!ctx.session?.user });

            try {
                return await new Promise<boolean>((resolve, reject) => {
                    if (ctx.session && ctx.session.user) {
                        addSpanEvent("logout.destroying_session", { userId: ctx.session.user });

                        ctx.session.destroy((err: Error | null) => {
                            if (err) {
                                logger.error("Error destroying session in tRPC logout");

                                addSpanEvent("logout.error", {
                                    error: err.message,
                                });

                                finishSpanWithStatusCode(span, 500);
                                reject(
                                    new TRPCError({
                                        code: "INTERNAL_SERVER_ERROR",
                                        message: "Error destroying session",
                                    })
                                );
                            } else {
                                const userId = ctx.session?.user;
                                logger.debug(`Destroying user session for userId#${userId}`);

                                // Clear the user from session (already destroyed but for consistency)
                                if (ctx.session?.user) {
                                    delete ctx.session.user;
                                }

                                activeUserMetric.dec();

                                addSpanEvent("logout.success", { userId: userId || "unknown" });
                                addSpanAttributes({
                                    "user.id": userId || "unknown",
                                    "logout.successful": true,
                                });

                                finishSpanWithStatusCode(span, 200);
                                resolve(true);
                            }
                        });
                    } else {
                        // No session to log out of, return success
                        logger.debug("Resolving empty session logout via tRPC");

                        addSpanEvent("logout.no_session");
                        addSpanAttributes({
                            "logout.successful": true,
                            "logout.had_session": false,
                        });

                        finishSpanWithStatusCode(span, 200);
                        resolve(true);
                    }
                });
            } catch (error) {
                addSpanEvent("logout.unexpected_error", {
                    error: error instanceof Error ? error.message : "Unknown error",
                });

                if (error instanceof TRPCError) {
                    finishSpanWithStatusCode(span, 500);
                    throw error;
                }

                finishSpanWithStatusCode(span, 500);
                throw new TRPCError({
                    code: "INTERNAL_SERVER_ERROR",
                    message: "An unexpected error occurred during logout",
                });
            }
        });
    }),
    resetPassword: publicProcedure.input(resetPasswordSchema).mutation(async ({ input, ctx }) => {
        const { span, context: traceContext } = createSpanFromRequest("trpc.auth.resetPassword", ctx.req);

        return await context.with(traceContext, async () => {
            logger.debug("tRPC reset password");

            addSpanAttributes({
                "auth.action": "resetPassword",
                "auth.method": "trpc",
                "user.id": input.id,
                "password.provided": !!input.password,
                "token.provided": !!input.token,
            });

            addSpanEvent("reset_password.start", { userId: input.id });

            try {
                // Use v2 DAO for consistency with other tRPC endpoints
                const existingUser = await ctx.userDao.getUserById(input.id);

                if (
                    !existingUser ||
                    !existingUser.passwordResetToken ||
                    existingUser.passwordResetToken !== input.token
                ) {
                    addSpanEvent("reset_password.user_not_found_or_token_mismatch", {
                        userId: input.id,
                        userExists: !!existingUser,
                        hasResetToken: !!existingUser?.passwordResetToken,
                    });

                    finishSpanWithStatusCode(span, 404);
                    throw new TRPCError({
                        code: "NOT_FOUND",
                        message: "user does not exist",
                    });
                }

                addSpanEvent("reset_password.user_found", { userId: input.id });

                if (!passwordResetDateIsValid(existingUser.passwordResetExpiresOn || undefined)) {
                    addSpanEvent("reset_password.token_expired", {
                        userId: input.id,
                        expiresOn: existingUser.passwordResetExpiresOn?.toISOString() || "unknown",
                    });

                    finishSpanWithStatusCode(span, 403);
                    throw new TRPCError({
                        code: "FORBIDDEN",
                        message: "expired",
                    });
                }

                addSpanEvent("reset_password.token_valid", { userId: input.id });

                logger.debug("valid reset password request via tRPC");

                // Generate hashed password
                const hashedPassword = await generateHashedPassword(input.password);

                addSpanEvent("reset_password.password_hashed", { userId: input.id });

                // Update user with new password and clear reset fields
                await ctx.userDao.updateUser(input.id, {
                    password: hashedPassword,
                    passwordResetExpiresOn: undefined,
                    passwordResetToken: undefined,
                });

                addSpanAttributes({
                    "password.reset_successful": true,
                    "reset_token.cleared": true,
                });

                addSpanEvent("reset_password.success", { userId: input.id });

                finishSpanWithStatusCode(span, 200);

                logger.info("Password successfully reset via tRPC", { userId: input.id });

                return {
                    status: "success",
                    message: "Password reset successfully",
                };
            } catch (error) {
                addSpanEvent("reset_password.error", {
                    error: error instanceof Error ? error.message : "Unknown error",
                });

                if (error instanceof TRPCError) {
                    const statusCode = error.code === "NOT_FOUND" ? 404 : error.code === "FORBIDDEN" ? 403 : 500;
                    finishSpanWithStatusCode(span, statusCode);
                    throw error;
                }

                finishSpanWithStatusCode(span, 500);
                throw new TRPCError({
                    code: "INTERNAL_SERVER_ERROR",
                    message: "An unexpected error occurred during password reset",
                });
            }
        });
    }),
    signup: router({
        register: publicProcedure
            .input(loginSchema) // Reuse loginSchema since it has email and password validation
            .mutation(async ({ input, ctx }) => {
                const { span, context: traceContext } = createSpanFromRequest("trpc.auth.signup.register", ctx.req);

                return await context.with(traceContext, async () => {
                    logger.debug("IN tRPC SIGNUP");

                    addSpanAttributes({
                        "auth.action": "signup.register",
                        "auth.method": "trpc",
                        "email.provided": !!input.email,
                        "email.domain": input.email ? input.email.split("@")[1] : "unknown",
                        "password.provided": !!input.password,
                    });

                    addSpanEvent("signup.start", { emailProvided: !!input.email });

                    try {
                        // Validate that both email and password are provided (should be handled by Zod but double-check)
                        if (!input.email || !input.password) {
                            addSpanEvent("signup.missing_details");
                            finishSpanWithStatusCode(span, 400);
                            throw new TRPCError({
                                code: "BAD_REQUEST",
                                message: "Some details are missing. Cannot register user.",
                            });
                        }

                        // Use signUpAuthentication like RegisterHandler does
                        const registeredUser = await new Promise<PublicUser>((resolve, reject) => {
                            void signUpAuthentication(
                                input.email,
                                input.password,
                                ctx.userDao,
                                (err, user) => {
                                    if (err) {
                                        reject(err);
                                    } else if (!user) {
                                        reject(new Error("For some reason could not register user"));
                                    } else {
                                        resolve(user as PublicUser);
                                    }
                                }
                            );
                        });

                        addSpanAttributes({
                            "user.id": registeredUser.id?.toString() || "unknown",
                            "user.registered": true,
                        });

                        addSpanEvent("signup.registration_success", {
                            userId: registeredUser.id?.toString() || "unknown",
                        });

                        logger.debug(`registered user via tRPC: ${registeredUser.id}`);

                        // Ensure session exists before setting user
                        if (!ctx.session) {
                            throw new Error("Session not available");
                        }

                        // Set session like RegisterHandler does
                        ctx.session.user = serializeUser(registeredUser);

                        // Increment metrics like the original signup endpoint
                        activeUserMetric.inc();

                        // Return the deserialized user like the original endpoint
                        const deserializedUser = await deserializeUser(ctx.session.user!, ctx.userDao);

                        addSpanEvent("signup.success", {
                            userId: deserializedUser.id?.toString() || "unknown",
                            userType:
                                "isAdmin" in deserializedUser
                                    ? deserializedUser.isAdmin()
                                        ? "admin"
                                        : "user"
                                    : "unknown",
                        });

                        addSpanAttributes({
                            "user.is_admin": "isAdmin" in deserializedUser ? deserializedUser.isAdmin() : false,
                        });

                        finishSpanWithStatusCode(span, 200);

                        logger.info("User successfully registered via tRPC", {
                            userId: deserializedUser.id,
                            email: input.email,
                        });

                        return deserializedUser;
                    } catch (error) {
                        addSpanEvent("signup.error", {
                            error: error instanceof Error ? error.message : "Unknown error",
                        });

                        if (error instanceof TRPCError) {
                            finishSpanWithStatusCode(span, error.code === "BAD_REQUEST" ? 400 : 500);
                            throw error;
                        }

                        finishSpanWithStatusCode(span, 500);
                        throw new TRPCError({
                            code: "INTERNAL_SERVER_ERROR",
                            message:
                                error instanceof Error ? error.message : "An unexpected error occurred during signup",
                        });
                    }
                });
            }),
        sendEmail: publicProcedure.input(emailSchema).mutation(async ({ input, ctx }) => {
            const { span, context: traceContext } = createSpanFromRequest("trpc.auth.signup.sendEmail", ctx.req);

            return await context.with(traceContext, async () => {
                logger.debug(`Preparing to send registration email to: ${input.email}`);

                addSpanAttributes({
                    "auth.action": "signup.sendEmail",
                    "auth.method": "trpc",
                    "email.requested": !!input.email,
                    "email.domain": input.email ? input.email.split("@")[1] : "unknown",
                });

                addSpanEvent("registration_email.start", { emailProvided: !!input.email });

                try {
                    // Use v2 Prisma DAO to find user
                    const user = await ctx.userDao.findUserWithPasswordByEmail(input.email);

                    if (!user) {
                        addSpanEvent("registration_email.user_not_found", { email: input.email });
                        finishSpanWithStatusCode(span, 404);
                        throw new TRPCError({
                            code: "NOT_FOUND",
                            message: "No user found with the given email.",
                        });
                    }

                    addSpanAttributes({
                        "user.id": user.id?.toString() || "unknown",
                        "user.found": true,
                    });

                    addSpanEvent("user.found", { userId: user.id?.toString() || "unknown" });

                    // Check if obanJob is available
                    if (!ctx.prisma.obanJob) {
                        logger.error("obanJob model not available in Prisma client");
                        addSpanEvent("oban.error", { reason: "obanJob not available in Prisma client" });
                        finishSpanWithStatusCode(span, 500);
                        throw new TRPCError({
                            code: "INTERNAL_SERVER_ERROR",
                            message: "obanJob not available in Prisma client",
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
                    const job = await obanDao.enqueueRegistrationEmail(user.id!, currentTraceContext || undefined);

                    addSpanAttributes({
                        "oban.job_id": job.id.toString(),
                        "oban.queue_success": true,
                        "oban.trace_context_included": !!currentTraceContext,
                    });

                    addSpanEvent("oban.job_queued", {
                        jobId: job.id.toString(),
                        userId: user.id?.toString() || "unknown",
                    });

                    logger.info("Oban job queued for registration email", {
                        jobId: job.id.toString(),
                        userId: user.id,
                    });

                    finishSpanWithStatusCode(span, 202);

                    return {
                        status: "oban job queued",
                        jobId: job.id.toString(),
                        userId: user.id,
                    };
                } catch (error) {
                    addSpanEvent("registration_email.error", {
                        error: error instanceof Error ? error.message : "Unknown error",
                    });

                    if (error instanceof TRPCError) {
                        finishSpanWithStatusCode(span, error.code === "NOT_FOUND" ? 404 : 500);
                        throw error;
                    }

                    finishSpanWithStatusCode(span, 500);
                    throw new TRPCError({
                        code: "INTERNAL_SERVER_ERROR",
                        message: "An unexpected error occurred",
                    });
                }
            });
        }),
    }),
});
