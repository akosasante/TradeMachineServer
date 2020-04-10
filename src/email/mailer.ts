import Email from "email-templates";
import nodemailer from "nodemailer";
// @ts-ignore
import SendinBlueTransport from "nodemailer-sendinblue-transport";
import path from "path";
import { inspect } from "util";
import logger from "../bootstrap/logger";
import User from "../models/user";
// import {config as dotenvConfig} from "dotenv";
// dotenvConfig({path: path.resolve(__dirname, "../../.env")});

export class Emailer {
    // tslint:disable-next-line
    public trafficController: { [key: string]: Function } = {
        reset_pass: this.sendPasswordResetEmail.bind(this),
        test_email: this.sendTestEmail.bind(this),
        registration_email: this.sendRegistrationEmail.bind(this),
    };
    private emailer: Email;

    private SendInBlueOpts = {
        apiKey: process.env.EMAIL_KEY,
        apiUrl: process.env.EMAIL_API_URL,
    };
    private SendInBlueTransport = nodemailer.createTransport(SendinBlueTransport(this.SendInBlueOpts));

    private baseDomain = process.env.BASE_URL;

    constructor() {
        this.emailer = new Email({
            juice: true,
            juiceResources: {
                webResources: {
                    relativeTo: path.resolve("./src/email/templates"),
                    images: false,
                },
            },
            message: {
                from: "tradebot@flexfoxfantasy.com",
            },
            subjectPrefix: "FlexFoxFantasy TradeMachine - ",
            transport: this.SendInBlueTransport,
            views: {
                root: path.resolve("./src/email/templates"),
            },
        });
        logger.debug("Emailer class created");
    }

    /* Shape of response:
    { messageId: string (<something@smtp-relay.sendinblue.com>),
    code: string (success),
    message: string,
    originalMessage (an obect with to, from, html, and text versions of the email)
    }
    */

    public async sendPasswordResetEmail(user: User) {
        const resetPassPage = `${this.baseDomain}/reset_password?u=${encodeURI(user.id!)}`;
        logger.debug("sending password reset email");
        return this.emailer.send({
            template: "reset_password",
            message: {
                to: user.email,
            },
            locals: {
                name: user.displayName || user.email,
                url: resetPassPage,
            },
        })
        .then((res: any) => {
            logger.info(`Successfully sent password reset email: ${inspect(res)}`);
            return res;
        })
        .catch((err: Error) => {
            logger.error(`Ran into an error while sending password reset email: ${inspect(err)}`);
            return undefined;
        });
    }

    public async sendTestEmail(user: User) {
        logger.debug(`sending test email to user: ${user}`);
        return this.emailer.send({
            template: "test_email",
            message: {
                to: user.email,
                subject: "Test Email",
            },
            locals: {
                name: user.displayName || user.email,
            },
        })
        .then((res: any) => {
            logger.info(`Successfully sent test email: ${inspect(res)}`);
            return res;
        })
        .catch((err: Error) => {
            logger.error(`Ran into an error while sending test email: ${inspect(err)}`);
            return undefined;
        });
    }

    public async sendRegistrationEmail(user: User) {
        logger.debug("sending registration email");
        const registrationLink = `${this.baseDomain}/register`;
        return this.emailer.send({
            template: "registration_email",
            message: {
                to: user.email,
            },
            locals: {
                name: user.displayName || user.email,
                url: registrationLink,
            },
        })
        .then((res: any) => {
            logger.info(`Successfully sent registration email: ${inspect(res)}`);
            return res;
        })
        .catch((err: Error) => {
            logger.error(`Ran into an error while sending registration email: ${inspect(err)}`);
            return undefined;
        });
    }
}

// async function test() {
//     const mailer = new Emailer();
//     const user = new User({displayName: "Akosua", email: "tripleabatt@example.com"});
//     logger.info("BEFORE")
//     const res = await mailer.sendTestEmail(user);
//     logger.info(`RESULT: ${inspect(res)}`);
// }
// test();
