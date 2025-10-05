/* eslint-disable max-classes-per-file */
import { NextFunction, Request, Response } from "express";
import { ExpressErrorMiddlewareInterface, HttpError, Middleware } from "routing-controllers";
import { QueryFailedError } from "typeorm";
import { EntityPropertyNotFoundError } from "typeorm/error/EntityPropertyNotFoundError";
import { EntityNotFoundError } from "typeorm/error/EntityNotFoundError";
import logger from "../../bootstrap/logger";
import { rollbar } from "../../bootstrap/rollbar";
import { inspect } from "util";
import { trace, SpanStatusCode } from "@opentelemetry/api";

@Middleware({ type: "after" })
export default class CustomErrorHandler implements ExpressErrorMiddlewareInterface {
    private static cleanErrorObject(error: Error) {
        return { message: error.message || "", stack: error.stack || "" };
    }

    public error(error: Error, request: Request, response: Response, next: NextFunction): void {
        logger.error(`Handling error: ${error.stack}`);
        rollbar.error(error, request);

        // Record error in active span if one exists
        const activeSpan = trace.getActiveSpan();
        if (activeSpan) {
            activeSpan.recordException(error);
            activeSpan.addEvent("error.handled_by_global_handler", {
                "error.type": error.constructor.name,
                "error.message": error.message,
            });
            activeSpan.setStatus({
                code: SpanStatusCode.ERROR,
                message: error.message,
            });
        }

        if (response.headersSent) {
            logger.error("headers already sent, passing to next");
            return next(error);
        } else if (error instanceof HttpError) {
            if (error.name === "AuthorizationRequiredError") {
                logger.error("User not logged in, converting AuthorizationRequiredError to 403 Forbidden");
                response.status(403).json(CustomErrorHandler.cleanErrorObject(error));
            } else {
                logger.error(`HTTP Error: ${error.message}`);
                response.status(error.httpCode).json(CustomErrorHandler.cleanErrorObject(error));
            }
        } else if (error instanceof EntityNotFoundError) {
            logger.error(`Database Error: ${error.message}`);
            response.status(404).json(CustomErrorHandler.cleanErrorObject(error));
        } else if (error instanceof QueryFailedError || error instanceof EntityPropertyNotFoundError) {
            logger.error(`Database/Entity Error: ${inspect(error.message)}`);
            response.status(400).json(CustomErrorHandler.cleanErrorObject(error));
        } else if (error instanceof SyntaxError && error.message.includes("not valid JSON")) {
            logger.error(`Syntax Error (probably thrown by body-parser json() middleware): ${error.message}`);
            response.status(400).json({ message: "Invalid JSON in request body", stack: error.stack || "" });
        } else {
            logger.error(`Unknown Error: ${JSON.stringify(Object.getPrototypeOf(error))}`);
            response.status(500).json(error);
        }
    }
}

export class ConflictError extends HttpError {
    constructor(msg: string) {
        super(409, msg || "Conflict Found In Request");
    }
}
/* eslint-enable max-classes-per-file */
