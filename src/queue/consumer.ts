import amqp from "amqplib";
import { inspect } from "util";
import logger from "../bootstrap/logger";
import { MessageProtocol } from "./config";

export class MessageConsumer extends MessageProtocol {
    public static async createConsumer(conn: amqp.Connection, channel: amqp.Channel):
        Promise<MessageConsumer|undefined> {
        logger.debug("creating consumer");
        try {
            await channel.prefetch(2);
            return new MessageConsumer(conn, channel);
        } catch (err) {
            logger.error(err);
            throw err;
            // return process.exit(1); // maybe have the error handled upstream instead?
        }
    }

    constructor(conn: amqp.Connection, ch: amqp.Channel) {
        super(conn, ch);
        logger.debug("created consumer");
    }

    public async consumeMessagesOn(queue: string, cb: any) {
        logger.debug(`consuming messages in queue ${queue}`);
        try {
            const assertQueueStats = await this.openQueue(queue);
            logger.debug(inspect(assertQueueStats));
            await this.channel.consume(queue, async data => {
                if (data) {
                    const message = JSON.parse(data.content.toString());
                    // logger.debug(inspect(message));
                    await cb(message);
                    this.channel.ack(data);
                } else {
                    logger.error("No data to consume in queue, has the consumer been canceled?");
                }
            });
        } catch (error) {
            logger.error(error);
        }
    }
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
