import { Request, Response } from "express";
import {
    BodyParam,
    Controller,
    CurrentUser,
    Get,
    NotFoundError,
    Post,
    Req,
    Res,
    Session,
    UseBefore
} from "routing-controllers";
import { deserializeUser, generateHashedPassword, passwordResetDateIsValid } from "../../authentication/auth";
import logger from "../../bootstrap/logger";
import UserDAO from "../../DAO/UserDAO";
import { LoginHandler, RegisterHandler } from "../middlewares/AuthenticationHandler";
import User from "../../models/user";
import { EmailPublisher } from "../../email/publishers";
import { rollbar } from "../../bootstrap/rollbar";
import { SessionData } from "express-session";
import { activeUserMetric } from "../../bootstrap/metrics";
import Users, { PublicUser } from "../../DAO/v2/UserDAO";
import { getPrismaClientFromRequest } from "../../bootstrap/prisma-db";
import ObanDAO from "../../DAO/v2/ObanDAO";
import {
    createSpanFromRequest,
    finishSpanWithResponse,
    finishSpanWithStatusCode,
    addSpanAttributes,
    addSpanEvent,
    extractTraceContext
} from "../../utils/tracing";
import { context } from "@opentelemetry/api";

// declare the additional fields that we add to express session (via routing-controllers)
declare module "express-session" {
    interface SessionData {
        user: string | undefined;
    }
}

@Controller("/auth")
export default class AuthController {
    private readonly userDao: UserDAO;
    private emailPublisher: EmailPublisher;

    constructor(userDAO?: UserDAO, publisher?: EmailPublisher) {
        this.userDao = userDAO || new UserDAO();
        this.emailPublisher = publisher || EmailPublisher.getInstance();
    }

    private dao(req: Request | undefined) {
        const prisma = getPrismaClientFromRequest(req);
        if (prisma) {
            return new Users(prisma.user);
        } else {
            return this.userDao;
        }
    }

    @Post("/login")
    @UseBefore(LoginHandler)
    public async login(@Req() request: Request, @Session() session: SessionData): Promise<User | PublicUser> {
        const { span, context: traceContext } = createSpanFromRequest("auth.login", request);

        return await context.with(traceContext, async () => {
            rollbar.info("login", request);
            activeUserMetric.inc();

            addSpanAttributes({
                "auth.session.exists": !!session.user,
                "auth.action": "login",
            });

            addSpanEvent("login.start", { userId: session.user! });

            const user = await deserializeUser(session.user!, this.dao(request));

            addSpanEvent("login.success", {
                userId: user.id?.toString() || "unknown",
                userType: "isAdmin" in user ? (user.isAdmin() ? "admin" : "user") : "unknown",
            });

            addSpanAttributes({
                "user.id": user.id?.toString() || "unknown",
                "user.is_admin": "isAdmin" in user ? user.isAdmin() : false,
            });

            finishSpanWithStatusCode(span, 200);
            return user;
        });
    }

    @Post("/login/sendResetEmail")
    public async sendResetEmail(
        @BodyParam("email") email: string,
        @Res() response: Response,
        @Req() request?: Request
    ): Promise<Response> {
        logger.debug(`Preparing to send reset password email to: ${email}`);
        rollbar.info("sendResetEmail", { email }, request);
        const user = await this.userDao.findUser({ email });

        if (!user) {
            throw new NotFoundError("No user found with the given email.");
        } else {
            // Update current user with reset request time
            const updatedUser = await this.userDao.setPasswordExpires(user.id!);

            // Queue send email with current user
            await this.emailPublisher.queueResetEmail(updatedUser);
            return response.status(202).json({ status: "email queued" });
        }
    }

    @Post("/signup")
    @UseBefore(RegisterHandler)
    public async signup(@Req() request: Request, @Session() session: SessionData): Promise<User | PublicUser> {
        rollbar.info("signup", request);
        activeUserMetric.inc();
        return await deserializeUser(session.user!, this.userDao);
    }

    @Post("/signup/sendEmail")
    public async sendRegistrationEmail(
        @BodyParam("email") email: string,
        @Res() response: Response,
        @Req() request?: Request
    ): Promise<Response> {
        logger.debug(`Preparing to send registration email to: ${email}`);
        rollbar.info("sendRegistrationEmail", { email }, request);
        const user = await this.userDao.findUser({ email });

        if (!user) {
            throw new NotFoundError("No user found with the given email.");
        } else {
            // Queue send email with current user
            await this.emailPublisher.queueRegistrationEmail(user);
            return response.status(202).json({ status: "email queued" });
        }
    }

    @Post("/logout")
    public async logout(@Req() request: Request, @Session() session: SessionData): Promise<any> {
        rollbar.info("logout", request);
        return new Promise((resolve, reject) => {
            if (session && session.user && request.session) {
                request.session.destroy((err: Error) => {
                    if (err) {
                        logger.error("Error destroying session");
                        rollbar.error(err, request);
                        reject(err);
                    } else {
                        logger.debug(`Destroying user session for userId#${session.user}`);
                        // await this.userDao.updateUser(session.user, {lastLoggedIn: new Date()});
                        delete session.user;
                        activeUserMetric.dec();
                        resolve(true);
                    }
                });
            } else {
                // Assumed-ly, there's nothing to log out of. We're all good.
                // I don't think it's necessary to throw an error here
                logger.debug("Resolving empty session logout");
                resolve(true);
            }
        });
    }

    @Post("/reset_password")
    public async resetPassword(
        @BodyParam("id") userId: string,
        @BodyParam("password") newPassword: string,
        @BodyParam("token") passwordResetToken: string,
        @Res() response: Response,
        @Req() request?: Request
    ): Promise<Response> {
        rollbar.info("resetPassword", { userId }, request);
        const existingUser = await this.userDao.getUserById(userId);

        if (
            !existingUser ||
            !existingUser.passwordResetToken ||
            existingUser.passwordResetToken !== passwordResetToken
        ) {
            logger.debug("did not find user for id and matching token");
            return response.status(404).json("user does not exist");
        }
        if (!passwordResetDateIsValid(existingUser.passwordResetExpiresOn)) {
            logger.debug("user password reset expired");
            return response.status(403).json("expired");
        }

        logger.debug("valid reset password request");
        const hashedPassword = await generateHashedPassword(newPassword);
        await this.userDao.updateUser(userId, {
            password: hashedPassword,
            passwordResetExpiresOn: undefined,
            passwordResetToken: undefined,
        });
        return response.status(200).json("success");
    }

    @Post("/login/sendResetEmailOban")
    public async sendResetEmailOban(
        @BodyParam("email") email: string,
        @Res() response: Response,
        @Req() request?: Request
    ): Promise<Response> {
        const { span, context: traceContext } = createSpanFromRequest("auth.sendResetEmailOban", request!);

        return await context.with(traceContext, async () => {
            logger.debug(`Preparing to send reset password email via Oban to...: ${email}`);
            rollbar.info("sendResetEmailOban", { email }, request);

            addSpanAttributes({
                "auth.action": "sendResetEmailOban",
                "email.requested": !!email,
                "email.domain": email ? email.split("@")[1] : "unknown",
            });

            addSpanEvent("reset_email.start", { emailProvided: !!email });

            const prisma = getPrismaClientFromRequest(request);
            if (!prisma) {
                addSpanEvent("reset_email.error", { reason: "Database connection unavailable" });
                finishSpanWithResponse(span, response);
                return response.status(500).json({ error: "Database connection unavailable" });
            }

            addSpanEvent("prisma.connected");

            const user = await this.dao(request).findUserWithPasswordByEmail(email);

            if (!user) {
                addSpanEvent("reset_email.user_not_found", { email });
                finishSpanWithResponse(span, response);
                throw new NotFoundError("No user found with the given email.");
            } else {
                addSpanAttributes({
                    "user.id": user.id?.toString() || "unknown",
                    "user.found": true,
                });

                addSpanEvent("user.found", { userId: user.id?.toString() || "unknown" });

                // Update current user with reset request time
                const updatedUser = await this.dao(request).setPasswordExpires(user.id!);

                addSpanEvent("user.password_expires_set", { userId: updatedUser.id?.toString() || "unknown" });

                if (!prisma.obanJob) {
                    logger.error("obanJob model not available in Prisma client");
                    addSpanEvent("oban.error", { reason: "obanJob not available in Prisma client" });
                    finishSpanWithResponse(span, response);
                    return response.status(500).json({ error: "obanJob not available in Prisma client" });
                }

                // Extract current trace context for Elixir continuation
                const currentTraceContext = extractTraceContext();

                addSpanEvent("trace_context.extracted", {
                    hasTraceContext: !!currentTraceContext,
                    traceparentLength: currentTraceContext?.traceparent?.length || 0,
                });

                // Queue job in Oban for Elixir to process
                const obanDao = new ObanDAO(prisma.obanJob);
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

                const responseData = {
                    status: "oban job queued",
                    jobId: job.id.toString(),
                    userId: updatedUser.id,
                };

                finishSpanWithResponse(span, response);
                return response.status(202).json(responseData);
            }
        });
    }

    @Get("/session_check")
    public sessionCheck(@CurrentUser({ required: true }) user: PublicUser): Promise<PublicUser> {
        logger.debug(`session check worked ${user}`);
        // rollbar.info("sessionCheck", { user });
        return Promise.resolve(user);
    }
}
