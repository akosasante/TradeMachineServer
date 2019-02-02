import { NextFunction, Request, Response } from "express";
import { get } from "lodash";
import { ExpressMiddlewareInterface, UnauthorizedError } from "routing-controllers";
import util from "util";
import { serializeUser, signInAuthentication, signUpAuthentication } from "../../bootstrap/auth";
import logger from "../../bootstrap/logger";
import User from "../../models/user";
// tslint:disable:max-classes-per-file

export class LoginHandler implements ExpressMiddlewareInterface {
    public async use(request: Request, response: Response, next: NextFunction) {
        logger.debug("IN LOGIN HANDLER");
        const email = get(request, "body.email");
        const password = get(request, "body.password");
        return signInAuthentication(email, password, async (err?: Error, user?: User) => {
            if (err || !user) {
                return next(new UnauthorizedError(err ? err.message : "User could not be authenticated."));
            } else {
                request.session!.user = await serializeUser(user);
                return next();
            }
        });
    }
}

export class RegisterHandler implements ExpressMiddlewareInterface {
    public async use(request: Request, response: Response, next: NextFunction) {
        logger.debug("IN REGISTER HANDLER");
        const email = get(request, "body.email");
        const password = get(request, "body.password");
        return signUpAuthentication(email, password, async (err?: Error, user?: User) => {
            if (err) {
                return next(err);
            } else if (!user) {
                return next(new Error("For some reason could not register user"));
            } else {
                request.session!.user = await serializeUser(user);
                return next();
            }
        });
    }
}
