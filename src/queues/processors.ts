import { Job } from "bull";
import { inspect } from "util";
import logger from "../bootstrap/logger";
import { Emailer, SendInBlueSendResponse } from "../email/mailer";
import User from "../models/user";

export type EmailJobName = "reset_pass" | "registration_email" | "test_email";

export interface EmailJob {
    mailType: EmailJobName;
    user: string; // JSON representation of user
}

export const emailCallbacks: {[key in EmailJobName]: (u: User) => Promise<SendInBlueSendResponse>} = {
    reset_pass: Emailer.sendPasswordResetEmail,
    test_email: Emailer.sendTestEmail,
    registration_email: Emailer.sendRegistrationEmail,
};

export async function processEmailJob(emailJob: Job<EmailJob>) {
    logger.debug(inspect(emailJob));
    const emailTask = emailCallbacks[emailJob.data.mailType];
    const user = JSON.parse(emailJob.data.user);
    return await emailTask(user);
}
