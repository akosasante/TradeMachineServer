import {Request, Response} from "express";
import {BodyParam, Controller, Post, Req, Res, Session, UseBefore} from "routing-controllers";
import {deserializeUser} from "../../authentication/auth";
import logger from "../../bootstrap/logger";
import UserDAO from "../../DAO/UserDAO";
import {LoginHandler, RegisterHandler} from "../middlewares/AuthenticationHandler";
import {User} from "@akosasante/trade-machine-models";

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
    //
    // @Post("/reset_password")
    // public async resetPassword(@BodyParam("id") userId: number,
    //                            @BodyParam("password") newPassword: string,
    //                            @BodyParam("token") passwordResetToken: string,
    //                            @Res() response: Response): Promise<Response> {
    //     const hashedPassword = await User.generateHashedPassword(newPassword);
    //     const existingUser = await this.userDao.findUser({id: userId, passwordResetToken}, false);
    //
    //     if (!existingUser) {
    //         logger.debug("did not find user for id and token");
    //         return response.status(404).json("user does not exist");
    //     }
    //     if (!existingUser.passwordResetIsValid()) {
    //         logger.debug("user password reset expired");
    //         return response.status(403).json("expired");
    //     }
    //
    //     await this.userDao.updateUser(userId, {
    //         password: hashedPassword,
    //         passwordResetExpiresOn: undefined });
    //     return response.status(200).json("success");
    // }
}
