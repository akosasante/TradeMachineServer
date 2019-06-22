import axios from "axios";
import { Response } from "express";
import {
    Authorized,
    Body,
    BodyParam,
    Controller,
    Get,
    NotFoundError,
    OnUndefined,
    Param,
    Post,
    Res
} from "routing-controllers";
import { inspect } from "util";
import logger from "../../bootstrap/logger";
import UserDAO from "../../DAO/UserDAO";
import { Role } from "../../models/user";
import { createMailQueue, MailQueue, MailQueueMessage } from "../../queue/mailQueue";

interface EmailStatusEvent {
    date: Date;
    type: string;
    reason: string;
    tag?: string;
}

interface EmailStatus {
    id: string;
    events: EmailStatusEvent[];
}

@Controller("/email")
export default class EmailController {
    // private readonly intervalId: NodeJS.Timeout;
    private userDao: UserDAO;
    private mailQueue?: MailQueue;
    private BASE_URL: string = "https://api.sendinblue.com/v2.0/";

    constructor(userDAO?: UserDAO, fetchedMailQueue?: MailQueue) {
        this.userDao = userDAO || new UserDAO();
        logger.debug("setting up mail queue");
        if (fetchedMailQueue) {
            this.mailQueue = fetchedMailQueue;
            logger.debug("mail queue setup complete [passed in]");
        }
        // this.intervalId = setInterval(this.mailQueueLoaded, 10);
    }

    @Authorized(Role.ADMIN)
    @Get("/:id/status")
    public async getEmailStatus(@Param("id") messageId: string): Promise<EmailStatus> {
        const {data: {code, data: resEvents}} =
            await axios.post(`${this.BASE_URL}/report`,
                {message_id: messageId},
                {headers: {"api-key": process.env.EMAIL_KEY}});
        if (code !== "success") {
            throw new NotFoundError("No email found with that message ID");
        }
        return {
            id: messageId,
            events: resEvents.map((ev: any) => ({
                date: new Date(ev.date),
                type: ev.event,
                reason: ev.reason,
            })),
        };
    }

    @OnUndefined(204)
    @Post("/sendInMailWebhook")
    public async receiveSendInMailWebhook(@Body() event: EmailStatusEvent): Promise<void> {
        logger.debug(inspect(event));
        return;
    }

    @Post("/resetEmail")
    public async sendResetEmail(@BodyParam("email") email: string, @Res() response: Response): Promise<Response> {
        try {
            // Update current user with reset request time
            await this.assertMailQueue();
            logger.debug(`Finding user with email: ${email}`);
            const user = await this.userDao.findUser({email});
            await this.userDao.setPasswordExpires(user!.id!);

            // Send email with current user
            const queueMessage: MailQueueMessage = {topic: "reset_pass", args: [user]};
            await this.mailQueue!.addEmail(JSON.stringify(queueMessage));
            return response.status(202).json({status: "email queued"});
        } catch (error) {
            throw error;
        }
    }

    @Post("/testEmail")
    public async sendTestEmail(@BodyParam("email") email: string, @Res() response: Response): Promise<Response> {
        try {
            await this.assertMailQueue();
            logger.debug(`Finding user with email: ${email}`);
            const user = await this.userDao.findUser({email});

            const queueMessage: MailQueueMessage = {topic: "test_email", args: [user]};
            await this.mailQueue!.addEmail(JSON.stringify(queueMessage));
            return response.status(202).json({status: "email queued"});
        } catch (error) {
            throw error;
        }
    }

    @Post("/registrationEmail")
    public async sendRegistrationEmail(@BodyParam("email") email: string, @Res() response: Response):
        Promise<Response> {
        try {
            await this.assertMailQueue();
            logger.debug(`Finding user with email to register: ${email}`);
            const user = await this.userDao.findUser({email});

            const queueMessage: MailQueueMessage = {topic: "registration_email", args: [user]};
            await this.mailQueue!.addEmail(JSON.stringify(queueMessage));
            return response.status(202).json({status: "email queued"});
        } catch (error) {
            logger.error("Error sending registration email", error);
            throw error;
        }
    }

    public async assertMailQueue() {
        if (this.mailQueue) {
            logger.debug("Mail queue has already been loaded");
            return;
        } else {
            logger.debug("Need to create new mail queue");
            this.mailQueue = await createMailQueue(process.env.NODE_ENV || "development");
            logger.debug("mail queue setup complete [created]");
        }
    }

    // private mailQueueLoaded() {
    //     logger.debug("Checking if mail queue is loaded");
    //     if (typeof this.mailQueue !== "undefined") {
    //         logger.debug("Mail queue is loaded!")
    //         clearInterval(this.intervalId);
    //     }
    // }
}
