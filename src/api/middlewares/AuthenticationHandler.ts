import { NextFunction } from "express";
import { get } from "lodash";
import { ExpressMiddlewareInterface, UnauthorizedError } from "routing-controllers";
import util from "util";
import { PassportAuth } from "../../bootstrap/app";
import { serializeUser, signInAuthentication } from "../../bootstrap/auth";
import logger from "../../bootstrap/logger";
import User from "../../models/user";

export class LoginHandler implements ExpressMiddlewareInterface {
    public async use(request: Request, response: Response, next: NextFunction) {
        logger.debug("IN LOGIN HANDLER");
        const email = get(request, "body.email");
        const password = get(request, "body.password");
        return signInAuthentication(email, password, async (err?: Error, user?: User) => {
            if (err || !user) {
                return next(new UnauthorizedError(err ? err.message : "User could not be authenticated."));
            } else {
                request.session.user = await serializeUser(user);
                return next();
            }
        });
        // const email = get(request, "body")
        // if (PassportAuth) {
        //     const authenticate = (cb: any) => PassportAuth.authenticate("local_sign_in", cb);
        //     return authenticate((err: Error, user: User, info: any) => {
        //         if (err || !user) {
        //             return next (new UnauthorizedError(info.message));
        //         }
        //         if (request.session) {
        //             request.session.user = user;
        //         }
        //         return next();
        //     })(request, response, next);
        // } else {
        //     throw new Error("Could not initialize authenticator");
        // }
    }
}
