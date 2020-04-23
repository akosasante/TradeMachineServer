import Email from "email-templates";
import nodemailer from "nodemailer";
// @ts-ignore
import SendinBlueTransport from "nodemailer-sendinblue-transport";
import path from "path";
import { inspect } from "util";
import logger from "../bootstrap/logger";
import User from "../models/user";
import { config as dotenvConfig } from "dotenv";
dotenvConfig({path: path.resolve(__dirname, "../../.env")});

export interface SendInBlueSendResponse {
    envelope: {
        from: string;
        to: string[];
    };
    messageId?: string;
    message: string;
    originalMessage: {
        to: string;
        from: string;
        subject: string;
        html: string;
        text: string;
        attachments: object[];
    };
}

const SendInBlueOpts = {
    apiKey: process.env.EMAIL_KEY,
    apiUrl: process.env.EMAIL_API_URL,
};

const SendInBlueTransport = nodemailer.createTransport(SendinBlueTransport(SendInBlueOpts));

const baseDomain = process.env.BASE_URL;

export const Emailer = {
    emailer: new Email({
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
        transport: SendInBlueTransport,
        views: {
            root: path.resolve("./src/email/templates"),
        },
    }),

    async sendPasswordResetEmail(user: User): Promise<SendInBlueSendResponse> {
        const resetPassPage = `${baseDomain}/reset_password?u=${encodeURI(user.id!)}`;
        logger.debug("sending password reset email");
        return Emailer.emailer.send({
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
            logger.info(`Successfully sent password reset email: ${inspect(res.messageId)}`);
            return res;
        })
        .catch((err: Error) => {
            logger.error(`Ran into an error while sending password reset email: ${inspect(err)}`);
            return undefined;
        });
    },

    async sendTestEmail(user: User): Promise<SendInBlueSendResponse> {
        logger.debug(`sending test email to user: ${user}`);
        return Emailer.emailer.send({
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
            logger.info(`Successfully sent test email: ${inspect(res.messageId)}`);
            return res;
        })
        .catch((err: Error) => {
            logger.error(`Ran into an error while sending test email: ${inspect(err)}`);
            return undefined;
        });
    },

    async sendRegistrationEmail(user: User): Promise<SendInBlueSendResponse> {
        logger.debug("sending registration email");
        const registrationLink = `${baseDomain}/register`;
        return Emailer.emailer.send({
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
            logger.info(`Successfully sent registration email: ${inspect(res.messageId)}`);
            return res;
        })
        .catch((err: Error) => {
            logger.error(`Ran into an error while sending registration email: ${inspect(err)}`);
            return undefined;
        });
    },
};

Object.freeze(Emailer);

async function test() {
    const mailer = Emailer;
    const user = new User({displayName: "Akosua", email: "tripleabatt@gmail.com"});
    logger.info("BEFORE");
    const res = await mailer.sendTestEmail(user);
    logger.info(`RESULT: ${inspect(res)}`);
}
test();
