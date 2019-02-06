import { Request } from "express";
import { Controller, Post, Req, Session, UseBefore } from "routing-controllers";
import util from "util";
import { deserializeUser } from "../../bootstrap/auth";
import logger from "../../bootstrap/logger";
import UserDAO from "../../DAO/user";
import User from "../../models/user";
import { LoginHandler, RegisterHandler } from "../middlewares/AuthenticationHandler";

@Controller("/auth")
export default class AuthController {
    @Post("/login")
    @UseBefore(LoginHandler)
    public async login(@Req() request: Request, @Session() session: any): Promise<User> {
        // TODO: Maybe extract deserialization to a usebefore middleware
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
            const userDAO = new UserDAO();
            if (session && session.user && request.session) {
                request.session.destroy(async err => {
                    if (err) {
                        logger.error("Error destroying session");
                        reject(err);
                    } else {
                        logger.debug(`Destroying user session for userId#${session.user}`);
                        await userDAO.updateUser(session.user, { lastLoggedIn: new Date() });
                        delete session.user;
                        resolve(true);
                    }
                });
            } else {
                // Assumedly, there's nothing to log out of. We're all good.
                // I don't think it's necessary to throw an error here
                logger.debug("Resolving empty session logout");
                resolve(true);
            }
        });
    }
}
