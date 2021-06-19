import { ExpressMiddlewareInterface, Middleware } from "routing-controllers";
import { NextFunction, Request, Response } from "express";
import logger from "../../bootstrap/logger";
import { deserializeUser } from "../../authentication/auth";
import { inspect } from "util";

declare module "express" {
  interface Request {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    rollbar_person?: {
      id?: string;
      email?: string;
      username?: string;
    };
  }
}

@Middleware({ type: "before" })
export default class RollbarPeopleHandler implements ExpressMiddlewareInterface {
  public async use(request: Request, response: Response, next: NextFunction): Promise<void> {
    logger.debug(`IN ROLLBAR HANDLER with session= ${inspect(request.session.user)} ${!!request}`);
    try {
      const existingUser = await deserializeUser(request.session?.user || "");
      logger.debug(`"Found user=", ${inspect(existingUser)}`);
      request.rollbar_person = {
        id: existingUser.id,
        email: existingUser.email,
        username: existingUser.displayName
      };
      return next();
    } catch (e) {
      return next(e);
    }
  }
}
