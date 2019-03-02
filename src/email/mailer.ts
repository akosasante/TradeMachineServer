import Email from "email-templates";
import nodemailer from "nodemailer";
import SendinBlueTransport from "nodemailer-sendinblue-transport";
import path from "path";
import { inspect } from "util";
import logger from "../bootstrap/logger";
import User from "../models/user";

export class Emailer {

    // tslint:disable-next-line
    public trafficController: {[key: string]: Function} = {
        reset_pass: this.sendPasswordResetEmail.bind(this),
    };
    private emailer: Email;
    private transportOpts = {
        apiKey: process.env.EMAIL_KEY,
        apiUrl: process.env.EMAIL_API,
    };
    private transport = nodemailer.createTransport(SendinBlueTransport(this.transportOpts));
    private baseDomain = process.env.BASE_URL;

    constructor() {
        logger.debug("creating Emailer class");
        this.emailer = new Email({
            message: {
                from: "tradebot@flexfoxfantasy.com",
            },
            preview: true,
            send: false,
            juice: true,
            juiceResources: {
                preserveImportant: true,
                webResources: {
                    relativeTo: path.resolve("./src/email/templates"),
                },
            },
            // htmlToText: false, // set to false if we decide to manually make text versions
            views: {
                root: path.resolve("./src/email/templates"),
            },
            transport: this.transport,
        });
    }

    public async sendPasswordResetEmail(user: User) {
        const resetPassPage = `${this.baseDomain}/reset_password`;
        return this.emailer.send({
            template: "reset_password",
            message: {
                to: user.email,
            },
            locals: {
                name: user.name || user.email,
                url: resetPassPage,
            },
        });
    }
}

// async function test() {
//     const mailer = new Emailer();
//     const user = new User({name: "Akosua", email: "asante@gmail.com"});
//     await mailer.sendPasswordResetEmail(user);
// }
// test();
