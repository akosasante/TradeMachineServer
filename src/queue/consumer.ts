import amqp from "amqplib";
import { inspect } from "util";
import logger from "../bootstrap/logger";
import { config, MessageProtocol } from "./config";

export class MessageConsumer extends MessageProtocol {
    constructor(conn: amqp.Connection, ch: amqp.Channel) {
        super(conn, ch);
        logger.debug("created consumer");
    }

    public async consumeMessagesOn(queue: string, cb: any) {
        logger.debug("consuming messages");
        try {
            await this.channel.consume(queue, async data => {
                if (data) {
                    const message = JSON.parse(data.content.toString());
                    // logger.debug(inspect(message));
                    await cb(message);
                    this.channel.ack(data);
                } else {
                    logger.error("No data to consume in queue");
                }
            });
        } catch (error) {
            logger.error(error);
        }
    }
}

export async function createConsumer(): Promise<MessageConsumer|undefined> {
    return amqp.connect(config.url)
        .then(async conn => {
            const channel = await conn.createChannel();
            await channel.prefetch(2);
            return new MessageConsumer(conn, channel);
        })
        .catch(err => {
            logger.error(err);
            throw err;
            // return process.exit(1); // maybe have the error handled upstream instead?
        });
}

// async function test() {
//     const cons = await createConsumer();
//     if (cons) {
//         await cons.openQueue("test");
//         await cons.consumeMessagesOn("test", logger.info);
//     }
// }
//
// test();
