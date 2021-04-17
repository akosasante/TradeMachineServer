import { Response } from "express";
import { Body, BodyParam, Controller, NotFoundError, Post, Res } from "routing-controllers";
import { inspect } from "util";
import logger from "../../bootstrap/logger";
import UserDAO from "../../DAO/UserDAO";
import { EmailPublisher } from "../../email/publishers";
import { rollbar } from "../../bootstrap/rollbar";

export interface EmailStatusEvent {
    id: number;
    event: string;
    email: string;
    date: string;
    "message-id": string;
    /* eslint-disable @typescript-eslint/naming-convention */
    ts_epoch?: number;
    ts_event?: number;
    /* eslint-enable @typescript-eslint/naming-convention */
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
        rollbar.info("receiveSendInMailWebhook", {event});
        logger.debug(`Received email webhook: ${inspect(event)}`);
        await this.emailPublisher.queueWebhookResponse(event);
        return response.status(200).json({});
    }

    @Post("/testEmail")
    public async sendTestEmail(@BodyParam("email") email: string, @Res() response: Response): Promise<Response> {
        rollbar.info("sendTestEmail", {email});
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
}
