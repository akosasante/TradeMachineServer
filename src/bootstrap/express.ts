import bodyParser from "body-parser";
import compression from "compression";
import connectRedis from "connect-redis";
import express from "express";
import expressSession from "express-session";
import morgan from "morgan";
import redis from "redis";
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

// Session tracking
const RedisSessionStore = connectRedis(expressSession);
export const redisClient = redis.createClient();

const REDIS_OPTS = {
    host: process.env.REDIS_IP || "localhost",
    port: Number(process.env.REDIS_PORT || 6379),
    logErrors: true,
    ttl: 7200000,
    // client: redisClient,
};

// const SESSION_OPTS = {
//     resave: false,
//     saveUninitialized: true,
//     secret: process.env.SESSION_SECRET || "test",
//     store: new RedisSessionStore(REDIS_OPTS),
//     cookie: {
//         secure: process.env.NODE_ENV === "production",
//         name: "trades.sid",
//         rolling: true,
//         maxAge: 3000,
//     },
// };

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
