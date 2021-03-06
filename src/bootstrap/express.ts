import bodyParser from "body-parser";
import compression from "compression";
import connectRedis from "connect-redis";
import express from "express";
import expressSession from "express-session";
import morgan from "morgan";
import redis from "redis";
import responseTime from "response-time";
import logger from "./logger";
import { rollbar } from "./rollbar";

const app = express();

// Express configuration.
app.set("port", process.env.PORT || "3000");
app.set("ip", process.env.IP || "localhost");
app.set("env", process.env.NODE_ENV || "development");
app.set("json spaces", 2);
app.set("trust proxy", 1);
app.use(compression());
app.use(bodyParser.json({ limit: "10mb" }));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(morgan("dev", { stream: { write: message => logger.info(message.trim()) } }));
app.use(responseTime());
app.use(rollbar.errorHandler());

// Session tracking
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 60 sec * 60 min * 24hr * 7 = 7 days
const redisStore = connectRedis(expressSession);
export const redisClient = redis.createClient(
    Number(process.env.REDIS_PORT || 6379),
    process.env.REDIS_IP || "localhost"
);

const REDIS_OPTS = {
    logErrors: true,
    ttl: COOKIE_MAX_AGE_SECONDS,
    client: redisClient,
    prefix: "stg_sess",
};

app.use(
    expressSession({
        resave: false,
        saveUninitialized: true,
        secret: process.env.SESSION_SECRET || "test",
        store: new redisStore(REDIS_OPTS),
        unset: "destroy",
        name: process.env.ORM_CONFIG === "staging" ? "staging_trades.sid" : "trades.sid",
        cookie: {
            secure: process.env.NODE_ENV !== "test",
            httpOnly: true,
            maxAge: COOKIE_MAX_AGE_SECONDS * 1000,
            sameSite: "none",
        },
    })
);

export default app;
