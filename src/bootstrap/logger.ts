import fs from "fs";
import path from "path";
import winston from "winston";

const { combine, timestamp, printf } = winston.format;
const logDir = path.resolve(`${process.env.BASE_DIR}/logs`);
const fileLogFormat = printf(info => {
    return `[ ${info.timestamp} ]\t${info.level}: ${info.message}`;
});
// No need to write error if we're only printing that level here anyway
const errorFileLogFormat = printf(info => {
    return `[ ${info.timestamp} ]:\t${info.message}`;
});
const timestampFormat = "YYYY-MM-DD hh:mm:ss A";

if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir);
}

// Transport objects
const consoleLogger = new winston.transports.Console({
    format: winston.format.cli(),
});

const errorLogger  = new winston.transports.File({
    filename: `${logDir}/server-error.log`,
    level: "error",
    eol: "\r\n",
});

const combinedLogger = new winston.transports.File({
    filename: `${logDir}/server-combined.log`,
    level: "info",
    eol: "\r\n",
    format: combine(timestamp({format: timestampFormat}), fileLogFormat),
});

const exceptionHandler = new winston.transports.File({
    filename: `${logDir}/uncaught-exceptions.log`,
    eol: "\r\n",
});

// Logger object
const logger = winston.createLogger(({
    level: "debug",
    format: combine(timestamp({format: timestampFormat}), errorFileLogFormat),
    transports: [
        errorLogger,
        combinedLogger,
    ],
    silent: !!process.env.SUPRESS_LOGS,
    exceptionHandlers: [
        exceptionHandler,
    ],
    exitOnError: false,
}));

if (process.env.NODE_ENV !== "production") {
    logger.add(consoleLogger);
}

// Last ditch if the logger itself errors
// tslint:disable-next-line:no-console
logger.on("error", err => console.error(err));

export default logger;
