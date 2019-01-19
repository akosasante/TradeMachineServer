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
app.use(compression());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(morgan("dev", { stream: { write: message => logger.info(message.trim()) } }));

// Session tracking
const redisSession = connectRedis(expressSession);
export const redisClient = redis.createClient();

const redisStore = new redisSession({
    host: process.env.REDIS_IP || "localhost",
    port: Number(process.env.REDIS_PORT || 6379),
    ttl: 3000,
    logErrors: true,
    client: redisClient,
});

app.use(expressSession({
    resave: false,
    saveUninitialized: true,
    secret: process.env.SESSION_SECRET || "test",
    store: redisStore,
}));

export default app;
