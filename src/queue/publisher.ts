import amqp from "amqplib";
import { inspect } from "util";
import logger from "../bootstrap/logger";
import { config, MessageProtocol } from "./config";

export class MessagePublisher extends MessageProtocol {
    constructor(conn: amqp.Connection, ch: amqp.Channel) {
        super(conn, ch);
        logger.debug("created publisher");
    }

    public async sendMessage(queue: string, message: string) {
        await this.channel.sendToQueue(queue, Buffer.from(message), {
            persistent: true,
            contentType: "application/json",
        });
        logger.debug("sent message");
    }
}

export async function createPublisher(): Promise<MessagePublisher|undefined> {
    return amqp.connect(config.url)
        .then(async conn => {
            const channel = await conn.createChannel();
            return new MessagePublisher(conn, channel);
        })
        .catch(err => {
            logger.error(err);
            return undefined;
            // return process.exit(1); // maybe have the error handled upstream instead?
        });
}

// async function test() {
//     const pub = await createPublisher();
//     if (pub) {
//         await pub.openQueue("test");
//         let iterations = 0;
//         setInterval(async () => {
//             iterations += 1;
//             if (iterations <= 100) {
//                 await pub.sendMessage("test", JSON.stringify(`yoyoyo: ${iterations}`));
//             } else {
//                 clearInterval();
//                 process.exit(0);
//             }
//         }, 2000);
//     }
// }
//
// test();
