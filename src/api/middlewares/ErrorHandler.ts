import { NextFunction, Request, Response } from "express";
import { ExpressErrorMiddlewareInterface, HttpError, Middleware } from "routing-controllers";
import { QueryFailedError } from "typeorm";
import { EntityColumnNotFound } from "typeorm/error/EntityColumnNotFound";
import { EntityNotFoundError } from "typeorm/error/EntityNotFoundError";
import util from "util";
import logger from "../../bootstrap/logger";
// tslint:disable:max-classes-per-file

@Middleware({type: "after"})
export default class CustomErrorHandler implements ExpressErrorMiddlewareInterface {
    public error(error: Error, request: Request, response: Response, next: NextFunction) {
        logger.error(`Handling error: ${error.stack}`);
        if (response.headersSent) {
            logger.error("headers already sent, passing to next");
            return next(error);
        } else if (error instanceof HttpError) {
            logger.error(`HTTP Error: ${error.message}`);
            response.status(error.httpCode).json(this.cleanErrorObject(error));
        } else if (error instanceof EntityNotFoundError) {
             logger.error(`Database Error: ${error.message}`);
             response.status(404).json(this.cleanErrorObject(error));
        } else if (error instanceof QueryFailedError || error instanceof EntityColumnNotFound) {
            logger.error(`Database Error: ${error.message}`);
            response.status(400).json(this.cleanErrorObject(error));
        } else {
            const errorKind = util.inspect(Object.getPrototypeOf(error));
            logger.error(`Unknown Error: ${errorKind}`);
            response.status(500).json(error);
        }
    }
    private cleanErrorObject(error: Error) {
        return {message: error.message || "", stack: error.stack || {}};
    }
}

export class ConflictError extends HttpError {
    constructor(msg: string) {
        super(409, msg || "Conflict Found In Request");
    }
}
