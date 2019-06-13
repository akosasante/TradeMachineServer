import Email from "email-templates";
import nodemailer from "nodemailer";
// @ts-ignore
import SendinBlueTransport from "nodemailer-sendinblue-transport";
import path from "path";
import {inspect} from "util";
import logger from "../bootstrap/logger";
import User from "../models/user";

export class Emailer {

    // tslint:disable-next-line
    public trafficController: { [key: string]: Function } = {
        reset_pass: this.sendPasswordResetEmail.bind(this),
        test_email: this.sendTestEmail.bind(this),
        registration_email: this.sendRegistrationEmail.bind(this),
    };
    private emailer: Email;
    private transportOpts = {
        apiKey: process.env.EMAIL_KEY,
        apiUrl: process.env.EMAIL_API_URL,
    };

    private transport = nodemailer.createTransport(SendinBlueTransport(this.transportOpts));
    private baseDomain = process.env.BASE_URL;

    constructor() {
        logger.debug("creating Emailer class");
        this.emailer = new Email({
            message: {
                from: "tradebot@flexfoxfantasy.com",
            },
            preview: false,
            send: true,
            juice: true,
            juiceResources: {
                preserveImportant: true,
                webResources: {
                    relativeTo: path.resolve("./src/email/templates"),
                    images: true,
                },
            },
            // htmlToText: false, // set to false if we decide to manually make text versions
            views: {
                root: path.resolve("./src/email/templates"),
            },
            transport: this.transport,
        });
        logger.debug("Emailer class created");
    }

    public async sendPasswordResetEmail(user: User) {
        const resetPassPage = `${this.baseDomain}/reset_password?u=${User.sanitizeUUID(user.userIdToken!)}`;
        logger.debug("sending password reset email");
        return this.emailer.send({
            template: "reset_password",
            message: {
                to: user.email,
            },
            locals: {
                name: user.name || user.email,
                url: resetPassPage,
            },
        }).then((res: any) => {
            return res;
            /* Shape of response:
            { messageId: string (<something@smtp-relay.sendinblue.com>),
            code: string (success),
            message: string,
            originalMessage (an obect with to, from, html, and text versions of the email)
            }
             */
        }).catch((err: Error) => {
            logger.error(inspect(err));
            return undefined;
        });
    }

    public async sendTestEmail(user: User) {
        logger.debug("sending test email");
        return this.emailer.send({
            template: "test_email",
            message: {
                to: user.email,
            },
            locals: {
                name: user.name || user.email,
            },
        })
            .then((res: any) => res)
            .catch((err: Error) => {
                logger.error(inspect(err));
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
                name: user.name || user.email,
                url: registrationLink,
            },
        })
            .then((res: any) => res)
            .catch((err: Error) => {
                logger.error(inspect(err));
                return undefined;
            });
    }
}

// async function test() {
//     const mailer = new Emailer();
//     const user = new User({name: "Akosua", email: "asante@gmail.com"});
//     await mailer.sendPasswordResetEmail(user);
// }
// test();
