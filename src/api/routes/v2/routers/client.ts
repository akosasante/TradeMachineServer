import { protectedProcedure, publicProcedure, router, withTracing } from "../utils/trpcHelpers";
import { addSpanAttributes, addSpanEvent } from "../../../../utils/tracing";
import logger from "../../../../bootstrap/logger";
import { z } from "zod";
import {
    activeSessionsMetric,
    tradeActionTokenExchangedMetric,
    tradeActionTokenFailedMetric,
    transferTokenExchangedMetric,
    transferTokenFailedMetric,
    transferTokenGeneratedMetric,
} from "../../../../bootstrap/metrics";
import { PublicUser } from "../../../../DAO/v2/UserDAO";
import { serializeUser, setSessionUserContext } from "../../../../authentication/auth";
import {
    consumeTransferToken,
    createTransferToken,
    loadOriginalSession,
    registerUserSession,
    SSO_CONFIG,
} from "../utils/ssoTokens";
import { consumeTradeActionToken } from "../utils/tradeActionTokens";
import { TRPCError } from "@trpc/server";
import "../../../../types/session.types";
import {
    applyNetlifySessionCookieHeaderPatch,
    saveExpressSession,
} from "../../../middlewares/CookieDomainHandler";

export const clientRouter = router({
    getIP: publicProcedure.query(
        withTracing("trpc.client.getIP", async (input, ctx, _span) => {
            addSpanEvent("get_ip.start");

            // Extract IP from headers set by reverse proxies or direct connection.
            // Cloudflare (and some other CDNs) set CF-Connecting-IP to the end-user address; without it,
            // the TCP peer is often a Cloudflare POP (e.g. 104.30.x.x), which breaks IP allowlists.
            const cfConnectingIp = ctx.req.headers["cf-connecting-ip"];
            const xForwardedFor = ctx.req.headers["x-forwarded-for"];
            const xRealIp = ctx.req.headers["x-real-ip"];
            const remoteAddress = ctx.req.connection?.remoteAddress || ctx.req.socket?.remoteAddress;

            let clientIP: string;
            let ipSource: "cf-connecting-ip" | "x-forwarded-for" | "x-real-ip" | "direct";

            if (cfConnectingIp) {
                const raw = Array.isArray(cfConnectingIp) ? cfConnectingIp[0] : cfConnectingIp;
                clientIP = raw.trim();
                ipSource = "cf-connecting-ip";
            } else if (xForwardedFor) {
                // x-forwarded-for can contain multiple IPs, take the first one (original client)
                clientIP = Array.isArray(xForwardedFor) ? xForwardedFor[0] : xForwardedFor.split(",")[0].trim();
                ipSource = "x-forwarded-for";
            } else if (xRealIp) {
                clientIP = Array.isArray(xRealIp) ? xRealIp[0] : xRealIp;
                ipSource = "x-real-ip";
            } else {
                clientIP = remoteAddress || "unknown";
                ipSource = "direct";
            }

            // Normalize IPv6-mapped IPv4 addresses (e.g., ::ffff:192.168.1.1 -> 192.168.1.1)
            if (clientIP.startsWith("::ffff:")) {
                clientIP = clientIP.substring(7);
            }

            addSpanAttributes({
                "client.ip": clientIP,
                "client.ip_source": ipSource,
                "client.has_proxy_headers": !!(cfConnectingIp || xForwardedFor || xRealIp),
            });

            addSpanEvent("get_ip.success", {
                ip: clientIP,
                source: ipSource,
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

                const redirectUrl = new URL(input.redirectTo);
                const originUrl = new URL(input.origin);
                if (!SSO_CONFIG.ALLOWED_REDIRECT_HOSTS.has(redirectUrl.origin)) {
                    transferTokenFailedMetric.inc({ reason: "invalid_redirect_host", value: redirectUrl.origin });
                    throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid redirect host" });
                }
                if (!SSO_CONFIG.ALLOWED_REDIRECT_HOSTS.has(originUrl.origin)) {
                    transferTokenFailedMetric.inc({ reason: "invalid_request_host", value: originUrl.origin });
                    throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid request host" });
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
                const originHeader = ctx.req.header("Origin");
                if (!SSO_CONFIG.ALLOWED_REDIRECT_HOSTS.has(originHeader || "")) {
                    transferTokenFailedMetric.inc({ reason: "invalid_request_host", value: originHeader });
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

                // Regenerate the session to prevent session fixation attacks — if an attacker
                // knew the session ID before the SSO token was redeemed, this invalidates it and
                // issues a fresh session ID before we associate any user identity with it.
                await new Promise<void>((resolve, reject) => {
                    ctx.req.session.regenerate(err => {
                        if (err) return reject(err);
                        return resolve();
                    });
                });

                // Only increment sessions metric - user is already logged in, just creating a new session
                activeSessionsMetric.inc();

                // Copy over the user identity, to ensure express-session knows to resave the session
                ctx.req.session.user = serializeUser(user);
                setSessionUserContext(ctx.req.session, user);

                // Match auth.login: persist session + Netlify-style Set-Cookie so the browser keeps the cookie
                applyNetlifySessionCookieHeaderPatch(ctx.req, ctx.res);
                await saveExpressSession(ctx.req.session);

                await registerUserSession(user.id!, ctx.req.sessionID);

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
    /*
     * Trade action magic-link token exchange.
     * Public endpoint — the token itself is the proof of identity.
     * Validates the token, creates a new server session for the associated user,
     * and returns the user + the intended trade action so the client can proceed.
     */
    exchangeTradeActionToken: publicProcedure
        .input(
            z.object({
                token: z
                    .string()
                    .length(64)
                    .regex(/^[0-9a-f]{64}$/, "Invalid token format"),
            })
        )
        .mutation(
            withTracing("trpc.client.exchangeTradeActionToken", async (input, ctx, _span) => {
                addSpanEvent("exchange_trade_action_token.start", { tokenFragment: input.token.slice(0, 8) });

                const payload = await consumeTradeActionToken(input.token);
                if (!payload) {
                    tradeActionTokenFailedMetric.inc({ reason: "invalid_or_expired_token" });
                    throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid or expired token" });
                }

                let user: PublicUser;
                try {
                    user = await ctx.userDao.getUserById(payload.userId);
                } catch (e) {
                    tradeActionTokenFailedMetric.inc({ reason: "user_not_found" });
                    throw new TRPCError({ code: "BAD_REQUEST", message: "User not found" });
                }

                addSpanAttributes({
                    "exchange_trade_action_token.user_id": user.id,
                    "exchange_trade_action_token.trade_id": payload.tradeId,
                    "exchange_trade_action_token.action": payload.action,
                });
                addSpanEvent("exchange_trade_action_token.token_valid");

                // Session fixation protection: regenerate the session ID so that an attacker
                // who knew the pre-auth session ID cannot hijack the authenticated session.
                // IMPORTANT: only do this when the request arrives WITHOUT an existing
                // authenticated session. If the user is already logged in, calling
                // session.regenerate() deletes their current Redis session entry. If the
                // new Set-Cookie header doesn't reach the browser (common with cross-origin
                // SameSite restrictions), the browser keeps sending the now-deleted old
                // session ID and the user appears logged out on all subsequent requests.
                const alreadyAuthenticated = !!ctx.req.session.user;

                if (!alreadyAuthenticated) {
                    await new Promise<void>((resolve, reject) => {
                        ctx.req.session.regenerate(err => {
                            if (err) return reject(err);
                            return resolve();
                        });
                    });
                    activeSessionsMetric.inc();
                }

                ctx.req.session.user = serializeUser(user);
                setSessionUserContext(ctx.req.session, user);

                applyNetlifySessionCookieHeaderPatch(ctx.req, ctx.res);
                await saveExpressSession(ctx.req.session);

                await registerUserSession(user.id!, ctx.req.sessionID);

                addSpanAttributes({
                    "exchange_trade_action_token.new_session_id": ctx.req.sessionID,
                    "exchange_trade_action_token.token_consumed": true,
                    "exchange_trade_action_token.session_regenerated": !alreadyAuthenticated,
                });
                addSpanEvent("exchange_trade_action_token.session_created");
                tradeActionTokenExchangedMetric.inc({ action: payload.action });

                logger.info(
                    `[exchangeTradeActionToken] Session created for userId=${user.id} tradeId=${payload.tradeId} action=${payload.action}`
                );

                return { success: true, user, tradeId: payload.tradeId, action: payload.action };
            })
        ),
});
