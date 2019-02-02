import { Request } from "express";
import { Controller, Post, Req, Session, UseBefore } from "routing-controllers";
import { deserializeUser } from "../../bootstrap/auth";
import logger from "../../bootstrap/logger";
import User from "../../models/user";
import { LoginHandler, RegisterHandler } from "../middlewares/AuthenticationHandler";

@Controller("/auth")
export default class AuthController {
    @Post("/login")
    @UseBefore(LoginHandler)
    public async login(@Req() request: Request, @Session() session: any): Promise<User> {
        // TODO: Maybe extract desrialization to a usebefore middleware
        const user = await deserializeUser(session.user);
        return user!.publicUser;
    }

    @Post("/signup")
    @UseBefore(RegisterHandler)
    public async signup(@Req() request: Request, @Session() session: any): Promise<User> {
        const user = await deserializeUser(session.user);
        return user!.publicUser;
    }

    @Post("/logout")
    public async logout(@Req() request: Request, @Session() session: any) {
        return new Promise((resolve, reject) => {
            if (session && session.user && request.session) {
                delete session.user;
                request.session.destroy(err => {
                    if (err) {
                        logger.error("Error destroying session");
                        reject(err);
                    }
                    logger.debug(`Destroying user session for userId#${session.user}`);
                    resolve(true);
                });
            } else {
                // Assumedly, there's nothing to log out of. We're all good.
                // I don't think it's necessary to throw an error here
                resolve(true);
            }
        });
    }
}
