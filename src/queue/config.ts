import amqp from "amqplib";
import logger from "../bootstrap/logger";

export const config = {
    url: "amqp://localhost",
};

export class MessageProtocol {
    protected connection: amqp.Connection;
    protected channel: amqp.Channel;

    constructor(conn: amqp.Connection, ch: amqp.Channel) {
        this.connection = conn;
        this.channel = ch;
    }

    public async openQueue(queueName: string) {
        // durable: ensures that queue is not deleted when server restarts
        return this.channel.assertQueue(queueName, {durable: true})
            .catch(err => {
                logger.error(err);
                // await this.connection.close();
            });
    }
}
