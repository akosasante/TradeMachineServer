import { Response } from "express";
import { BodyParam, Controller, Post, Res } from "routing-controllers";
import { mailQueue } from "../../bootstrap/app";
import UserDAO from "../../DAO/user";
import { MailQueue, MailQueueMessage } from "../../queue/mailQueue";

@Controller("/email")
export default class EmailController {
    private readonly intervalId: NodeJS.Timeout;
    private userDao: UserDAO;
    private readonly mailQueue?: MailQueue;

    constructor() {
        this.userDao = new UserDAO();
        this.intervalId = setInterval(this.mailQueueLoaded, 500);
        this.mailQueue = mailQueue;
    }

    @Post("/resetEmail")
    public async sendResetEmail(@BodyParam("email") email: string, @Res() response: Response): Promise<Response> {
        try {
            // Update current user with reset request time
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

    private mailQueueLoaded() {
        if (typeof this.mailQueue !== "undefined") {
            clearInterval(this.intervalId);
        }
    }
}
