import compression from "compression";
import connectRedis from "connect-redis";
import express, { Request } from "express";
import expressSession from "express-session";
import morgan from "morgan";
import { createClient } from "redis";
import responseTime from "response-time";
import logger from "./logger";
import { rollbar } from "./rollbar";
import { metricsMiddleware } from "./metrics";
import { registerCleanupCallback } from "./shutdownHandler";
import { ExtendedPrismaClient } from "./prisma-db";

const app = express();

// Express configuration.
app.set("port", process.env.PORT || "3000");
// Force IPv4 in test mode to match Redis client and avoid IPv6/IPv4 mismatch in CI
app.set("ip", process.env.IP || (process.env.NODE_ENV === "test" ? "127.0.0.1" : "localhost"));
app.set("env", process.env.NODE_ENV || "development");
app.set("json spaces", 2);
app.set("trust proxy", 1);
app.use(compression());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev", { stream: { write: message => logger.info(message.trim()) } }));
app.use(responseTime());
if (process.env.NODE_ENV !== "test") {
    app.use(rollbar.errorHandler());
}

export interface ExpressAppSettings {
    prisma: ExtendedPrismaClient | undefined;
}

export function getAppSettings(req: Request | undefined): ExpressAppSettings | undefined {
    return req?.app?.settings as ExpressAppSettings | undefined;
}

// Session tracking
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 60 sec * 60 min * 24hr * 7 = 7 days
const redisStore = connectRedis(expressSession);

export const redisClient = createClient({
    // legacyMode: true is required to work with connect-redis + redis v4: https://github.com/tj/connect-redis/pull/345
    legacyMode: true,
    socket: {
        host: process.env.REDIS_IP || "localhost",
        port: Number(process.env.REDIS_PORT || 6379),
        family: 4, // Force IPv4 to avoid Node 20's IPv6 preference
    },
    password: process.env.REDISPASS,
});

registerCleanupCallback(async () => {
    await redisClient.disconnect();
});

const REDIS_OPTS = {
    logErrors: true,
    ttl: COOKIE_MAX_AGE_SECONDS,
    client: redisClient,
    prefix: process.env.ORM_CONFIG === "staging" ? "stg_sess:" : "sess:",
};

const insecureCookies = process.env.COOKIE_SECURE === "false" || process.env.NODE_ENV === "test";

app.use(
    expressSession({
        resave: false,
        saveUninitialized: true,
        secret: process.env.SESSION_SECRET || "test",
        store: new redisStore(REDIS_OPTS),
        unset: "destroy",
        name: process.env.ORM_CONFIG === "staging" ? "staging_trades.sid" : "trades.sid",
        cookie: {
            // Don't set secure cookies in dev/test
            secure: !insecureCookies,
            httpOnly: true,
            maxAge: COOKIE_MAX_AGE_SECONDS * 1000,
            sameSite: insecureCookies ? "lax" : "none",
            // Set domain to share cookies across subdomains (e.g., newtrades.api.akosua.xyz and staging.trades.akosua.xyz)
            domain: process.env.COOKIE_DOMAIN || undefined,
        },
    })
);

app.use(metricsMiddleware as any);

export default app;
