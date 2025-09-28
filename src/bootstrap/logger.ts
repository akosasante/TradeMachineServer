import winston from "winston";

const { combine, timestamp, json, colorize, printf, errors } = winston.format;

// Structured JSON format for production and development
const jsonFormat = combine(
    timestamp(),
    errors({ stack: true }),
    json()
);

// Human-readable format for development (optional, can be switched to JSON)
const devFormat = combine(
    timestamp(),
    colorize(),
    errors({ stack: true }),
    printf(({ timestamp, level, message, stack, ...meta }) => {
        let log = `${timestamp} [${level}]: ${message}`;
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
