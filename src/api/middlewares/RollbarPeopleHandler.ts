import { ExpressMiddlewareInterface, Middleware } from "routing-controllers";
import { NextFunction, Request, Response } from "express";
import logger from "../../bootstrap/logger";
import { deserializeUser } from "../../authentication/auth";
import { inspect } from "util";
// importing for express-session declaration
// eslint-disable-next-line @typescript-eslint/no-unused-vars

declare module "express" {
    interface Request {
        person?: {
            id?: string;
            email?: string;
            username?: string;
        };
    }
}

// declare the additional fields that we add to express session (via routing-controllers)
declare module "express-session" {
    interface SessionData {
        user: string | undefined;
    }
}

@Middleware({ type: "before" })
export default class RollbarPeopleHandler implements ExpressMiddlewareInterface {
    public async use(request: Request, response: Response, next: NextFunction): Promise<void> {
        logger.debug(`IN ROLLBAR HANDLER with sessionId=${request.sessionID} session=${inspect(request.session)} `);
        try {
            if (request.session?.user) {
                const existingUser = await deserializeUser(request.session.user);
                logger.debug(`"Found user=", ${inspect(existingUser)}`);
                request.person = {
                    id: existingUser.id,
                    email: existingUser.email,
                    username: existingUser.displayName,
                };
            }
            return next();
        } catch (e) {
            return next(e);
        }
    }
}
