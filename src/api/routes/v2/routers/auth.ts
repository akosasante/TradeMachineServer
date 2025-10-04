import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { publicProcedure, router, withTracing } from "../trpcHelpers";
import { addSpanAttributes, addSpanEvent, extractTraceContext } from "../../../../utils/tracing";
import logger from "../../../../bootstrap/logger";
import ObanDAO from "../../../../DAO/v2/ObanDAO";
import {
    deserializeUser,
    generateHashedPassword,
    passwordResetDateIsValid,
    serializeUser,
    signInAuthentication,
    signUpAuthentication,
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

const resetPasswordSchema = z
    .object({
        password: z.string().min(1, "New password is required"),
        confirmPassword: z.string().min(1, "Password confirmation is required"),
        token: z.string().min(1, "Password reset token is required"),
    })
    .refine(data => data.password === data.confirmPassword, {
        message: "Passwords do not match",
        path: ["confirmPassword"],
    });

const checkResetTokenSchema = z.object({
    token: z.string().min(1, "Password reset token is required"),
});

export const authRouter = router({
    login: router({
        authenticate: publicProcedure.input(loginSchema).mutation(
            withTracing("trpc.auth.login", async (input, ctx, _span) => {
                logger.debug(`Attempting to authenticate user: ${input.email}`);

                addSpanAttributes({
                    "auth.action": "login",
                    "auth.method": "trpc",
                    "email.provided": !!input.email,
                    "email.domain": input.email ? input.email.split("@")[1] : "unknown",
                });

                addSpanEvent("login.start", { emailProvided: !!input.email });

                // Use v2 DAO for consistency with other tRPC endpoints
                let authenticatedUser: PublicUser;
                try {
                    authenticatedUser = await new Promise<PublicUser>((resolve, reject) => {
                        void signInAuthentication(input.email, input.password, ctx.userDao, (err, authUser) => {
                            if (err || !authUser) {
                                reject(err || new Error("Authentication failed"));
                            } else {
                                resolve(authUser as PublicUser);
                            }
                        });
                    });
                } catch (error) {
                    // Destroy session on failed authentication like LoginHandler does
                    if (ctx.session) {
                        ctx.session.destroy((destroyErr: Error | null) => {
                            logger.debug(`Destroying failed auth session: ${destroyErr}`);
                        });
                    }

                    if (error instanceof Error) {
                        throw new TRPCError({
                            code: "UNAUTHORIZED",
                            message: error.message,
                        });
                    }

                    throw new TRPCError({
                        code: "INTERNAL_SERVER_ERROR",
                        message: "An unexpected error occurred during authentication",
                    });
                }

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
                const deserializedUser = await deserializeUser(ctx.session.user!, ctx.userDao);

                addSpanEvent("login.success", {
                    userId: deserializedUser.id?.toString() || "unknown",
                    userType:
                        "isAdmin" in deserializedUser ? (deserializedUser.isAdmin() ? "admin" : "user") : "unknown",
                });

                addSpanAttributes({
                    "user.is_admin": "isAdmin" in deserializedUser ? deserializedUser.isAdmin() : false,
                });

                logger.info("User successfully authenticated via tRPC", {
                    userId: deserializedUser.id,
                    email: input.email,
                });

                return deserializedUser;
            })
        ),
        sendResetEmail: publicProcedure.input(emailSchema).mutation(
            withTracing("trpc.auth.sendResetEmail", async (input, ctx, _span) => {
                logger.debug(`Preparing to send reset password email via Oban to...: ${input.email}`);

                addSpanAttributes({
                    "auth.action": "sendResetEmail",
                    "auth.method": "trpc",
                    "email.requested": !!input.email,
                    "email.domain": input.email ? input.email.split("@")[1] : "unknown",
                });

                addSpanEvent("reset_email.start", { emailProvided: !!input.email });

                const user = await ctx.userDao.findUserWithPasswordByEmail(input.email);

                if (!user) {
                    addSpanEvent("reset_email.user_not_found", { email: input.email });
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

                logger.info("Oban job queued for password reset", {
                    jobId: job.id.toString(),
                    userId: updatedUser.id,
                });

                return {
                    status: "oban job queued",
                    jobId: job.id.toString(),
                    userId: updatedUser.id,
                };
            })
        ),
    }),
    sessionCheck: publicProcedure.query(
        withTracing("trpc.auth.sessionCheck", async (input, ctx, _span) => {
            logger.info(`[SESSION] sessionCheck called - cookies: ${JSON.stringify(ctx.req.headers.cookie)}, sessionID: ${ctx.req.sessionID}, session user: ${ctx.session?.user}`);
            logger.debug("tRPC session check");

            addSpanAttributes({
                "auth.action": "sessionCheck",
                "auth.method": "trpc",
                "session.exists": !!ctx.session?.user,
            });

            addSpanEvent("session_check.start", { hasSession: !!ctx.session?.user });

            if (!ctx.session?.user) {
                logger.info(`[SESSION] sessionCheck failed - no user in session`);
                addSpanEvent("session_check.no_user");
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

            logger.debug(`tRPC session check worked for user ${user.id}`);

            return user;
        })
    ),
    logout: publicProcedure.mutation(
        withTracing("trpc.auth.logout", async (input, ctx, _span) => {
            logger.debug("tRPC logout");

            addSpanAttributes({
                "auth.action": "logout",
                "auth.method": "trpc",
                "session.exists": !!ctx.session?.user,
            });

            addSpanEvent("logout.start", { hasSession: !!ctx.session?.user });

            return await new Promise<boolean>((resolve, reject) => {
                if (ctx.session && ctx.session.user) {
                    addSpanEvent("logout.destroying_session", { userId: ctx.session.user });

                    ctx.session.destroy((err: Error | null) => {
                        if (err) {
                            logger.error("Error destroying session in tRPC logout");

                            addSpanEvent("logout.error", {
                                error: err.message,
                            });

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

                    resolve(true);
                }
            });
        })
    ),
    resetPassword: router({
        applyReset: publicProcedure.input(resetPasswordSchema).mutation(
            withTracing("trpc.auth.resetPassword", async (input, ctx, _span) => {
                logger.debug("tRPC reset password");

                addSpanAttributes({
                    "auth.action": "resetPassword",
                    "auth.method": "trpc",
                    "password.provided": !!input.password,
                    "confirmPassword.provided": !!input.confirmPassword,
                    "token.provided": !!input.token,
                });

                addSpanEvent("reset_password.start");

                // Use v2 DAO to find user by token
                const existingUser = await ctx.userDao.findUserByPasswordResetToken(input.token);

                if (!existingUser) {
                    addSpanEvent("reset_password.user_not_found_or_invalid_token");

                    throw new TRPCError({
                        code: "NOT_FOUND",
                        message: "Invalid or expired reset token",
                    });
                }

                addSpanAttributes({
                    "user.id": existingUser.id?.toString() || "unknown",
                });

                addSpanEvent("reset_password.user_found", { userId: existingUser.id?.toString() || "unknown" });

                if (!passwordResetDateIsValid(existingUser.passwordResetExpiresOn || undefined)) {
                    addSpanEvent("reset_password.token_expired", {
                        userId: existingUser.id?.toString() || "unknown",
                        expiresOn: existingUser.passwordResetExpiresOn?.toISOString() || "unknown",
                    });

                    throw new TRPCError({
                        code: "FORBIDDEN",
                        message: "Reset token has expired",
                    });
                }

                addSpanEvent("reset_password.token_valid", { userId: existingUser.id?.toString() || "unknown" });

                logger.debug("valid reset password request via tRPC");

                // Generate hashed password
                const hashedPassword = await generateHashedPassword(input.password);

                addSpanEvent("reset_password.password_hashed", { userId: existingUser.id?.toString() || "unknown" });

                // Update user with new password and clear reset fields
                await ctx.userDao.updateUser(existingUser.id!, {
                    password: hashedPassword,
                    passwordResetExpiresOn: null,
                    passwordResetToken: null,
                });

                addSpanAttributes({
                    "password.reset_successful": true,
                    "reset_token.cleared": true,
                });

                addSpanEvent("reset_password.success", { userId: existingUser.id?.toString() || "unknown" });

                logger.info("Password successfully reset via tRPC", { userId: existingUser.id });

                return {
                    status: "success",
                    message: "Password reset successfully",
                };
            })
        ),
        checkToken: publicProcedure.input(checkResetTokenSchema).mutation(
            withTracing("trpc.auth.checkResetToken", async (input, ctx, _span) => {
                logger.debug("tRPC check reset token");

                addSpanAttributes({
                    "auth.action": "checkResetToken",
                    "auth.method": "trpc",
                    "token.provided": !!input.token,
                });

                addSpanEvent("check_token.start", { tokenProvided: !!input.token });

                // Use v2 DAO for consistency with other tRPC endpoints
                const user = await ctx.userDao.findUserByPasswordResetToken(input.token);

                if (!user) {
                    addSpanEvent("check_token.token_not_found");
                    throw new TRPCError({
                        code: "NOT_FOUND",
                        message: "Invalid or expired reset token",
                    });
                }

                addSpanEvent("check_token.user_found", { userId: user.id?.toString() || "unknown" });

                // Check if token is expired
                if (!passwordResetDateIsValid(user.passwordResetExpiresOn || undefined)) {
                    addSpanEvent("check_token.token_expired", {
                        userId: user.id?.toString() || "unknown",
                        expiresOn: user.passwordResetExpiresOn?.toISOString() || "unknown",
                    });

                    throw new TRPCError({
                        code: "FORBIDDEN",
                        message: "Reset token has expired",
                    });
                }

                addSpanAttributes({
                    "user.found": true,
                    "token.valid": true,
                });

                addSpanEvent("check_token.success", { userId: user.id?.toString() || "unknown" });

                logger.debug("Valid reset token found via tRPC");

                return { valid: true };
            })
        ),
    }),
    signup: router({
        register: publicProcedure
            .input(loginSchema) // Reuse loginSchema since it has email and password validation
            .mutation(
                withTracing("trpc.auth.signup.register", async (input, ctx, _span) => {
                    logger.debug("IN tRPC SIGNUP");

                    addSpanAttributes({
                        "auth.action": "signup.register",
                        "auth.method": "trpc",
                        "email.provided": !!input.email,
                        "email.domain": input.email ? input.email.split("@")[1] : "unknown",
                        "password.provided": !!input.password,
                    });

                    addSpanEvent("signup.start", { emailProvided: !!input.email });

                    // Validate that both email and password are provided (should be handled by Zod but double-check)
                    if (!input.email || !input.password) {
                        addSpanEvent("signup.missing_details");
                        throw new TRPCError({
                            code: "BAD_REQUEST",
                            message: "Some details are missing. Cannot register user.",
                        });
                    }

                    // Use signUpAuthentication like RegisterHandler does
                    const registeredUser = await new Promise<PublicUser>((resolve, reject) => {
                        void signUpAuthentication(input.email, input.password, ctx.userDao, (err, user) => {
                            if (err) {
                                reject(err);
                            } else if (!user) {
                                reject(new Error("For some reason could not register user"));
                            } else {
                                resolve(user as PublicUser);
                            }
                        });
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
                            "isAdmin" in deserializedUser ? (deserializedUser.isAdmin() ? "admin" : "user") : "unknown",
                    });

                    addSpanAttributes({
                        "user.is_admin": "isAdmin" in deserializedUser ? deserializedUser.isAdmin() : false,
                    });

                    logger.info("User successfully registered via tRPC", {
                        userId: deserializedUser.id,
                        email: input.email,
                    });

                    return deserializedUser;
                })
            ),
        sendEmail: publicProcedure.input(emailSchema).mutation(
            withTracing("trpc.auth.signup.sendEmail", async (input, ctx, _span) => {
                logger.debug(`Preparing to send registration email to: ${input.email}`);

                addSpanAttributes({
                    "auth.action": "signup.sendEmail",
                    "auth.method": "trpc",
                    "email.requested": !!input.email,
                    "email.domain": input.email ? input.email.split("@")[1] : "unknown",
                });

                addSpanEvent("registration_email.start", { emailProvided: !!input.email });

                // Use v2 Prisma DAO to find user
                const user = await ctx.userDao.findUserWithPasswordByEmail(input.email);

                if (!user) {
                    addSpanEvent("registration_email.user_not_found", { email: input.email });
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

                return {
                    status: "oban job queued",
                    jobId: job.id.toString(),
                    userId: user.id,
                };
            })
        ),
    }),
});
