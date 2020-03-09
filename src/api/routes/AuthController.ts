import { User } from "@akosasante/trade-machine-models";
import { Request, Response } from "express";
import { BodyParam, Controller, Post, Req, Res, Session, UseBefore } from "routing-controllers";
import { deserializeUser, generateHashedPassword, passwordResetDateIsValid } from "../../authentication/auth";
import logger from "../../bootstrap/logger";
import UserDAO from "../../DAO/UserDAO";
import { LoginHandler, RegisterHandler } from "../middlewares/AuthenticationHandler";
import User from "../../models/user";

@Controller("/auth")
export default class AuthController {
    private userDao: UserDAO;

    constructor(userDAO?: UserDAO) {
        this.userDao = userDAO || new UserDAO();
    }

    @Post("/login")
    @UseBefore(LoginHandler)
    public async login(@Req() request: Request, @Session() session: any): Promise<User> {
        // TODO: Maybe extract deserialization to a usebefore api.middleware
        return await deserializeUser(session.user, this.userDao);
    }

    @Post("/signup")
    @UseBefore(RegisterHandler)
    public async signup(@Req() request: Request, @Session() session: any): Promise<User> {
        return await deserializeUser(session.user, this.userDao);
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
    public async resetPassword(@BodyParam("id") userId: string,
                               @BodyParam("password") newPassword: string,
                               @BodyParam("token") passwordResetToken: string,
                               @Res() response: Response): Promise<Response> {
        const existingUser = await this.userDao.getUserById(userId);

        if (!existingUser || !existingUser.passwordResetToken ||
            existingUser.passwordResetToken !== passwordResetToken) {
            logger.debug("did not find user for id and matching token");
            return response.status(404).json("user does not exist");
        }
        if (!passwordResetDateIsValid(existingUser.passwordResetExpiresOn)) {
            logger.debug("user password reset expired");
            return response.status(403).json("expired");
        }

        logger.debug("valid reset password request");
        const hashedPassword = await generateHashedPassword(newPassword);
        await this.userDao.updateUser(userId, {
            password: hashedPassword,
            passwordResetExpiresOn: undefined,
            passwordResetToken: undefined,
        });
        return response.status(200).json("success");
    }
}
