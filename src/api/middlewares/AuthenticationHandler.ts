/* eslint-disable max-classes-per-file */
import { NextFunction, Request, Response } from "express";
import { ExpressMiddlewareInterface, UnauthorizedError } from "routing-controllers";
import { inspect } from "util";
import { serializeUser, signInAuthentication, signUpAuthentication } from "../../authentication/auth";
import logger from "../../bootstrap/logger";
import UserDAO from "../../DAO/UserDAO";
import UserDO from "../../models/user";

// declare the additional fields that we add to express session (via routing-controllers)
declare module "express-session" {
    interface SessionData {
        user: string | undefined;
    }
}

export class LoginHandler implements ExpressMiddlewareInterface {
    constructor(public userDAO: UserDAO = new UserDAO()) {}

    public async use(request: Request, response: Response, next: NextFunction): Promise<void> {
        logger.debug("IN LOGIN HANDLER");
        /* eslint-disable @typescript-eslint/no-unsafe-member-access */
        const email = request?.body?.email as string;
        const password = request?.body?.password as string;
        /* eslint-enable @typescript-eslint/no-unsafe-member-access */

        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        return signInAuthentication(email, password, this.userDAO, async (err?: Error, user?: UserDO) => {
            if (err || !user) {
                const message = `User could not be authenticated. ${err ? err.message : ""}`;
                request.session.destroy((sessionDestroyErr: Error) => {
                    logger.debug(`Attempting to destroy un-auth'd session: ${sessionDestroyErr}`);
                });
                return next(new UnauthorizedError(message));
            } else {
                request.session.user = serializeUser(user);
                request.session.save((sessionErr: any) => {
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

    public async use(request: Request, response: Response, next: NextFunction): Promise<void> {
        logger.debug("IN REGISTER HANDLER");
        /* eslint-disable @typescript-eslint/no-unsafe-member-access */
        const email = request?.body?.email as string;
        const password = request?.body?.password as string;
        /* eslint-enable @typescript-eslint/no-unsafe-member-access */
        if (!email || !password) {
            return next(new Error("Some details are missing. Cannot register user."));
        }
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        return signUpAuthentication(email, password, this.userDAO, async (err?: Error, user?: UserDO) => {
            if (err) {
                return next(err);
            } else if (!user) {
                return next(new Error("For some reason could not register user"));
            } else {
                logger.debug(`registered user: ${user}`);
                request.session.user = serializeUser(user);
                return next();
            }
        });
    }
}
/* eslint-enable max-classes-per-file */
