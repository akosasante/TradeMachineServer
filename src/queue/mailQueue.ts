import { inspect } from "util";
import logger from "../bootstrap/logger";
import { Emailer } from "../email/mailer";
import User from "../models/user";
import { createConsumer, MessageConsumer } from "./consumer";
import { createPublisher, MessagePublisher } from "./publisher";
export interface MailQueueMessage {
    topic: string;
    args: any[];
}
export class MailQueue {
    private emailer: Emailer;
    private publisher: MessagePublisher;
    private consumer: MessageConsumer;

    constructor(mail: Emailer, pub: MessagePublisher, sub: MessageConsumer) {
        this.emailer = mail;
        this.publisher = pub;
        this.consumer = sub;
        this.watchQueue();
    }

    public async addEmail(message: string) {
        logger.debug("addEmail");
        await this.publisher.sendMessage("email", message);
    }

    public watchQueue() {
        logger.debug("watchQueue");
        return this.consumer.consumeMessagesOn("email", this.sendEmail.bind(this));
    }

    public sendEmail(message: MailQueueMessage) {
        const type = message.topic;
        logger.debug(`sendEmail. Type = ${type}`);
        return this.emailer.trafficController[type](...message.args);
    }
}

export async function createMailQueue() {
    try {
        const email = await new Emailer();
        const publisher = await createPublisher();
        const consumer = await createConsumer();
        if (email && publisher && consumer) {
            return new MailQueue(email, publisher, consumer);
        } else {
            throw new Error("Missing parameters");
        }
    } catch (error) {
        logger.error("error creating mail queue");
        logger.error(error);
    }
}

// async function test() {
//     const mailqueue = await createMailQueue();
//     // logger.debug(inspect(mailqueue));
//     if (mailqueue) {
//         logger.debug("...");
//         const user = new User({name: "Kwasi", email: "kwasi@gmail.com"});
//         const x = {topic: "reset_pass", args: [user]};
//         await mailqueue.addEmail(JSON.stringify(x));
//     }
// }
//
// test();
