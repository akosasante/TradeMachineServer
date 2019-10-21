import bodyParser from "body-parser";
import compression from "compression";
import connectRedis from "connect-redis";
import express from "express";
import expressSession from "express-session";
import morgan from "morgan";
import redis from "redis";
import responseTime from "response-time";
import logger from "./logger";

const app = express();

// Express configuration
app.set("port", process.env.PORT || "3000");
app.set("ip", process.env.IP || "localhost");
app.set("env", process.env.NODE_ENV || "development");
app.set("json spaces", 2);
app.set("trust proxy", 1);
app.use(compression());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(morgan("dev", { stream: { write: message => logger.info(message.trim()) } }));
app.use(responseTime());

// Session tracking
const RedisSessionStore = connectRedis(expressSession);
export const redisClient = redis.createClient(
    Number(process.env.REDIS_PORT || 6379),
    process.env.REDIS_IP || "localhost");

const REDIS_OPTS = {
    logErrors: true,
    ttl: 7200000,
    client: redisClient,
};

app.use(expressSession({
    resave: false,
    saveUninitialized: true,
    secret: process.env.SESSION_SECRET || "test",
    store: new RedisSessionStore(REDIS_OPTS),
    unset: "destroy",
    cookie: {
        secure: process.env.NODE_ENV === "production",
        httpOnly: false,
        // @ts-ignore
        name: "trades.sid",
        // rolling: true,
        // domain: "127.0.0.1:8080",
        maxAge: 7200000,
    },
}));

export default app;
