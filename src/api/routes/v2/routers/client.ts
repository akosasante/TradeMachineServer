import { protectedProcedure, publicProcedure, router, withTracing } from "../utils/trpcHelpers";
import { addSpanAttributes, addSpanEvent } from "../../../../utils/tracing";
import logger from "../../../../bootstrap/logger";
import { z } from "zod";
import {
    activeUserMetric,
    transferTokenExchangedMetric,
    transferTokenFailedMetric,
    transferTokenGeneratedMetric,
} from "../../../../bootstrap/metrics";
import { PublicUser } from "../../../../DAO/v2/UserDAO";
import { serializeUser } from "../../../../authentication/auth";
import { consumeTransferToken, createTransferToken, loadOriginalSession, SSO_CONFIG } from "../utils/ssoTokens";
import { TRPCError } from "@trpc/server";

// Declare the additional fields that we add to express session
declare module "express-session" {
    interface SessionData {
        user: string | undefined;
    }
}

export const clientRouter = router({
    getIP: publicProcedure.query(
        withTracing("trpc.client.getIP", async (input, ctx, _span) => {
            addSpanEvent("get_ip.start");

            // Extract IP from headers set by reverse proxies or direct connection
            const xForwardedFor = ctx.req.headers["x-forwarded-for"];
            const xRealIp = ctx.req.headers["x-real-ip"];
            const remoteAddress = ctx.req.connection?.remoteAddress || ctx.req.socket?.remoteAddress;

            // Determine the client IP following standard proxy header precedence
            let clientIP: string;

            if (xForwardedFor) {
                // x-forwarded-for can contain multiple IPs, take the first one (original client)
                clientIP = Array.isArray(xForwardedFor) ? xForwardedFor[0] : xForwardedFor.split(",")[0].trim();
            } else if (xRealIp) {
                clientIP = Array.isArray(xRealIp) ? xRealIp[0] : xRealIp;
            } else {
                clientIP = remoteAddress || "unknown";
            }

            // Normalize IPv6-mapped IPv4 addresses (e.g., ::ffff:192.168.1.1 -> 192.168.1.1)
            if (clientIP.startsWith("::ffff:")) {
                clientIP = clientIP.substring(7);
            }

            addSpanAttributes({
                "client.ip": clientIP,
                "client.ip_source": xForwardedFor ? "x-forwarded-for" : xRealIp ? "x-real-ip" : "direct",
                "client.has_proxy_headers": !!(xForwardedFor || xRealIp),
            });

            addSpanEvent("get_ip.success", {
                ip: clientIP,
                source: xForwardedFor ? "x-forwarded-for" : xRealIp ? "x-real-ip" : "direct",
            });

            logger.debug(`Client IP detected: ${clientIP}`);

            return Promise.resolve({ ip: clientIP });
        })
    ),
    /* Single-sign-on token transfer endpoint for clients to redirect an active session between the old UI domain
       and the new UI domain. This is a protected endpoint, so only logged-in users can access it.
       The token is short-lived and single-use. We will store the token in Redis, and associate it with the current
       user's cookie/session. The other UI domain can then redeem the token to log in the user there.
     */
    createRedirectToken: protectedProcedure
        .input(z.object({ redirectTo: z.string().url(), origin: z.string().url() }))
        .mutation(
            withTracing("trpc.client.createRedirectToken", async (input, ctx, _span) => {
                // User authantication is already ensured by protectedProcedure
                addSpanAttributes({
                    "create_redirect_token.request_origin": input.origin,
                    "create_redirect_token.request_redirect": input.redirectTo,
                });
                addSpanEvent("create_redirect_token.start");

                const url = new URL(input.redirectTo);
                if (!SSO_CONFIG.ALLOWED_REDIRECT_HOSTS.has(url.host)) {
                    transferTokenFailedMetric.inc({ reason: "invalid_redirect_host" });
                    throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid redirect host" });
                }

                const token = await createTransferToken({ sessionId: ctx.req.sessionID, userId: ctx.session!.user! });

                addSpanAttributes({
                    "create_redirect_token.token_created": true,
                    "create_redirect_token.token_ttl_seconds": SSO_CONFIG.TRANSFER_TOKEN_TTL_SECONDS,
                });
                addSpanEvent("create_redirect_token.success", { tokenFragment: token.slice(0, 8) });
                transferTokenGeneratedMetric.inc();

                return { token, redirectTo: input.redirectTo, expiresIn: SSO_CONFIG.TRANSFER_TOKEN_TTL_SECONDS };
            })
        ),
    exchangeRedirectToken: publicProcedure
        .input(
            z.object({
                token: z
                    .string()
                    .length(64)
                    .regex(/^[0-9a-f]{64}$/, "Invalid token format"),
            })
        )
        .mutation(
            withTracing("trpc.client.exchangeRedirectToken", async (input, ctx, _span) => {
                addSpanEvent("exchange_redirect_token.start", { tokenFragment: input.token.slice(0, 8) });
                if (!SSO_CONFIG.ALLOWED_REDIRECT_HOSTS.has(ctx.req.hostname)) {
                    transferTokenFailedMetric.inc({ reason: "invalid_request_host" });
                    throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid request host" });
                }

                const storedSession = await consumeTransferToken(input.token);
                if (!storedSession) {
                    transferTokenFailedMetric.inc({ reason: "invalid_or_expired_token" });
                    throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid or expired token" });
                }

                let user: PublicUser;

                try {
                    user = await ctx.userDao.getUserById(storedSession.userId);
                } catch (e) {
                    transferTokenFailedMetric.inc({ reason: "user_not_found" });
                    throw new TRPCError({ code: "BAD_REQUEST", message: "User not found" });
                }

                addSpanAttributes({
                    "exchange_redirect_token.session_id": storedSession.sessionId,
                    "exchange_redirect_token.user_id": user.id,
                });
                addSpanEvent("exchange_redirect_token.token_valid");

                const originalSession = await loadOriginalSession(storedSession.sessionId);
                if (!originalSession) {
                    transferTokenFailedMetric.inc({ reason: "original_session_not_found_or_expired" });
                    throw new TRPCError({ code: "BAD_REQUEST", message: "Original session not found or expired" });
                }

                addSpanEvent("exchange_redirect_token.original_session_loaded");

                await new Promise<void>((resolve, reject) => {
                    ctx.req.session.regenerate(err => {
                        if (err) return reject(err);
                        return resolve();
                    });
                });

                activeUserMetric.inc();

                // Copy over the user identity, to ensure express-session knows to resave the session
                ctx.req.session.user = serializeUser(user);

                addSpanAttributes({
                    "exchange_redirect_token.new_session_id": ctx.req.sessionID,
                    "exchange_redirect_token.new_session_user": ctx.req.session.user || "undefined",
                    "exchange_redirect_token.new_session_cookie_expires":
                        originalSession.cookie?.expires?.toString() || "undefined",
                    "exchange_redirect_token.token_consumed": true,
                });
                addSpanEvent("exchange_redirect_token.session_regenerated");
                transferTokenExchangedMetric.inc();

                return { success: true, user };
            })
        ),
});
