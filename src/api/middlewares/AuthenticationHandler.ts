import { NextFunction, Request, Response } from "express";
import { get } from "lodash";
import { ExpressMiddlewareInterface, UnauthorizedError } from "routing-controllers";
import { inspect } from "util";
import { serializeUser, signInAuthentication, signUpAuthentication } from "../../authentication/auth";
import logger from "../../bootstrap/logger";
import UserDO from "../../models/user";
import UserDAO from "../../DAO/UserDAO";
import {User} from "@akosasante/trade-machine-models";
// tslint:disable:max-classes-per-file

export class LoginHandler implements ExpressMiddlewareInterface {
    constructor(public userDAO: UserDAO = new UserDAO()) {}
    
    public async use(request: Request, response: Response, next: NextFunction) {
        logger.debug("IN LOGIN HANDLER");
        const email = get(request, "body.email");
        const password = get(request, "body.password");
        return signInAuthentication(email, password, this.userDAO, async (err?: Error, user?: User) => {
            if (err || !user) {
                const message = `User could not be authenticated. ${err ? err.message : ""}`;
                request.session!.destroy((sessionDestroyErr: Error) => {
                    logger.debug(`Attempting to destroy unauthd session: ${sessionDestroyErr}`);
                });
                return next(new UnauthorizedError(message));
            } else {
                request.session!.user = await serializeUser(user);
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

// export class RegisterHandler implements ExpressMiddlewareInterface {
//     public async use(request: Request, response: Response, next: NextFunction) {
//         logger.debug("IN REGISTER HANDLER");
//         const email = get(request, "body.email");
//         const password = get(request, "body.password");
//         if (!email || !password) {
//             return next(new Error("Some details are missing. Cannot register user."));
//         }
//         return signUpAuthentication(email, password, async (err?: Error, user?: User) => {
//             if (err) {
//                 return next(err);
//             } else if (!user) {
//                 return next(new Error("For some reason could not register user"));
//             } else {
//                 logger.debug(`registered user: ${user}`);
//                 request.session!.user = await serializeUser(user);
//                 return next();
//             }
//         });
//     }
// }
