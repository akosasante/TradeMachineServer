import { Response } from "express";
import { Body, BodyParam, Controller, NotFoundError, Post, Res } from "routing-controllers";
import { inspect } from "util";
import logger from "../../bootstrap/logger";
import UserDAO from "../../DAO/UserDAO";
import { EmailPublisher } from "../../queues/publishers";

interface EmailStatusEvent {
    id: number;
    event: string;
    email: string;
    date: string;
    "message-id": string;
    ts_epoch?: number;
    ts_event?: number;
    ts?: number;
    subject?: string;
    tag?: string;
    reason?: string;
    link?: string;
}

@Controller("/email")
export default class EmailController {
    private userDao: UserDAO;
    private emailPublisher: EmailPublisher;

    constructor(userDAO?: UserDAO, publisher?: EmailPublisher) {
        this.userDao = userDAO || new UserDAO();
        this.emailPublisher = publisher || EmailPublisher.getInstance();
    }

    @Post("/sendInMailWebhook")
    public async receiveSendInMailWebhook(@Body() event: EmailStatusEvent, @Res() response: Response): Promise<Response> {
        logger.debug(inspect(event));
        return response.status(200).json({});
    }

    @Post("/resetEmail")
    public async sendResetEmail(@BodyParam("email") email: string, @Res() response: Response): Promise<Response> {
        logger.debug(`Preparing to send reset password email to: ${email}`);
        const user = await this.userDao.findUser({email});

        if (!user) {
            throw new NotFoundError("No user found with the given email.");
        } else {
            // Update current user with reset request time
            await this.userDao.setPasswordExpires(user.id!);

            // Queue send email with current user
            await this.emailPublisher.queueResetEmail(user);
            return response.status(202).json({status: "email queued"});
        }
    }

    @Post("/testEmail")
    public async sendTestEmail(@BodyParam("email") email: string, @Res() response: Response): Promise<Response> {
        logger.debug(`Preparing to send test email to: ${email}`);
        const user = await this.userDao.findUser({email});

        if (!user) {
            throw new NotFoundError("No user found with the given email.");
        } else {
            // Queue send email with current user
            await this.emailPublisher.queueTestEmail(user);
            return response.status(202).json({status: "email queued"});
        }
    }

    @Post("/registrationEmail")
    public async sendRegistrationEmail(@BodyParam("email") email: string, @Res() response: Response):
        Promise<Response> {
        logger.debug(`Preparing to send registration email to: ${email}`);
        const user = await this.userDao.findUser({email});

        if (!user) {
            throw new NotFoundError("No user found with the given email.");
        } else {
            // Queue send email with current user
            await this.emailPublisher.queueRegistrationEmail(user);
            return response.status(202).json({status: "email queued"});
        }
    }
}
