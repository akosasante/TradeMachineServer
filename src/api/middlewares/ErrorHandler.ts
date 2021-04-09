import { NextFunction, Request, Response } from "express";
import { ExpressErrorMiddlewareInterface, HttpError, Middleware } from "routing-controllers";
import { QueryFailedError } from "typeorm";
import { EntityColumnNotFound } from "typeorm/error/EntityColumnNotFound";
import { EntityNotFoundError } from "typeorm/error/EntityNotFoundError";
import logger from "../../bootstrap/logger";
import { AuthorizationRequiredError } from "routing-controllers/error/AuthorizationRequiredError";
import { rollbar } from "../../bootstrap/rollbar";
import { inspect } from "util";
// tslint:disable:max-classes-per-file

@Middleware({type: "after"})
export default class CustomErrorHandler implements ExpressErrorMiddlewareInterface {
    private static cleanErrorObject(error: Error) {
        return {message: error.message || "", stack: error.stack || ""};
    }
    public error(error: Error, request: Request, response: Response, next: NextFunction) {
        logger.error(`Handling error: ${error.stack}`);
        rollbar.error(error);
        if (response.headersSent) {
            logger.error("headers already sent, passing to next");
            return next(error);
        } else if (error instanceof AuthorizationRequiredError) {
            logger.error("User not logged in, converting AuthorizationRequiredError to 403 Forbidden");
            response.status(403).json(CustomErrorHandler.cleanErrorObject(error));
        } else if (error instanceof HttpError) {
            logger.error(`HTTP Error: ${error.message}`);
            response.status(error.httpCode).json(CustomErrorHandler.cleanErrorObject(error));
        } else if (error instanceof EntityNotFoundError) {
             logger.error(`Database Error: ${error.message}`);
             response.status(404).json(CustomErrorHandler.cleanErrorObject(error));
        } else if (error instanceof QueryFailedError || error instanceof EntityColumnNotFound) {
            logger.error(`Database/Entity Error: ${inspect(error.message)}`);
            response.status(400).json(CustomErrorHandler.cleanErrorObject(error));
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
