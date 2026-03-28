import winston from "winston";
import { requestContext } from "../utils/requestContext";

const { combine, timestamp, json, colorize, printf, errors } = winston.format;

/**
 * Winston format that merges user identity fields from AsyncLocalStorage into every
 * log entry when a request context is active. When no context is set (e.g. unit
 * tests or startup logs) it is a no-op so the log shape stays the same.
 */
const requestContextFormat = winston.format(info => {
    const store = requestContext.getStore();
    if (store) {
        if (store.userId) info.userId = store.userId;
        if (store.userEmail) info.userEmail = store.userEmail;
        if (store.userName) info.userName = store.userName;
        if (store.ip) info.ip = store.ip;
    }
    return info;
})();

// Structured JSON format for production and development
const jsonFormat = combine(requestContextFormat, timestamp(), errors({ stack: true }), json());

// Human-readable format for development (optional, can be switched to JSON)
const devFormat = combine(
    timestamp(),
    colorize(),
    errors({ stack: true }),
    printf(({ timestamp: logTimestamp, level, message, stack, ...meta }) => {
        let log = `${logTimestamp} [${level}]: ${message}`;
        if (stack) {
            log += `\n${stack}`;
        }
        if (Object.keys(meta).length > 0) {
            log += `\n${JSON.stringify(meta, null, 2)}`;
        }
        return log;
    })
);

// Console transport - handles both regular logs and exceptions
const consoleTransport = new winston.transports.Console({
    format: process.env.NODE_ENV === "production" ? jsonFormat : devFormat,
    handleExceptions: true,
    handleRejections: true,
});

// Logger object - simplified to console-only structured logging
const logger = winston.createLogger({
    level: process.env.NODE_ENV === "production" ? "info" : "debug",
    format: jsonFormat,
    transports: [consoleTransport],
    silent: process.env.ENABLE_LOGS === "false",
    exitOnError: false,
});

// Last ditch if the logger itself errors
// eslint-disable-next-line no-console
logger.on("error", err => console.error(err));

export default logger;
