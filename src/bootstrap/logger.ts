import fs from "fs";
import path from "path";
import winston from "winston";

const { combine, timestamp, printf, uncolorize } = winston.format;
const fileLogFormat = printf(info => {
    return `[ ${info.timestamp} ]\t${info.level}: ${info.message}`;
});
// No need to write error if we're only printing that level here anyway
const errorFileLogFormat = printf(info => {
    return `[ ${info.timestamp} ]:\t${info.message}`;
});
const timestampFormat = "YYYY-MM-DD hh:mm:ss A";

// Transport objects
const consoleLogger = new winston.transports.Console({
    format: combine(winston.format.cli()),
});

let errorLogger;
let combinedLogger;
let exceptionHandler;

if (process.env.NODE_ENV !== "test") {
    const logDir = path.resolve(`${process.env.BASE_DIR}/logs`);

    if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir);
    }

    errorLogger = new winston.transports.File({
        filename: `${logDir}/server-error.log`,
        level: "error",
        eol: "\r\n",
        maxsize: 52428800,
        maxFiles: 10,
        tailable: true,
    });

    combinedLogger = new winston.transports.File({
        filename: `${logDir}/server-combined.log`,
        level: "info",
        eol: "\r\n",
        format: combine(timestamp({ format: timestampFormat }), uncolorize(), fileLogFormat),
        maxsize: 52428800,
        maxFiles: 10,
        tailable: true,
    });

    exceptionHandler = new winston.transports.File({
        filename: `${logDir}/uncaught-exceptions.log`,
        eol: "\r\n",
        maxsize: 52428800,
        maxFiles: 10,
        tailable: true,
    });
}
// Logger object
const logger = winston.createLogger({
    level: "debug",
    format: combine(timestamp({ format: timestampFormat }), errorFileLogFormat),
    transports: errorLogger && combinedLogger ? [errorLogger, combinedLogger] : [],
    silent: process.env.ENABLE_LOGS === "false",
    exceptionHandlers: exceptionHandler ? [exceptionHandler] : [],
    exitOnError: false,
});

if (process.env.ENABLE_LOGS === "true") {
    logger.add(consoleLogger);
}

// Last ditch if the logger itself errors
// eslint-disable-next-line no-console
logger.on("error", err => console.error(err));

export default logger;
