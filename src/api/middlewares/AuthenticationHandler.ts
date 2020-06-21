import { NextFunction, Request, Response } from "express";
import { ExpressMiddlewareInterface, UnauthorizedError } from "routing-controllers";
import { inspect } from "util";
import { serializeUser, signInAuthentication, signUpAuthentication } from "../../authentication/auth";
import logger from "../../bootstrap/logger";
import UserDAO from "../../DAO/UserDAO";
import UserDO from "../../models/user";

// tslint:disable:max-classes-per-file

export class LoginHandler implements ExpressMiddlewareInterface {
    constructor(public userDAO: UserDAO = new UserDAO()) {}

    public async use(request: Request, response: Response, next: NextFunction) {
        logger.debug("IN LOGIN HANDLER");
        const email = request?.body?.email;
        const password = request?.body?.password;
        return signInAuthentication(email, password, this.userDAO, async (err?: Error, user?: UserDO) => {
            if (err || !user) {
                const message = `User could not be authenticated. ${err ? err.message : ""}`;
                request.session!.destroy((sessionDestroyErr: Error) => {
                    logger.debug(`Attempting to destroy un-auth'd session: ${sessionDestroyErr}`);
                });
                return next(new UnauthorizedError(message));
            } else {
                request.session!.user = serializeUser(user);
                request.session!.save((sessionErr: any) => {
                    logger.debug(inspect(request.session));
                    if (sessionErr) {
                        return next(new Error("Could not save session"));
                    }
                    return next();
                });
            }
        });
    }
}

export class RegisterHandler implements ExpressMiddlewareInterface {
    constructor(public userDAO: UserDAO = new UserDAO()) {}

    public async use(request: Request, response: Response, next: NextFunction) {
        logger.debug("IN REGISTER HANDLER");
        const email = request?.body?.email;
        const password = request?.body?.password;
        if (!email || !password) {
            return next(new Error("Some details are missing. Cannot register user."));
        }
        return signUpAuthentication(email, password, this.userDAO, async (err?: Error, user?: UserDO) => {
            if (err) {
                return next(err);
            } else if (!user) {
                return next(new Error("For some reason could not register user"));
            } else {
                logger.debug(`registered user: ${user}`);
                request.session!.user = serializeUser(user);
                return next();
            }
        });
    }
}
