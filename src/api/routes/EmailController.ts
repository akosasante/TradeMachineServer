import { Response } from "express";
import { Authorized, BodyParam, Controller, Post, Res } from "routing-controllers";
import logger from "../../bootstrap/logger";
import UserDAO from "../../DAO/UserDAO";
import { Role } from "../../models/user";
import { createMailQueue, MailQueue, MailQueueMessage } from "../../queue/mailQueue";

@Controller("/email")
export default class EmailController {
    // private readonly intervalId: NodeJS.Timeout;
    private userDao: UserDAO;
    private mailQueue?: MailQueue;

    constructor(userDAO?: UserDAO, fetchedMailQueue?: MailQueue) {
        this.userDao = userDAO || new UserDAO();
        logger.debug("setting up mail queue");
        if (fetchedMailQueue) {
            this.mailQueue = fetchedMailQueue;
            logger.debug("mail queue setup complete [passed in]");
        }
        // this.intervalId = setInterval(this.mailQueueLoaded, 10);
    }

    @Authorized(Role.OWNER)
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

    @Authorized(Role.OWNER)
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

    @Authorized(Role.OWNER)
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
