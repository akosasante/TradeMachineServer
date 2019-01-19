import { NextFunction, Request, Response } from "express";
import { ExpressErrorMiddlewareInterface, Middleware } from "routing-controllers";
import util from "util";
import logger from "../../bootstrap/logger";

@Middleware({type: "after"})
export default class CustomErrorHandler implements ExpressErrorMiddlewareInterface {
    public error(error: Error, request: Request, response: Response, next: NextFunction) {
        logger.error(`Handling error: ${error.stack}`);
        if (response.headersSent) {
            logger.error("headers already sent, passing to next");
            return next(error);
        } else {
            const errorKind = util.inspect(Object.getPrototypeOf(error));
            logger.error(`Unknown Error: ${errorKind}`);
            response.status(500).json(error);
        }
    }
}
