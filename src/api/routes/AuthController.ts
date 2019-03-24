import { Request, Response } from "express";
import { BodyParam, Controller, Post, Req, Res, Session, UseBefore } from "routing-controllers";
import { deserializeUser } from "../../bootstrap/auth";
import logger from "../../bootstrap/logger";
import UserDAO from "../../DAO/user";
import User from "../../models/user";
import { LoginHandler, RegisterHandler } from "../middlewares/AuthenticationHandler";

@Controller("/auth")
export default class AuthController {
    private userDao: UserDAO;

    constructor() {
        this.userDao = new UserDAO();
    }

    @Post("/login")
    @UseBefore(LoginHandler)
    public async login(@Req() request: Request, @Session() session: any): Promise<User> {
        // TODO: Maybe extract deserialization to a usebefore api.middleware
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
                request.session.destroy(async err => {
                    if (err) {
                        logger.error("Error destroying session");
                        reject(err);
                    } else {
                        logger.debug(`Destroying user session for userId#${session.user}`);
                        await this.userDao.updateUser(session.user, { lastLoggedIn: new Date() });
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

    @Post("/reset_password")
    public async resetPassword(@BodyParam("id") userId: number,
                               @BodyParam("password") newPassword: string,
                               @Res() response: Response): Promise<Response> {
        const hashedPassword = await User.generateHashedPassword(newPassword);
        const user = await this.userDao.updateUser(userId, {
            password: hashedPassword,
            passwordResetExpiresOn: undefined });
        return response.status(200).json("success");
    }
}
