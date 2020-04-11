import { Job } from "bull";
import { inspect } from "util";
import logger from "../bootstrap/logger";
import { Emailer, SendInBlueSendResponse } from "../email/mailer";
import User from "../models/user";
import { EmailStatusEvent } from "../api/routes/EmailController";
import EmailDAO from "../DAO/EmailDAO";

export type EmailJobName = "reset_pass" | "registration_email" | "test_email" | "handle_webhook";

export interface EmailJob {
    mailType: EmailJobName;
    user?: string; // JSON representation of user
    event?: string; // JSON representation of webhook response
}

export const emailCallbacks: {[key in EmailJobName]: ((u: User) => Promise<SendInBlueSendResponse>) | ((e: EmailStatusEvent) => Promise<void>)} = {
    reset_pass: Emailer.sendPasswordResetEmail,
    test_email: Emailer.sendTestEmail,
    registration_email: Emailer.sendRegistrationEmail,
    handle_webhook: handleWebhookResponse,
};

export async function processEmailJob(emailJob: Job<EmailJob>) {
    logger.debug(inspect(emailJob));
    const emailTask = emailCallbacks[emailJob.data.mailType];

    if (emailJob.data.mailType === "handle_webhook" && emailJob.data.event) {
        const event = JSON.parse(emailJob.data.event);
        return await emailTask(event);
    } else if (emailJob.data.user) {
        const user = JSON.parse(emailJob.data.user);
        return await emailTask(user);
    }
}

export async function handleWebhookResponse(event: EmailStatusEvent, dao?: EmailDAO): Promise<void> {
    const emailDAO = dao || new EmailDAO();
    const email = emailDAO.getEmailByMessageId(event["message-id"]);
    if (email) {
        logger.debug("FOUND AN EMAIL; UPDATE ITS STATUS AND STUFF (LATER)"); // TODO
    }
}
