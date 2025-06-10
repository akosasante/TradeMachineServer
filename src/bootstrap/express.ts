import { PrismaClient } from "@prisma/client";
import compression from "compression";
import connectRedis from "connect-redis";
import express from "express";
import expressSession from "express-session";
import morgan from "morgan";
import { createClient } from "redis";
import responseTime from "response-time";
import logger from "./logger";
import { rollbar } from "./rollbar";
import { metricsMiddleware } from "./metrics";
import { registerCleanupCallback } from "./shutdownHandler";
import {inspect} from "util";

const app = express();

// Express configuration.
app.set("port", process.env.PORT || "3000");
app.set("ip", process.env.IP || "localhost");
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
    prisma: PrismaClient | undefined;
}

// Session tracking
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 60 sec * 60 min * 24hr * 7 = 7 days
const redisStore = connectRedis(expressSession);

logger.debug(`CREATING REDIS CLIENT: ${inspect(process.env)}`);

export const redisClient = createClient({
    // legacyMode: true is required to work with connect-redis + redis v4: https://github.com/tj/connect-redis/pull/345
    legacyMode: true,
    socket: {
        host: process.env.REDIS_IP || "localhost",
        port: Number(process.env.REDIS_PORT || 6379),
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
        },
    })
);

app.use(metricsMiddleware as any);

export default app;
