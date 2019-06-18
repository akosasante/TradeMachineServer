import amqp from "amqplib";
import logger from "../bootstrap/logger";
import { Emailer } from "../email/mailer";
import { config } from "./config";
import { MessageConsumer } from "./consumer";
import { MessagePublisher } from "./publisher";

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

export async function createMailQueue(env: string) {
    try {
        const conn = await amqp.connect(config.url);
        const channel = await conn.createChannel();
        const email = await new Emailer(env);
        const publisher = await MessagePublisher.createPublisher(conn, channel);
        const consumer = await MessageConsumer.createConsumer(conn, channel);
        if (email && publisher && consumer) {
            return new MailQueue(email, publisher, consumer);
        } else {
            throw new Error("Missing parameters");
        }
    } catch (error) {
        logger.error("error creating mail queue");
        logger.error(error);
        throw error;
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
