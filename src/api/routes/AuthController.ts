import { Request } from "express";
import { Controller, Get, JsonController, Post, Req, Session, UseAfter, UseBefore } from "routing-controllers";
import util from "util";
import { deserializeUser } from "../../bootstrap/auth";
import logger from "../../bootstrap/logger";
import User from "../../models/user";
import { LoginHandler } from "../middlewares/AuthenticationHandler";

@Controller("/auth")
export default class AuthController {
    @Post("/login")
    @UseBefore(LoginHandler)
    public async login(@Req() request: Request, @Session() session: any): Promise<User> {
        return await deserializeUser(session.user);
    }

    // @Post("/logout")
    // public async logout(@Req() request: Request, @Session("passport", { required: false }) userSession?: any):
    //     Promise<any> {
    //     if (userSession) {
    //         logger.debug(`Logging out userID: ${userSession.user}`);
    //         return new Promise((resolve, reject) => {
    //             request.session.destroy(err => {
    //                 if (err) {
    //                     reject(err);
    //                 }
    //                 request.logout();
    //                 resolve(true);
    //             });
    //         });
    //     } else {
    //         throw new UnauthorizedError("No session exists to log out of.");
    //     }
    // }

}
